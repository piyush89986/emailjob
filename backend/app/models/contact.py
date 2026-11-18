"""Contact model representing recruiters or hiring managers."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Contact(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    name: str
    email: str
    company: str = ""
    status: str = "Contacted"  # "Contacted" | "Replied" | "Interview" | "Offer" | "Rejected"
    last_replied_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "contacts"
        indexes = [
            IndexModel([("tenant_id", ASCENDING), ("email", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("last_replied_at", ASCENDING)]),
        ]
