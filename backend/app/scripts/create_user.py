"""Script to create or reset a user account in JobMail MongoDB database."""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path, override=True)

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models import ALL_DOCUMENT_MODELS
from app.models.tenant import Tenant
from app.models.user import User
from app.models.settings import TenantSettings
from app.models.profile import Profile
from app.repositories.domain import UserRepo, TenantRepo
from app.services.auth_service import AuthService
from app.scripts.seed import seed_global_templates


async def create_or_update_user(email: str, password: str, full_name: str, org_name: str):
    settings = get_settings()
    print(f"Connecting to MongoDB: {settings.mongo_db}...")
    client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=10000)
    await init_beanie(database=client[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
    await seed_global_templates()
    print("Beanie initialized successfully.")

    clean_email = email.lower().strip()
    existing_user = await UserRepo.find_by_email_global(clean_email)

    if existing_user:
        print(f"User '{clean_email}' already exists (ID: {existing_user.id}, Tenant: {existing_user.tenant_id}).")
        print("Updating password and full name...")
        existing_user.hashed_password = get_password_hash(password)
        existing_user.full_name = full_name
        existing_user.is_active = True
        await existing_user.save()
        print("User credentials updated successfully!")
        client.close()
        return existing_user

    print(f"Creating new user '{clean_email}' in workspace '{org_name}'...")
    user, access_token, refresh_token = await AuthService.signup(
        email=clean_email,
        password=password,
        full_name=full_name,
        org_name=org_name
    )
    print("SUCCESS!")
    print(f"  User ID:    {user.id}")
    print(f"  Email:      {user.email}")
    print(f"  Name:       {user.full_name}")
    print(f"  Tenant ID:  {user.tenant_id}")
    print(f"  Role:       {user.role}")
    print(f"  Access Token: {access_token[:30]}...")

    client.close()
    return user


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "piyushsinghtomar777@gmail.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "12345678"
    name = sys.argv[3] if len(sys.argv) > 3 else "piyush"
    org = sys.argv[4] if len(sys.argv) > 4 else "own"

    asyncio.run(create_or_update_user(email, password, name, org))
