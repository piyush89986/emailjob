"""Rotating refresh token model."""
from datetime import datetime, timezone
from typing import Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class RefreshToken(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    token_hash: str
    expires_at: datetime
    revoked: bool = False
    replaced_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "refresh_tokens"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING)]),
        ]
