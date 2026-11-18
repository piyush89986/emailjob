"""Abstract base email provider interface."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class EmailProvider(ABC):
    """Unified interface for Gmail, Microsoft Graph, and IMAP/SMTP."""

    @abstractmethod
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
        """Send email via provider.

        Returns dict containing:
            - "provider_message_id": str
            - "rfc_message_id": str
            - "provider_thread_id": Optional[str]
        """
        pass

    @abstractmethod
    async def test_connection(self) -> bool:
        """Verify provider credentials and connection."""
        pass

    @abstractmethod
    async def sync_inbox(self, cursor: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Sync new inbound messages since cursor.

        Returns:
            - messages: list of dicts with provider_message_id, rfc_message_id, from, to,
              subject, body, date, in_reply_to, references, kind
            - new_cursor: updated sync cursor
        """
        pass
