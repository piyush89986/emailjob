"""Pydantic request and response schemas matching the frontend contract."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import Field, EmailStr
from app.schemas.base import CamelModel


# --- Auth & User ---
class SignupRequest(CamelModel):
    name: str = ""
    email: EmailStr
    password: str = Field(min_length=8)
    org: Optional[str] = None


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(alias="refresh_token")


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(CamelModel):
    id: str
    email: str
    name: str
    role: str
    tenant_id: str


# --- Email Accounts ---
class AccountResponse(CamelModel):
    id: str
    provider: Literal["gmail", "outlook", "imap"]
    address: str
    status: Literal["connected", "error", "needs_reauth"]
    is_default: bool = Field(alias="isDefault")


class ImapTestRequest(CamelModel):
    host: str
    port: str = "993"
    ssl: bool = True
    user: str
    pass_: str = Field(alias="pass")


class ImapConnectRequest(CamelModel):
    host: str
    port: str = "993"
    ssl: bool = True
    user: str
    pass_: str = Field(alias="pass")
    address: Optional[str] = None


# --- Contacts ---
ContactStatus = Literal["Contacted", "Replied", "Interview", "Offer", "Rejected"]


class ContactResponse(CamelModel):
    id: str
    name: str
    email: str
    company: str
    status: ContactStatus
    last_replied_at: Optional[str] = Field(default=None, alias="lastRepliedAt")
    created_at: str = Field(alias="createdAt")


class ContactCreateRequest(CamelModel):
    name: str
    email: EmailStr
    company: str = ""
    status: ContactStatus = "Contacted"


class ContactStatusUpdate(CamelModel):
    status: ContactStatus


# --- Messages & Threads ---
class MsgResponse(CamelModel):
    id: str
    dir: Literal["in", "out"]
    from_addr: str = Field(alias="from")
    body: str
    at: str
    kind: Literal["normal", "auto", "bounce"]
    delivery: Optional[Literal["sent", "failed", "sending"]] = None


class ThreadResponse(CamelModel):
    id: str
    subject: str
    contact_id: str = Field(alias="contactId")
    unread: bool
    messages: List[MsgResponse] = Field(default_factory=list)


class SendEmailRequest(CamelModel):
    to: str  # Comma separated or single email
    subject: str
    body: str = Field(alias="body")  # May also be accepted as bodyHtml
    body_html: Optional[str] = Field(default=None, alias="bodyHtml")
    attachment_ids: List[str] = Field(default_factory=list, alias="attachmentIds")
    thread_id: Optional[str] = Field(default=None, alias="threadId")
    template_id: Optional[str] = Field(default=None, alias="templateId")

    def get_body(self) -> str:
        return self.body_html or self.body


# --- Templates ---
class TemplateResponse(CamelModel):
    id: str
    name: str
    subject: str
    body: str
    global_template: bool = Field(alias="global")


class TemplateCreateRequest(CamelModel):
    name: str
    subject: str
    body: str


class TemplateUpdateRequest(CamelModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


# --- Applications ---
ApplicationStatus = Literal[
    "Saved", "Applied", "Contacted", "Replied", "Interview", "Offer", "Rejected",
    "Draft", "Ready to Apply", "Email Sent", "Email Delivered",
    "Response Received", "Interview Scheduled", "Assessment", "Offer Received", "Withdrawn"
]


class TimelineEntry(CamelModel):
    at: str
    label: str


class ApplicationResponse(CamelModel):
    id: str
    title: str
    company: str
    jd: str = ""
    jd_url: str = Field(default="", alias="jdUrl")
    contact_id: str = Field(default="", alias="contactId")
    resume: str = "v1"
    status: ApplicationStatus = "Saved"
    hr_email: Optional[str] = Field(default=None, alias="hrEmail")
    location: Optional[str] = None
    salary_range: Optional[str] = Field(default=None, alias="salaryRange")
    match_score: Optional[int] = Field(default=None, alias="matchScore")
    job_poster_url: Optional[str] = Field(default=None, alias="jobPosterUrl")
    email_subject: Optional[str] = Field(default=None, alias="emailSubject")
    email_body: Optional[str] = Field(default=None, alias="emailBody")
    gmail_thread_id: Optional[str] = Field(default=None, alias="gmailThreadId")
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    timeline: List[TimelineEntry] = Field(default_factory=list)


class ApplicationCreateRequest(CamelModel):
    title: str
    company: str
    jd: str = ""
    jd_url: str = Field(default="", alias="jdUrl")
    contact_id: str = Field(default="", alias="contactId")
    resume: str = "v1"
    status: ApplicationStatus = "Saved"


class ApplicationStatusUpdate(CamelModel):
    status: ApplicationStatus


# --- Settings & Profile ---
class PrefsResponse(CamelModel):
    tone: Literal["formal", "friendly", "concise"]
    provider: Literal["openai", "gemini"]
    fallback: bool
    daily_cap: int = Field(alias="dailyCap")
    delay_sec: int = Field(alias="delaySec")
    dnc: List[str]
    signature: str


class PrefsUpdateRequest(CamelModel):
    tone: Optional[Literal["formal", "friendly", "concise"]] = None
    provider: Optional[Literal["openai", "gemini"]] = None
    fallback: Optional[bool] = None
    daily_cap: Optional[int] = Field(default=None, alias="dailyCap")
    delay_sec: Optional[int] = Field(default=None, alias="delaySec")
    signature: Optional[str] = None


class DncRequest(CamelModel):
    email: str


class ExpItem(CamelModel):
    id: str
    company: str
    role: str
    period: str
    bullets: List[str]


class ProfileResponse(CamelModel):
    name: str
    email: str
    headline: str
    skills: List[str]
    experience: List[ExpItem]
    projects: List[ExpItem]
    education: str
    links: str


class ProfileUpdateRequest(CamelModel):
    name: Optional[str] = None
    email: Optional[str] = None
    headline: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[ExpItem]] = None
    projects: Optional[List[ExpItem]] = None
    education: Optional[str] = None
    links: Optional[str] = None


# --- AI Endpoints ---
class ExtractJdRequest(CamelModel):
    text: Optional[str] = None
    url: Optional[str] = None


class ExtractJdResponse(CamelModel):
    role: str
    company: str
    hr: str
    location: str
    skills: List[str]


class DraftEmailRequest(CamelModel):
    jd: str
    tone: str = "friendly"
    template_id: Optional[str] = Field(default=None, alias="templateId")


class DraftVariant(CamelModel):
    label: str
    subject: str
    body: str


class TailorResumeRequest(CamelModel):
    jd: str


class TailorResumeResponse(CamelModel):
    experience: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    skills: List[str]
    ats: int
    matched: List[str]
    missing: List[str]
    verified: int
    unsupported: List[str]


class ResumeSaveRequest(CamelModel):
    application_id: Optional[str] = Field(default=None, alias="applicationId")
    label: str
    text: str
    ats: int


class ResumeVersionResponse(CamelModel):
    id: str
    label: str
    at: str
    ats: int
    text: str


# --- Dashboard ---
class DashboardStatsResponse(CamelModel):
    sent_this_week: int = Field(alias="sentThisWeek")
    reply_rate: str = Field(alias="replyRate")
    awaiting_reply: int = Field(alias="awaitingReply")
    interviews: int


class FollowupItem(CamelModel):
    id: str
    subject: str
    contact_name: str = Field(alias="contactName")
    contact_id: str = Field(alias="contactId")
    days_waiting: int = Field(alias="daysWaiting")


class DashboardFollowupsResponse(CamelModel):
    followups: List[FollowupItem]
    waiting_count: int = Field(alias="waitingCount")
