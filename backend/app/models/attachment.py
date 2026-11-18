"""Email attachment metadata model."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Attachment(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    filename: str
    content_type: str
    size_bytes: int
    data_base64: Optional[str] = None  # Or stored in MongoDB GridFS
    gridfs_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "attachments"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
        ]
