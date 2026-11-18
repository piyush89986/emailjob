"""Test idempotency and message deduplication during sync."""
import pytest
from app.models.account import EmailAccount
from app.repositories.domain import MessageRepo
from app.services.sync_service import SyncService


@pytest.mark.asyncio
async def test_sync_message_deduplication(tenant_a):
    """Prove that replaying the same message creates no duplicates."""
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="gmail",
        address="alex@gmail.com",
        encrypted_creds="dummy",
        status="connected",
        is_default=True
    )
    await acc.insert()

    item = {
        "provider_message_id": "gmail_msg_1001",
        "provider_thread_id": "thread_1001",
        "rfc_message_id": "<1001@acme.com>",
        "from": "recruiter@acme.com",
        "to": ["alex@gmail.com"],
        "subject": "Interview for Software Engineer",
        "body": "Hi Alex, let's schedule a call.",
        "kind": "normal"
    }

    # First ingestion creates the message
    msg1 = await SyncService.ingest_inbound_message(acc, item)
    assert msg1 is not None

    # Replay identical message (e.g., duplicated webhook or history list re-run)
    msg2 = await SyncService.ingest_inbound_message(acc, item)
    assert msg2 is None, "Deduplication failed: Duplicate message was ingested!"

    # Verify database has exactly 1 message
    m_repo = MessageRepo("tenant_a")
    count = await m_repo.count()
    assert count == 1
