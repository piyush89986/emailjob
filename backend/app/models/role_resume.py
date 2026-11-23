"""Role-based uploaded resume model with Cloudinary & local storage support."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class RoleResume(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: Optional[str] = None
    role: str  # Target job role, e.g. "MERN Stack Developer", "Backend Engineer", etc.
    filename: str
    content_type: str = "application/pdf"
    size_bytes: int = 0
    url: str = ""  # Cloudinary secure_url or backend download URL
    storage_type: str = "local"  # "cloudinary" | "local"
    cloudinary_public_id: Optional[str] = None
    attachment_id: Optional[str] = None  # StorageService attachment id if stored locally
    data_base64: Optional[str] = None  # Raw base64 file data cached directly on model
    is_default: bool = False
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "role_resumes"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("role", ASCENDING)]),
            IndexModel([("user_id", ASCENDING)]),
        ]
