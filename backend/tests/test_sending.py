"""Tests for email sending rules: DNC list, daily send cap, and retry."""
import pytest
from app.core.errors import AppError
from app.models.account import EmailAccount
from app.models.message import Message
from app.repositories.domain import MessageRepo
from app.services.sending_service import SendingService


@pytest.mark.asyncio
async def test_dnc_list_enforced(tenant_a):
    """Test that sending to an email or domain on the DNC list is blocked."""
    # Add connected account
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="imap",
        address="user@test.com",
        encrypted_creds="{}",
        status="connected",
        is_default=True
    )
    await acc.insert()

    # blocked@competitor.com is in tenant_a DNC
    with pytest.raises(AppError) as exc_info:
        await SendingService.validate_can_send("tenant_a", ["blocked@competitor.com"])
    assert exc_info.value.code == "dnc_blocked"


@pytest.mark.asyncio
async def test_daily_cap_enforced(tenant_a):
    """Test that sending beyond daily cap is blocked."""
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="imap",
        address="user@test.com",
        encrypted_creds="{}",
        status="connected",
        is_default=True
    )
    await acc.insert()

    # Fill daily cap (tenant_a has daily_cap=10)
    m_repo = MessageRepo("tenant_a")
    for i in range(10):
        await m_repo.create(
            thread_id="t1",
            dir="out",
            from_addr="me",
            to_addrs=["recipient@example.com"],
            delivery="sent"
        )

    # 11th send must be rejected
    with pytest.raises(AppError) as exc_info:
        await SendingService.validate_can_send("tenant_a", ["fresh@target.com"])
    assert exc_info.value.code == "daily_cap_exceeded"


@pytest.mark.asyncio
async def test_retry_failed_message(tenant_a):
    """Test retrying a failed message."""
    m_repo = MessageRepo("tenant_a")
    msg = await m_repo.create(
        thread_id="t1",
        dir="out",
        from_addr="me",
        to_addrs=["target@company.com"],
        delivery="failed",
        error_reason="Connection timeout"
    )

    retried = await SendingService.retry_send(msg.id, "tenant_a")
    assert retried.delivery == "sending"
    assert retried.error_reason is None
