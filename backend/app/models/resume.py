"""Tailored resume version model."""
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class ResumeVersion(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    application_id: Optional[str] = None
    label: str  # e.g., "v1", "v2"
    at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ats: int = 0  # ATS percentage score
    text: str = ""  # Full structured resume or JSON string
    verified: int = 0
    unsupported: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "resume_versions"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("application_id", ASCENDING)]),
        ]
