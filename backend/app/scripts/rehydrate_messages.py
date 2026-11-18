"""Script to rehydrate email messages with full bodies from Gmail."""
import asyncio
import os
import sys
import base64
import html
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path, override=True)

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

if not hasattr(AsyncIOMotorClient, "append_metadata"):
    AsyncIOMotorClient.append_metadata = lambda self, *args, **kwargs: None

from app.core.config import get_settings
from app.models import ALL_DOCUMENT_MODELS
from app.models.account import EmailAccount
from app.models.message import Message
from app.services.providers import get_email_provider
import httpx


async def rehydrate():
    settings = get_settings()
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=10000)
    await init_beanie(database=client[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
    print("Beanie initialized.")

    accounts = await EmailAccount.find_all().to_list()
    print(f"Found {len(accounts)} accounts.")

    for acc in accounts:
        print(f"\nAccount: {acc.address} (Provider: {acc.provider})")
        provider = get_email_provider(acc)
        async with httpx.AsyncClient() as http_client:
            token = await provider._ensure_token(http_client) if hasattr(provider, "_ensure_token") else None
            if not token:
                print("  No token available.")
                continue

            headers = {"Authorization": f"Bearer {token}"}
            msgs = await Message.find(Message.email_account_id == acc.id, Message.dir == "in").to_list()
            print(f"  Found {len(msgs)} inbound messages for this account.")

            for m in msgs:
                print(f"  Message {m.id} (Provider ID: {m.provider_message_id}) current body length: {len(m.body or '')}")
                if m.provider_message_id:
                    detail = await provider._fetch_message(http_client, headers, m.provider_message_id)
                    if detail and detail.get("body"):
                        new_body = detail["body"]
                        print(f"    Fetched body length: {len(new_body)}")
                        if len(new_body) > len(m.body or ""):
                            m.body = new_body
                            await m.save()
                            print(f"    --> Successfully updated message {m.id} with full body!")
                        else:
                            print(f"    No update needed (new length <= current length).")
                    else:
                        print(f"    Failed to fetch detail or body was empty.")

    print("\nRehydration complete!")


if __name__ == "__main__":
    asyncio.run(rehydrate())
