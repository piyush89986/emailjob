"""Inbound webhooks for Gmail Pub/Sub and Microsoft Graph notifications."""
import base64
import json
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query, Request, Response
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.account import EmailAccount
from app.services.sync_service import SyncService

log = get_logger("webhooks")
settings = get_settings()
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/gmail")
async def gmail_pubsub_webhook(
    request: Request,
    token: str = Query(None)
):
    """Google Cloud Pub/Sub push webhook for Gmail inbox changes."""
    # Verify token if configured
    if settings.google_pubsub_verification_token and token != settings.google_pubsub_verification_token:
        log.warning("gmail_pubsub_token_mismatch")
        raise HTTPException(status_code=403, detail="Invalid verification token")

    body = await request.json()
    message_data = body.get("message", {}).get("data", "")
    if not message_data:
        return {"status": "ignored"}

    try:
        decoded_bytes = base64.b64decode(message_data)
        notification = json.loads(decoded_bytes.decode("utf-8"))
        email_addr = notification.get("emailAddress")
        history_id = str(notification.get("historyId", ""))

        if email_addr:
            account = await EmailAccount.find_one(EmailAccount.address == email_addr.lower().strip())
            if account:
                await SyncService.sync_account(account)
    except Exception as e:
        log.error("gmail_webhook_processing_error", error=str(e))

    return {"status": "ok"}


@router.post("/graph")
async def microsoft_graph_webhook(
    request: Request,
    validationToken: str = Query(None)
):
    """Microsoft Graph webhook for Outlook inbox changes."""
    # 1. Validation Token Handshake (must return 200 with validationToken as plain text)
    if validationToken:
        return Response(content=validationToken, media_type="text/plain", status_code=200)

    # 2. Change notification
    body = await request.json()
    notifications = body.get("value", [])
    for n in notifications:
        client_state = n.get("clientState")
        if settings.ms_webhook_client_state and client_state != settings.ms_webhook_client_state:
            log.warning("graph_client_state_mismatch")
            continue

        sub_id = n.get("subscriptionId")
        # Find any connected outlook account and sync
        accounts = await EmailAccount.find(EmailAccount.provider == "outlook", EmailAccount.status == "connected").to_list()
        for acc in accounts:
            await SyncService.sync_account(acc)

    return Response(status_code=202)
