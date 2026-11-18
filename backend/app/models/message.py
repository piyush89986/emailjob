"""Message model storing individual email messages."""
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING, TEXT
from pydantic import Field


class Message(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    thread_id: str
    email_account_id: str = ""
    dir: str  # "in" | "out"
    from_addr: str  # "me" or recruiter email
    to_addrs: List[str] = Field(default_factory=list)
    subject: str = ""
    body: str = ""
    at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    kind: str = "normal"  # "normal" | "auto" | "bounce"
    delivery: Optional[str] = None  # "sending" | "sent" | "failed"
    provider_message_id: str = Field(default_factory=lambda: f"local_{uuid.uuid4().hex}")
    rfc_message_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    references: List[str] = Field(default_factory=list)
    error_reason: Optional[str] = None
    attachment_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "messages"
        indexes = [
            IndexModel([("tenant_id", ASCENDING), ("thread_id", ASCENDING)]),
            IndexModel([("email_account_id", ASCENDING), ("provider_message_id", ASCENDING)], unique=True, sparse=True),
            IndexModel([("tenant_id", ASCENDING), ("rfc_message_id", ASCENDING)], sparse=True),
            IndexModel([("tenant_id", ASCENDING), ("in_reply_to", ASCENDING)], sparse=True),
            IndexModel([("subject", TEXT), ("body", TEXT)]),
        ]
