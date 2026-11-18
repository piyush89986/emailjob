"""Audit log model for sensitive security actions."""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class AuditLog(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: Optional[str] = None
    action: str  # "login", "connect_mailbox", "disconnect_mailbox", "send_email", "export_data", "delete_tenant"
    target_type: str = ""
    target_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "audit_logs"
        indexes = [
            IndexModel([("tenant_id", ASCENDING), ("action", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
