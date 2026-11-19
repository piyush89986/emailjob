"""Email account model storing connected mailboxes and encrypted credentials."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class EmailAccount(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: Optional[str] = None
    provider: str  # "gmail" | "outlook" | "imap"
    address: str
    encrypted_creds: str  # Fernet encrypted token or credentials JSON
    sync_cursor: Optional[str] = None
    status: str = "connected"  # "connected" | "error" | "needs_reauth"
    is_default: bool = False
    error_message: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "email_accounts"
        indexes = [
            IndexModel([("tenant_id", ASCENDING), ("address", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("is_default", ASCENDING)]),
        ]
