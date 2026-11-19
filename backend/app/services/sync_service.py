"""Inbound email synchronization, deduplication, thread matching, and classification."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from app.core.events import publish_event
from app.core.logging import get_logger
from app.models.account import EmailAccount
from app.models.message import Message
from app.models.thread import Thread
from app.repositories.domain import (
    AccountRepo,
    ApplicationRepo,
    ContactRepo,
    MessageRepo,
    ThreadRepo,
)
from app.services.account_service import AccountService
from app.services.providers import get_email_provider

log = get_logger("sync_service")


class SyncService:
    @staticmethod
    async def sync_account(account: EmailAccount) -> int:
        """Sync new emails for a given EmailAccount with deduplication and thread matching."""
        tenant_id = account.tenant_id
        provider = get_email_provider(account)

        try:
            inbound_items, new_cursor = await provider.sync_inbox(cursor=account.sync_cursor)
        except Exception as e:
            log.warning("account_sync_error", account_id=account.id, error=str(e))
            if "auth" in str(e).lower() or "token" in str(e).lower() or "401" in str(e):
                await AccountService.mark_needs_reauth(account.id, tenant_id, "Sync auth failed")
            return 0

        synced_count = 0
        for item in inbound_items:
            created = await SyncService.ingest_inbound_message(account, item)
            if created:
                synced_count += 1

        # Re-fetch full body for any existing inbound messages that only have short snippets
        try:
            msg_repo = MessageRepo(tenant_id)
            existing_inbound = await msg_repo.find_all(Message.email_account_id == account.id, Message.dir == "in")
            async with httpx.AsyncClient() as client:
                token = await provider._ensure_token(client) if hasattr(provider, "_ensure_token") else None
                if token and hasattr(provider, "_fetch_message"):
                    h = {"Authorization": f"Bearer {token}"}
                    for m in existing_inbound:
                        if m.provider_message_id and len(m.body or "") < 250:
                            detail = await provider._fetch_message(client, h, m.provider_message_id)
                            if detail and detail.get("body") and len(detail["body"]) > len(m.body or ""):
                                await msg_repo.update(m.id, body=detail["body"])
                                log.info("rehydrated_full_message_body", message_id=m.id, length=len(detail["body"]))
        except Exception as ex:
            log.warning("rehydrate_snippets_failed", error=str(ex))

        # Update cursor and last_synced_at
        acc_repo = AccountRepo(tenant_id)
        await acc_repo.update(
            account.id,
            sync_cursor=new_cursor or account.sync_cursor,
            last_synced_at=datetime.now(timezone.utc),
            status="connected",
            error_message=None
        )
        return synced_count

    @staticmethod
    async def ingest_inbound_message(account: EmailAccount, item: Dict[str, Any]) -> Optional[Message]:
        """Deduplicate, match thread, classify (normal/auto/bounce), and record message."""
        tenant_id = account.tenant_id
        p_mid = item.get("provider_message_id", "")
        if not p_mid:
            return None

        body = item.get("body", "")

        msg_repo = MessageRepo(tenant_id)
        # 1. Deduplication check on {email_account_id, provider_message_id}
        existing = await msg_repo.find_by_provider_message_id(account.id, p_mid)
        if existing:
            # If the existing message only had a short snippet, update it with the full body
            if body and len(body) > len(existing.body or ""):
                await msg_repo.update(existing.id, body=body)
                log.info("existing_message_body_updated", message_id=existing.id, len=len(body))
            return None  # Already processed

        sender_email = item.get("from", "").strip()
        # Clean sender email e.g. "Name <recruiter@company.com>" -> "recruiter@company.com"
        clean_sender = sender_email
        if "<" in sender_email and ">" in sender_email:
            clean_sender = sender_email.split("<")[1].split(">")[0].strip()

        subject = item.get("subject", "No subject")
        body = item.get("body", "")
        in_reply_to = item.get("in_reply_to")
        refs = item.get("references", [])
        kind = item.get("kind", "normal")
        p_tid = item.get("provider_thread_id")
        rfc_id = item.get("rfc_message_id")

        # 2. Thread Matching
        thread_repo = ThreadRepo(tenant_id)
        contact_repo = ContactRepo(tenant_id)
        matched_thread: Optional[Thread] = None

        # Method A: Match by In-Reply-To / References to existing message
        lookup_refs = ([in_reply_to] if in_reply_to else []) + refs
        if lookup_refs:
            prev_msg = await msg_repo.find_by_in_reply_to_or_references(lookup_refs)
            if prev_msg:
                matched_thread = await thread_repo.get_by_id(prev_msg.thread_id)

        # Method B: Match by provider_thread_id
        if not matched_thread and p_tid:
            matched_thread = await thread_repo.find_by_provider_thread_id(p_tid)

        # Method C: Match by sender contact
        contact = await contact_repo.find_by_email(clean_sender)
        if not matched_thread and contact:
            contact_threads = await thread_repo.find_by_contact_id(contact.id)
            if contact_threads:
                matched_thread = contact_threads[0]

        # If still no thread or contact, create them
        if not contact:
            contact = await contact_repo.get_or_create(clean_sender)

        if not matched_thread:
            matched_thread = await thread_repo.create(
                subject=subject,
                contact_id=contact.id,
                unread=True,
                provider_thread_id=p_tid
            )
        else:
            await thread_repo.update(matched_thread.id, unread=True, updated_at=datetime.now(timezone.utc))

        # 3. Create Inbound Message
        msg = await msg_repo.create(
            thread_id=matched_thread.id,
            email_account_id=account.id,
            dir="in",
            from_addr=clean_sender,
            to_addrs=item.get("to", []),
            subject=subject,
            body=body,
            at=datetime.now(timezone.utc),
            kind=kind,
            provider_message_id=p_mid,
            rfc_message_id=rfc_id,
            in_reply_to=in_reply_to,
            references=refs
        )

        # 4. State updates based on classification
        now_iso = datetime.now(timezone.utc).isoformat()
        if kind == "normal":
            # Real recruiter reply!
            await contact_repo.update(contact.id, status="Replied", last_replied_at=datetime.now(timezone.utc))
            app_repo = ApplicationRepo(tenant_id)
            app = await app_repo.find_by_contact_id(contact.id)
            if not app:
                # Also try matching by thread ID or hr_email
                from app.models.application import Application
                app = await Application.find_one(
                    Application.tenant_id == tenant_id,
                    {"$or": [
                        {"gmail_thread_id": matched_thread.id},
                        {"hr_email": clean_sender.lower()}
                    ]}
                )
            if app:
                await app_repo.append_timeline(app.id, f"Recruiter reply received from {clean_sender}")
                reply_record = {
                    "from": clean_sender,
                    "subject": subject,
                    "body_snippet": body[:300] if body else "",
                    "at": datetime.now(timezone.utc).isoformat()
                }
                app.recruiter_replies.append(reply_record)
                app.status = "Response Received"
                app.updated_at = datetime.now(timezone.utc)
                await app.save()

            # Emit reply.received event
            await publish_event(tenant_id, "reply.received", {
                "threadId": matched_thread.id,
                "contactName": contact.name,
                "subject": subject,
                "from": clean_sender
            })

        # Calculate unread count and emit
        unread_count = await thread_repo.count(Thread.unread == True)
        await publish_event(tenant_id, "unread.count", {"unreadCount": unread_count})

        log.info("inbound_message_ingested", message_id=msg.id, kind=kind, thread_id=matched_thread.id)
        return msg
