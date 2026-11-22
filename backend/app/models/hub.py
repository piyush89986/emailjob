"""Community Hub models: shared job post feed and group chat."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING, DESCENDING
from pydantic import BaseModel, Field


class HubComment(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    user_id: str
    user_name: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HubPost(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    user_name: str
    user_email: str
    post_type: str = "poster"  # "poster" | "direct_email"
    title: str  # Role title, e.g. "Full Stack Developer (MERN Stack)"
    company: str  # Company Name
    hr_email: str  # Recruiter contact
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    jd: Optional[str] = None
    image_url: Optional[str] = None
    likes: List[str] = Field(default_factory=list)  # list of user_ids
    comments: List[HubComment] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "hub_posts"
        indexes = [
            IndexModel([("created_at", DESCENDING)]),
            IndexModel([("hr_email", ASCENDING)]),
            IndexModel([("company", ASCENDING)]),
        ]


class HubChatMessage(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    user_id: str
    user_name: str
    user_email: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "hub_chat_messages"
        indexes = [
            IndexModel([("created_at", ASCENDING)]),
        ]
