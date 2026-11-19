"""Application tracker model storing job applications, timeline stages, and Apply Studio tracking."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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
    # Statuses: "Draft", "Ready to Apply", "Saved", "Applied", "Email Sent", "Email Delivered",
    # "Response Received", "Interview Scheduled", "Assessment", "Offer Received", "Rejected", "Withdrawn"
    status: str = "Saved"
    hr_email: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    match_score: Optional[int] = None
    selected_resume_id: Optional[str] = None
    job_poster_id: Optional[str] = None
    job_poster_url: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    workflow_execution_id: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    gmail_message_id: Optional[str] = None
    gmail_thread_id: Optional[str] = None
    follow_up_count: int = 0
    last_follow_up_at: Optional[datetime] = None
    recruiter_replies: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "applications"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("contact_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("gmail_thread_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
