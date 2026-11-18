"""Microsoft Graph API provider using MSAL for Outlook / M365."""
import base64
from email.utils import make_msgid
from typing import Any, Dict, List, Optional, Tuple
import httpx
import msal
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.services.providers.base import EmailProvider

log = get_logger("graph_provider")
settings = get_settings()


class GraphProvider(EmailProvider):
    def __init__(self, token_data: Dict[str, Any]):
        self.token_data = token_data
        self.access_token = token_data.get("access_token", "")
        self.refresh_token = token_data.get("refresh_token", "")

    async def _ensure_token(self) -> str:
        if not self.refresh_token or not settings.ms_client_id:
            return self.access_token
        try:
            cca = msal.ConfidentialClientApplication(
                settings.ms_client_id,
                authority=f"https://login.microsoftonline.com/{settings.ms_tenant_id}",
                client_credential=settings.ms_client_secret
            )
            result = cca.acquire_token_by_refresh_token(
                self.refresh_token,
                scopes=["https://graph.microsoft.com/Mail.ReadWrite", "https://graph.microsoft.com/Mail.Send"]
            )
            if "access_token" in result:
                self.access_token = result["access_token"]
                self.token_data["access_token"] = self.access_token
        except Exception as e:
            log.warning("graph_token_refresh_failed", error=str(e))
        return self.access_token

    async def test_connection(self) -> bool:
        token = await self._ensure_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/me",
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
        token = await self._ensure_token()
        rfc_id = make_msgid(domain=from_address.split("@")[-1] if "@" in from_address else "jobmail.app")

        headers_list = [{"name": "Message-ID", "value": rfc_id}]
        if in_reply_to:
            headers_list.append({"name": "In-Reply-To", "value": in_reply_to})
        if references:
            headers_list.append({"name": "References", "value": " ".join(references)})

        message_payload: Dict[str, Any] = {
            "subject": subject,
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": [{"emailAddress": {"address": addr.strip()}} for addr in to_addresses if addr.strip()],
            "internetMessageHeaders": headers_list
        }

        if attachments:
            att_list = []
            for att in attachments:
                raw_bytes = att.get("data", b"")
                b64_content = base64.b64encode(raw_bytes).decode("utf-8")
                att_list.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att.get("filename", "attachment.pdf"),
                    "contentType": att.get("content_type", "application/pdf"),
                    "contentBytes": b64_content
                })
            message_payload["attachments"] = att_list

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://graph.microsoft.com/v1.0/me/sendMail",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"message": message_payload, "saveToSentItems": "true"},
                timeout=15.0
            )
            if resp.status_code not in [200, 202]:
                log.error("graph_send_error", status=resp.status_code, body=resp.text)
                raise AppError(f"Graph send failed: {resp.text}", status_code=502)

            return {
                "provider_message_id": rfc_id,
                "provider_thread_id": None,
                "rfc_message_id": rfc_id
            }

    async def sync_inbox(self, cursor: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        token = await self._ensure_token()
        url = cursor or "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$top=20"
        messages: List[Dict[str, Any]] = []
        new_cursor = cursor

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15.0)
            if resp.status_code == 200:
                data = resp.json()
                new_cursor = data.get("@odata.deltaLink", new_cursor)
                for item in data.get("value", []):
                    sender = item.get("from", {}).get("emailAddress", {}).get("address", "")
                    subj = item.get("subject", "")
                    mid = item.get("id", "")
                    body_preview = item.get("bodyPreview", "")

                    is_bounce = "mailer-daemon" in sender.lower() or "postmaster" in sender.lower() or "undeliverable" in subj.lower()
                    kind = "bounce" if is_bounce else "normal"

                    messages.append({
                        "provider_message_id": mid,
                        "provider_thread_id": item.get("conversationId"),
                        "rfc_message_id": item.get("internetMessageId", ""),
                        "from": sender,
                        "to": [r.get("emailAddress", {}).get("address", "") for r in item.get("toRecipients", [])],
                        "subject": subj,
                        "body": body_preview,
                        "date": item.get("receivedDateTime"),
                        "in_reply_to": None,
                        "references": [],
                        "kind": kind
                    })
        return messages, new_cursor
