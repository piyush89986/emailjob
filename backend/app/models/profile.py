"""Master profile model storing developer experience, skills, and projects."""
from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Profile(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    name: str = ""
    email: str = ""
    phone: str = ""
    headline: str = ""
    skills: List[str] = Field(default_factory=list)
    experience: List[Dict[str, Any]] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    education: str = ""
    links: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "profiles"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)], unique=True),
        ]
