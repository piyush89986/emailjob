"""Thread model grouping related inbound and outbound email messages."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Thread(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    subject: str
    contact_id: str
    unread: bool = False
    provider_thread_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "threads"
        indexes = [
            IndexModel([("tenant_id", ASCENDING), ("contact_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("unread", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("provider_thread_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("updated_at", ASCENDING)]),
        ]
