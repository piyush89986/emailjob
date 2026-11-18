"""Tenant model representing an isolated customer organization."""
from datetime import datetime, timezone
import uuid
from beanie import Document
from pydantic import Field


class Tenant(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    name: str
    plan: str = "starter"
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "tenants"
