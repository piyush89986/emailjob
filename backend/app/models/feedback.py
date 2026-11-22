"""App feedback & improvement suggestions model."""
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, DESCENDING
from pydantic import Field


class Feedback(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    user_id: str
    user_name: str
    user_email: str
    category: str = "Improvement"  # "Feature Suggestion", "UI/UX Improvement", "Bug / Dikkat", "New Integration"
    title: str
    description: str
    impact: str = "Medium"  # "Low", "Medium", "High", "Critical"
    status: str = "Under Review"  # "Under Review", "Planned", "In Progress", "Implemented"
    votes: List[str] = Field(default_factory=list)  # user_ids who upvoted
    admin_response: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "app_feedbacks"
        indexes = [
            IndexModel([("created_at", DESCENDING)]),
        ]
