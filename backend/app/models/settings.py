"""Tenant settings and sending preferences model."""
from datetime import datetime, timezone
from typing import List
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class TenantSettings(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    tone: str = "friendly"  # "formal" | "friendly" | "concise"
    provider: str = "openai"  # "openai" | "gemini"
    fallback: bool = True
    daily_cap: int = 30
    delay_sec: int = 60
    dnc: List[str] = Field(default_factory=list)
    signature: str = ""
    monthly_ai_limit: float = 20.0
    current_month_ai_usage: float = 0.0
    ai_usage_reset_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "tenant_settings"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)], unique=True),
        ]
