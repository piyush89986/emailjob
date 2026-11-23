"""Gmail API provider implementation."""
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import make_msgid, formatdate
import html
import json
from typing import Any, Dict, List, Optional, Tuple
import httpx
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.services.providers.base import EmailProvider

log = get_logger("gmail_provider")
settings = get_settings()


class GmailProvider(EmailProvider):
    def __init__(self, token_data: Dict[str, Any]):
        self.token_data = token_data
        self.access_token = token_data.get("access_token", "")
        self.refresh_token = token_data.get("refresh_token", "")

    async def _ensure_token(self, client: httpx.AsyncClient) -> str:
        """Refresh token if expired."""
        if not self.refresh_token:
            return self.access_token

        # Attempt to refresh token using Google OAuth endpoint
        try:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.access_token = data.get("access_token", self.access_token)
                self.token_data["access_token"] = self.access_token
        except Exception as e:
            log.warning("gmail_token_refresh_failed", error=str(e))
        return self.access_token

    async def test_connection(self) -> bool:
        async with httpx.AsyncClient() as client:
            token = await self._ensure_token(client)
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            return resp.status_code == 200

    async def send_email(
        self,
        from_address: str,
        to_addresses: List[str],
        subject: str,
        body_html: str,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        msg = MIMEMultipart()
        rfc_id = make_msgid(domain=from_address.split("@")[-1] if "@" in from_address else "jobmail.app")
        msg["Message-ID"] = rfc_id
        msg["Date"] = formatdate(localtime=True)
        msg["From"] = from_address
        msg["To"] = ", ".join(to_addresses)
        msg["Subject"] = subject

        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = " ".join(references)

        msg.attach(MIMEText(body_html, "html"))

        # Attach files if any
        if attachments:
            for att in attachments:
                raw_payload = att.get("data", b"")
                if not raw_payload:
                    continue
                ctype = att.get("content_type", "application/pdf")
                fname = att.get("filename", "resume.pdf")
                if fname.lower().endswith(".pdf") or "pdf" in ctype.lower():
                    maintype, subtype = "application", "pdf"
                elif "/" in ctype:
                    maintype, subtype = ctype.split("/", 1)
                else:
                    maintype, subtype = "application", "octet-stream"

                part = MIMEBase(maintype, subtype)
                part.set_payload(raw_payload)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{fname}"')
                msg.attach(part)

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        async with httpx.AsyncClient() as client:
            token = await self._ensure_token(client)
            resp = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"raw": raw},
                timeout=15.0
            )
            if resp.status_code != 200:
                log.error("gmail_send_error", status=resp.status_code, body=resp.text)
                raise AppError(f"Gmail send failed: {resp.text}", status_code=502)

            data = resp.json()
            return {
                "provider_message_id": data.get("id", ""),
                "provider_thread_id": data.get("threadId"),
                "rfc_message_id": rfc_id
            }

    async def sync_inbox(self, cursor: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Sync messages from Gmail inbox."""
        messages: List[Dict[str, Any]] = []
        new_cursor = cursor
        async with httpx.AsyncClient() as client:
            token = await self._ensure_token(client)
            headers = {"Authorization": f"Bearer {token}"}

            if cursor:
                # Use history.list
                url = f"https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId={cursor}"
                resp = await client.get(url, headers=headers, timeout=15.0)
                if resp.status_code == 200:
                    data = resp.json()
                    new_cursor = data.get("historyId", cursor)
                    history_records = data.get("history", [])
                    msg_ids = set()
                    for h in history_records:
                        for m in h.get("messagesAdded", []):
                            msg_ids.add(m.get("message", {}).get("id"))
                    for mid in list(msg_ids)[:20]:
                        msg_detail = await self._fetch_message(client, headers, mid)
                        if msg_detail:
                            messages.append(msg_detail)
                    return messages, new_cursor

            # Fallback / initial sync - Strictly exclude promotional, social, and forum emails (Requirement 2)
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=is:inbox+-category:promotions+-category:social+-category:forums",
                headers=headers,
                timeout=15.0
            )
            if resp.status_code == 200:
                data = resp.json()
                for item in data.get("messages", []):
                    mid = item.get("id")
                    if mid:
                        msg_detail = await self._fetch_message(client, headers, mid)
                        if msg_detail:
                            messages.append(msg_detail)
            # Update cursor from user profile
            prof = await client.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", headers=headers)
            if prof.status_code == 200:
                new_cursor = prof.json().get("historyId")

        return messages, new_cursor

    @staticmethod
    def _extract_body_from_payload(payload: dict) -> str:
        """Extract full HTML or plain-text body from Gmail message payload, handling nested multiparts."""
        html_parts: List[str] = []
        text_parts: List[str] = []

        def walk(part: dict):
            # Check disposition - skip attachments
            disposition = ""
            for h in part.get("headers", []):
                if h.get("name", "").lower() == "content-disposition":
                    disposition = h.get("value", "").lower()
            if "attachment" in disposition:
                return

            mime = part.get("mimeType", "").lower()
            body_obj = part.get("body", {})
            data_str = body_obj.get("data")

            if data_str:
                try:
                    padded = data_str + "=" * ((4 - len(data_str) % 4) % 4)
                    decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8", errors="replace")
                    if "text/html" in mime:
                        html_parts.append(decoded)
                    elif "text/plain" in mime:
                        text_parts.append(decoded)
                except Exception:
                    pass

            for sub in part.get("parts", []):
                walk(sub)

        walk(payload)

        if html_parts:
            return "".join(html_parts)
        if text_parts:
            raw_text = "\n".join(text_parts)
            escaped = html.escape(raw_text)
            return escaped.replace("\r\n", "<br>").replace("\n", "<br>")
        return ""

    async def _fetch_message(self, client: httpx.AsyncClient, headers: dict, mid: str) -> Optional[Dict[str, Any]]:
        resp = await client.get(f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{mid}?format=full", headers=headers)
        if resp.status_code != 200:
            return None
        data = resp.json()
        label_ids = data.get("labelIds", [])

        # Basic Gmail Filtering: Exclude promotional, social, and forum emails directly (Requirement 2)
        if any(lbl in label_ids for lbl in ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"]):
            log.info("ignoring_promotional_or_social_email", mid=mid, labels=label_ids)
            return None

        payload = data.get("payload", {})
        headers_map = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}

        from_str = headers_map.get("from", "")
        from_lower = from_str.lower()
        subject = headers_map.get("subject", "")
        rfc_id = headers_map.get("message-id", "")
        in_reply_to = headers_map.get("in-reply-to")
        refs_str = headers_map.get("references", "")
        refs = refs_str.split() if refs_str else []

        # Auto-response / Bounce / Automated Notification detection
        auto_submitted = headers_map.get("auto-submitted", "").lower()
        x_autoreply = headers_map.get("x-autoreply", "").lower()
        precedence = headers_map.get("precedence", "").lower()
        is_bounce = "mailer-daemon" in from_lower or "postmaster" in from_lower or "failure" in subject.lower()
        is_automated_sender = any(term in from_lower for term in [
            "noreply", "no-reply", "donotreply", "do-not-reply",
            "notifications@", "notification@", "alert@", "alerts@",
            "newsletters@", "marketing@", "billing@", "updates@", "slice.bank",
            "jobhai", "internshala", "jobalert", "indeed", "linkedin", "naukri", "vercel.com"
        ])
        is_auto = (auto_submitted and auto_submitted != "no") or bool(x_autoreply) or precedence in ["bulk", "junk", "auto_reply"] or is_automated_sender

        kind = "bounce" if is_bounce else ("auto" if is_auto else "normal")

        full_body = self._extract_body_from_payload(payload)
        if not full_body:
            full_body = data.get("snippet", "")

        return {
            "provider_message_id": mid,
            "provider_thread_id": data.get("threadId"),
            "rfc_message_id": rfc_id,
            "from": from_str,
            "to": [headers_map.get("to", "")],
            "subject": subject,
            "body": full_body,
            "date": headers_map.get("date"),
            "in_reply_to": in_reply_to,
            "references": refs,
            "kind": kind,
            "label_ids": data.get("labelIds", []),
            "headers_map": headers_map
        }

    async def register_watch(self, topic_name: str) -> bool:
        """Register Gmail users.watch push notification."""
        async with httpx.AsyncClient() as client:
            token = await self._ensure_token(client)
            resp = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/watch",
                headers={"Authorization": f"Bearer {token}"},
                json={"topicName": topic_name, "labelIds": ["INBOX"]},
                timeout=10.0
            )
            return resp.status_code == 200
