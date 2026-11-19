"""HR Inbox model storing classified recruiter, job application, and interview communications."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING, DESCENDING
from pydantic import Field

# The 12 Supported Categories
CATEGORY_HR_RECRUITER = "HR_RECRUITER"
CATEGORY_INTERVIEW_INVITATION = "INTERVIEW_INVITATION"
CATEGORY_APPLICATION_CONFIRMATION = "APPLICATION_CONFIRMATION"
CATEGORY_ASSESSMENT = "ASSESSMENT"
CATEGORY_REJECTION = "REJECTION"
CATEGORY_OFFER_RECEIVED = "OFFER_RECEIVED"
CATEGORY_JOB_ALERT = "JOB_ALERT"
CATEGORY_MARKETING = "MARKETING"
CATEGORY_NEWSLETTER = "NEWSLETTER"
CATEGORY_SPAM = "SPAM"
CATEGORY_PERSONAL = "PERSONAL"
CATEGORY_OTHER = "OTHER"

ALL_CATEGORIES = [
    CATEGORY_HR_RECRUITER,
    CATEGORY_INTERVIEW_INVITATION,
    CATEGORY_APPLICATION_CONFIRMATION,
    CATEGORY_ASSESSMENT,
    CATEGORY_REJECTION,
    CATEGORY_OFFER_RECEIVED,
    CATEGORY_JOB_ALERT,
    CATEGORY_MARKETING,
    CATEGORY_NEWSLETTER,
    CATEGORY_SPAM,
    CATEGORY_PERSONAL,
    CATEGORY_OTHER,
]

RELEVANT_HR_CATEGORIES = {
    CATEGORY_HR_RECRUITER,
    CATEGORY_INTERVIEW_INVITATION,
    CATEGORY_APPLICATION_CONFIRMATION,
    CATEGORY_ASSESSMENT,
    CATEGORY_REJECTION,
    CATEGORY_OFFER_RECEIVED,
}


class HRInbox(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    gmail_message_id: str
    gmail_thread_id: Optional[str] = None
    email_account_id: Optional[str] = None

    # Sender / Recipient info
    sender_name: str = ""
    sender_email: str
    to_email: str = ""

    # Content
    subject: str = "No subject"
    body_preview: str = ""
    body_html: str = ""
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Classification details
    category: str = CATEGORY_OTHER
    confidence_score: float = 0.0  # 0.0 to 1.0
    is_relevant: bool = False
    needs_manual_review: bool = False
    classification_reasoning: str = ""
    manual_category_override: Optional[str] = None

    # Context enrichment
    company: Optional[str] = None
    job_title: Optional[str] = None
    application_id: Optional[str] = None

    # Status & flags
    is_read: bool = False
    is_archived: bool = False
    labels: List[str] = Field(default_factory=list)
    raw_headers: Dict[str, str] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "hr_inbox"
        indexes = [
            # Compound unique constraint on userId + gmailMessageId (Requirements 6 & 14)
            IndexModel(
                [("user_id", ASCENDING), ("gmail_message_id", ASCENDING)],
                unique=True,
                name="uniq_user_gmail_message"
            ),
            IndexModel([("tenant_id", ASCENDING), ("user_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("category", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("is_relevant", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("is_read", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("needs_manual_review", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("received_at", DESCENDING)]),
        ]
