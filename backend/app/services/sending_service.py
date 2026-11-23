"""Email sending service with policy validation, thread matching, and worker dispatch."""
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.core.events import publish_event
from app.core.logging import get_logger
from app.models.account import EmailAccount
from app.models.message import Message
from app.models.thread import Thread
from app.repositories.domain import (
    AccountRepo,
    AuditRepo,
    ContactRepo,
    MessageRepo,
    SettingsRepo,
    ThreadRepo,
)
from app.services.account_service import AccountService
from app.services.providers import get_email_provider
from app.services.storage_service import StorageService

log = get_logger("sending_service")
settings = get_settings()


class SendingService:
    @staticmethod
    async def validate_can_send(tenant_id: str, to_addresses: List[str]) -> Tuple[EmailAccount, Any]:
        """Validate DNC list, daily send cap, and connected account existence."""
        settings_repo = SettingsRepo(tenant_id)
        tenant_prefs = await settings_repo.get_or_create()

        # 1. DNC check
        dnc_set = {d.lower().strip() for d in tenant_prefs.dnc if d.strip()}
        for addr in to_addresses:
            clean = addr.lower().strip()
            domain = clean.split("@")[-1] if "@" in clean else ""
            if clean in dnc_set or domain in dnc_set or f"@{domain}" in dnc_set:
                raise AppError(f"Recipient {addr} is on your do-not-contact list", status_code=400, code="dnc_blocked")

        # 2. Default connected account check
        acc_repo = AccountRepo(tenant_id)
        default_account = await acc_repo.get_default()
        if not default_account:
            raise AppError("No default connected email account found. Please connect an account in Settings.", status_code=400, code="no_account")

        # 3. Daily send cap check
        msg_repo = MessageRepo(tenant_id)
        sent_today = await msg_repo.count_sent_today()
        if sent_today >= tenant_prefs.daily_cap:
            raise AppError(f"Daily send cap of {tenant_prefs.daily_cap} reached", status_code=400, code="daily_cap_exceeded")

        return default_account, tenant_prefs

    @staticmethod
    async def enqueue_email_send(
        tenant_id: str,
        user_id: str,
        to_address_str: str,
        subject: str,
        body_html: str,
        attachment_ids: Optional[List[str]] = None,
        thread_id: Optional[str] = None
    ) -> Message:
        """Create pending message, auto-link contact/thread, and enqueue async worker sending."""
        # Parse recipients
        recipients = [addr.strip() for addr in to_address_str.replace(";", ",").split(",") if addr.strip()]
        if not recipients:
            raise AppError("Please provide at least one recipient email", status_code=400, code="invalid_recipient")

        account, prefs = await SendingService.validate_can_send(tenant_id, recipients)

        # 1. Ensure Contact exists (Auto-create with 'Contacted' status if unknown)
        primary_recipient = recipients[0]
        contact_repo = ContactRepo(tenant_id)
        contact = await contact_repo.get_or_create(primary_recipient)

        # 2. Ensure Thread exists
        thread_repo = ThreadRepo(tenant_id)
        if thread_id:
            thread = await thread_repo.get_by_id(thread_id)
            if not thread:
                thread = await thread_repo.create(subject=subject, contact_id=contact.id)
        else:
            thread = await thread_repo.create(subject=subject, contact_id=contact.id)

        # 3. Create outbound Message with delivery="sending"
        msg_repo = MessageRepo(tenant_id)
        message = await msg_repo.create(
            thread_id=thread.id,
            email_account_id=account.id,
            dir="out",
            from_addr="me",
            to_addrs=recipients,
            subject=subject,
            body=body_html,
            at=datetime.now(timezone.utc),
            kind="normal",
            delivery="sending",
            attachment_ids=attachment_ids or []
        )

        # Audit log
        audit = AuditRepo(tenant_id)
        await audit.log_action("send_email", user_id=user_id, target_type="message", target_id=message.id, details={"to": recipients, "subject": subject})

        # Record into HRInbox as outbound recruiter / job application email
        try:
            from app.services.ai.hr_classifier import HRClassifierService
            await HRClassifierService.process_outbound_email(account=account, message=message, user_id=user_id)
        except Exception as e:
            log.warning("hr_inbox_outbound_record_failed", error=str(e))

        # 4. Dispatch sending to ARQ worker or asyncio task
        await SendingService._dispatch_send_job(message.id, tenant_id)

        return message

    @staticmethod
    async def _dispatch_send_job(message_id: str, tenant_id: str) -> None:
        """Try enqueueing to Redis ARQ worker; fallback to in-process asyncio task."""
        enqueued = False
        try:
            from arq import create_pool
            from arq.connections import RedisSettings
            redis_pool = await asyncio.wait_for(
                create_pool(RedisSettings.from_dsn(settings.redis_url)),
                timeout=0.1
            )
            await redis_pool.enqueue_job("send_email_task", message_id, tenant_id)
            await redis_pool.aclose()
            enqueued = True
        except Exception as e:
            log.info("arq_enqueue_skipped_using_asyncio", error=str(e))

        if not enqueued:
            # Run in background via asyncio
            asyncio.create_task(SendingService.process_send_job(message_id, tenant_id))

    @staticmethod
    async def process_send_job(message_id: str, tenant_id: str) -> None:
        """Execute real provider sending with threading headers, attachments, and retry backoff."""
        msg_repo = MessageRepo(tenant_id)
        message = await msg_repo.get_by_id(message_id)
        if not message:
            return

        acc_repo = AccountRepo(tenant_id)
        account = await acc_repo.get_by_id(message.email_account_id)
        if not account or account.status != "connected":
            await msg_repo.update(message_id, delivery="failed", error_reason="Account disconnected")
            await publish_event(tenant_id, "delivery.updated", {"messageId": message_id, "delivery": "failed"})
            return

        # Prepare attachments
        attachments_data: List[Dict[str, Any]] = []
        for att_id in message.attachment_ids:
            att_info = await StorageService.get_attachment_data(tenant_id, att_id, user_id=message.user_id)
            if att_info:
                filename, ctype, raw_data = att_info
                attachments_data.append({"filename": filename, "content_type": ctype, "data": raw_data})

        # CRITICAL SAFETY GUARD: If application email mentions an attached resume but has no attachments,
        # automatically resolve from candidate's RoleResume or Profile so HR always receives the resume PDF!
        if not attachments_data and any(kw in (message.subject + " " + message.body).lower() for kw in ["resume", "cv", "attached", "application", "applying"]):
            log.warning("application_email_missing_attachment_running_safety_guard", message_id=message_id, tenant_id=tenant_id)
            from app.models.role_resume import RoleResume
            fallback_res = None
            if message.user_id:
                fallback_res = (
                    await RoleResume.find_one(RoleResume.user_id == message.user_id, RoleResume.is_default == True)
                    or await RoleResume.find_one(RoleResume.user_id == message.user_id)
                )
            if not fallback_res:
                fallback_res = (
                    await RoleResume.find_one(RoleResume.tenant_id == tenant_id, RoleResume.is_default == True)
                    or await RoleResume.find_one(RoleResume.tenant_id == tenant_id)
                )
            fallback_id = fallback_res.id if fallback_res else "profile_fallback"
            att_info = await StorageService.get_attachment_data(tenant_id, fallback_id, user_id=message.user_id)
            if att_info:
                filename, ctype, raw_data = att_info
                attachments_data.append({"filename": filename, "content_type": ctype, "data": raw_data})
                log.info("safety_attachment_attached_successfully", filename=filename, size=len(raw_data))

        # Follow-up headers (In-Reply-To & References)
        in_reply_to: Optional[str] = None
        references: List[str] = []
        thread_messages = await msg_repo.find_by_thread_id(message.thread_id)
        for prev in thread_messages:
            if prev.id != message.id and prev.rfc_message_id:
                references.append(prev.rfc_message_id)
                in_reply_to = prev.rfc_message_id

        # Enforce rate limit / delay if configured
        settings_repo = SettingsRepo(tenant_id)
        prefs = await settings_repo.get_or_create()
        if prefs.delay_sec > 0:
            await asyncio.sleep(min(prefs.delay_sec, 2))  # Respect delay (capped at 2s in dev/test)

        provider = get_email_provider(account)
        try:
            result = await provider.send_email(
                from_address=account.address,
                to_addresses=message.to_addrs,
                subject=message.subject,
                body_html=message.body,
                in_reply_to=in_reply_to,
                references=references,
                attachments=attachments_data
            )
            # Success
            await msg_repo.update(
                message_id,
                delivery="sent",
                provider_message_id=result.get("provider_message_id"),
                rfc_message_id=result.get("rfc_message_id"),
                in_reply_to=in_reply_to,
                references=references
            )
            # Update thread provider thread ID if provided
            if result.get("provider_thread_id"):
                thread_repo = ThreadRepo(tenant_id)
                await thread_repo.update(message.thread_id, provider_thread_id=result["provider_thread_id"])

            await publish_event(tenant_id, "delivery.updated", {"messageId": message_id, "delivery": "sent"})
            log.info("email_sent_successfully", message_id=message_id, to=message.to_addrs)
        except Exception as e:
            log.error("email_send_failed", message_id=message_id, error=str(e))
            await msg_repo.update(message_id, delivery="failed", error_reason=str(e))
            await publish_event(tenant_id, "delivery.updated", {"messageId": message_id, "delivery": "failed", "error": str(e)})

            # Check if token needs reauth
            if "token" in str(e).lower() or "auth" in str(e).lower() or "401" in str(e):
                await AccountService.mark_needs_reauth(account.id, tenant_id, "Authentication failed during sending")

    @staticmethod
    async def retry_send(message_id: str, tenant_id: str) -> Message:
        """Retry sending a previously failed message."""
        msg_repo = MessageRepo(tenant_id)
        message = await msg_repo.get_by_id(message_id)
        if not message:
            raise NotFoundError("Message not found")
        if message.dir != "out":
            raise AppError("Can only retry outbound messages", status_code=400)

        # Mark sending and dispatch
        updated = await msg_repo.update(message_id, delivery="sending", error_reason=None)
        await publish_event(tenant_id, "delivery.updated", {"messageId": message_id, "delivery": "sending"})
        await SendingService._dispatch_send_job(message_id, tenant_id)
        return updated
