"""Application tracker model storing job applications and timeline stages."""
from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Application(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    title: str
    company: str
    jd: str = ""
    jd_url: str = ""
    contact_id: str = ""
    resume: str = "v1"
    status: str = "Saved"  # "Saved" | "Applied" | "Contacted" | "Replied" | "Interview" | "Offer" | "Rejected"
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "applications"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("contact_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("status", ASCENDING)]),
        ]
