"""Access requests model for Beta / Testing environment access control."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING, DESCENDING
from pydantic import Field


class AccessRequest(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    email: str
    status: str = "pending"  # "pending", "approved", "rejected"
    user_id: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "access_requests"
        indexes = [
            IndexModel([("email", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ]
