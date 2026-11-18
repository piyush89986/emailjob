"""Email template model supporting global and tenant-specific templates."""
from datetime import datetime, timezone
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Template(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str = ""  # Empty or "global" for system-wide seed templates
    name: str
    subject: str
    body: str
    global_template: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "templates"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("global_template", ASCENDING)]),
        ]
