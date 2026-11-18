"""IMAP and SMTP provider implementation using aioimaplib and aiosmtplib."""
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import make_msgid, formatdate, parseaddr
from typing import Any, Dict, List, Optional, Tuple
import aioimaplib
import aiosmtplib
from app.core.errors import AppError
from app.core.logging import get_logger
from app.services.providers.base import EmailProvider

log = get_logger("imap_smtp_provider")


class ImapSmtpProvider(EmailProvider):
    def __init__(self, creds: Dict[str, Any]):
        self.host = creds.get("host", "")
        self.port = int(creds.get("port", 993))
        self.ssl = creds.get("ssl", True)
        self.user = creds.get("user", "")
        self.password = creds.get("pass", "")
        self.smtp_host = creds.get("smtp_host") or self.host.replace("imap.", "smtp.")
        self.smtp_port = int(creds.get("smtp_port") or (465 if self.ssl else 587))

    async def test_connection(self) -> bool:
        # Test IMAP
        try:
            if self.ssl:
                imap = aioimaplib.IMAP4_SSL(host=self.host, port=self.port, timeout=10)
            else:
                imap = aioimaplib.IMAP4(host=self.host, port=self.port, timeout=10)
            await imap.wait_hello_from_server()
            res, _ = await imap.login(self.user, self.password)
            if res != "OK":
                return False
            await imap.logout()
        except Exception as e:
            log.warning("imap_test_failed", error=str(e))
            return False

        # Test SMTP
        try:
            smtp = aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=self.smtp_port == 465,
                start_tls=self.smtp_port == 587,
                timeout=10
            )
            await smtp.connect()
            if self.user and self.password:
                await smtp.login(self.user, self.password)
            await smtp.quit()
        except Exception as e:
            log.warning("smtp_test_failed", error=str(e))
            # If IMAP passed, connection is viable
            return True
        return True

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
        domain = from_address.split("@")[-1] if "@" in from_address else "jobmail.app"
        rfc_id = make_msgid(domain=domain)
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

        if attachments:
            for att in attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(att.get("data", b""))
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{att.get("filename", "attachment")}"')
                msg.attach(part)

        try:
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.user,
                password=self.password,
                use_tls=self.smtp_port == 465,
                start_tls=self.smtp_port == 587,
                timeout=20
            )
        except Exception as e:
            log.error("smtp_send_error", error=str(e))
            raise AppError(f"SMTP send failed: {str(e)}", status_code=502)

        return {
            "provider_message_id": rfc_id,
            "provider_thread_id": None,
            "rfc_message_id": rfc_id
        }

    async def sync_inbox(self, cursor: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        messages: List[Dict[str, Any]] = []
        new_cursor = cursor
        try:
            if self.ssl:
                imap = aioimaplib.IMAP4_SSL(host=self.host, port=self.port, timeout=15)
            else:
                imap = aioimaplib.IMAP4(host=self.host, port=self.port, timeout=15)
            await imap.wait_hello_from_server()
            res, _ = await imap.login(self.user, self.password)
            if res != "OK":
                return messages, cursor

            await imap.select("INBOX")
            # Search messages with UID
            search_crit = f"UID {int(cursor) + 1}:*" if cursor and cursor.isdigit() else "ALL"
            res, data = await imap.uid("search", search_crit)
            if res == "OK" and data and data[0]:
                uids = data[0].split()
                # Take latest 20
                for uid in uids[-20:]:
                    uid_str = uid.decode() if isinstance(uid, bytes) else str(uid)
                    new_cursor = uid_str
                    f_res, f_data = await imap.uid("fetch", uid_str, "(BODY.PEEK[])")
                    if f_res == "OK" and len(f_data) > 1:
                        raw_bytes = f_data[1]
                        parsed_msg = email.message_from_bytes(raw_bytes)
                        sender = parsed_msg.get("From", "")
                        subj = parsed_msg.get("Subject", "")
                        rfc_id = parsed_msg.get("Message-ID", f"<uid-{uid_str}@{self.host}>")
                        in_reply_to = parsed_msg.get("In-Reply-To")
                        refs = parsed_msg.get("References", "").split()

                        # Extract text
                        body_content = ""
                        if parsed_msg.is_multipart():
                            for part in parsed_msg.walk():
                                if part.get_content_type() in ["text/plain", "text/html"]:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        body_content = payload.decode(errors="ignore")
                                        break
                        else:
                            payload = parsed_msg.get_payload(decode=True)
                            if payload:
                                body_content = payload.decode(errors="ignore")

                        auto_sub = parsed_msg.get("Auto-Submitted", "").lower()
                        is_bounce = "mailer-daemon" in sender.lower() or "postmaster" in sender.lower() or "failure" in subj.lower()
                        is_auto = (auto_sub and auto_sub != "no") or bool(parsed_msg.get("X-Autoreply"))

                        kind = "bounce" if is_bounce else ("auto" if is_auto else "normal")

                        messages.append({
                            "provider_message_id": f"imap-{uid_str}",
                            "provider_thread_id": None,
                            "rfc_message_id": rfc_id,
                            "from": sender,
                            "to": [parsed_msg.get("To", "")],
                            "subject": subj,
                            "body": body_content[:500],
                            "date": parsed_msg.get("Date"),
                            "in_reply_to": in_reply_to,
                            "references": refs,
                            "kind": kind
                        })
            await imap.logout()
        except Exception as e:
            log.warning("imap_sync_failed", error=str(e))

        return messages, new_cursor
