"""Tests for email reply matching, threading headers, and classification."""
import pytest
from app.api.v1.threads import derive_thread_state
from app.models.account import EmailAccount
from app.models.application import Application
from app.models.contact import Contact
from app.models.message import Message
from app.models.thread import Thread
from app.repositories.domain import ApplicationRepo, ContactRepo, MessageRepo, ThreadRepo
from app.services.sync_service import SyncService


@pytest.mark.asyncio
async def test_reply_matching_by_in_reply_to_and_references(tenant_a):
    """Test matching inbound replies using In-Reply-To and References headers."""
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="gmail",
        address="user@test.com",
        encrypted_creds="enc",
        status="connected",
        is_default=True
    )
    await acc.insert()

    c_repo = ContactRepo("tenant_a")
    contact = await c_repo.create(name="Sarah Connor", email="sarah@skynet.com", company="Cyberdyne", status="Contacted")

    t_repo = ThreadRepo("tenant_a")
    thread = await t_repo.create(subject="Fullstack Role Application", contact_id=contact.id)

    m_repo = MessageRepo("tenant_a")
    # Outbound email with RFC ID
    out_msg = await m_repo.create(
        thread_id=thread.id,
        dir="out",
        from_addr="me",
        to_addrs=["sarah@skynet.com"],
        subject="Fullstack Role Application",
        body="Applying for role",
        rfc_message_id="<outbound-001@jobmail.app>"
    )

    # Inbound reply referencing outbound RFC ID
    reply_item = {
        "provider_message_id": "inbound-999",
        "rfc_message_id": "<reply-999@skynet.com>",
        "from": "sarah@skynet.com",
        "to": ["user@test.com"],
        "subject": "Re: Fullstack Role Application",
        "body": "Thanks! Can you do Tuesday at 2 PM?",
        "in_reply_to": "<outbound-001@jobmail.app>",
        "references": ["<outbound-001@jobmail.app>"],
        "kind": "normal"
    }

    in_msg = await SyncService.ingest_inbound_message(acc, reply_item)
    assert in_msg is not None
    assert in_msg.thread_id == thread.id

    # Verify contact status was updated to Replied
    updated_contact = await c_repo.get_by_id(contact.id)
    assert updated_contact.status == "Replied"
    assert updated_contact.last_replied_at is not None


@pytest.mark.asyncio
async def test_auto_reply_ignored_and_bounce_flagged(tenant_a):
    """Test that auto-replies are marked 'auto' and bounces are marked 'bounce'."""
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="gmail",
        address="user@test.com",
        encrypted_creds="enc",
        status="connected",
        is_default=True
    )
    await acc.insert()

    # 1. Test Auto-reply
    auto_item = {
        "provider_message_id": "auto_001",
        "from": "recruiter@vacation.com",
        "subject": "Out of Office: On Vacation",
        "body": "I will return next Monday.",
        "kind": "auto"
    }
    auto_msg = await SyncService.ingest_inbound_message(acc, auto_item)
    assert auto_msg.kind == "auto"

    # 2. Test Bounce
    bounce_item = {
        "provider_message_id": "bounce_001",
        "from": "mailer-daemon@googlemail.com",
        "subject": "Delivery Status Notification (Failure)",
        "body": "Address not found.",
        "kind": "bounce"
    }
    bounce_msg = await SyncService.ingest_inbound_message(acc, bounce_item)
    assert bounce_msg.kind == "bounce"

    # Verify thread state derivation
    m_repo = MessageRepo("tenant_a")
    bounce_thread_messages = await m_repo.find_by_thread_id(bounce_msg.thread_id)
    state = derive_thread_state(bounce_thread_messages)
    assert state == "bounced"
