"""MongoDB Beanie Document models for JobMail."""
from app.models.tenant import Tenant
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.account import EmailAccount
from app.models.contact import Contact
from app.models.thread import Thread
from app.models.message import Message
from app.models.template import Template
from app.models.application import Application
from app.models.profile import Profile
from app.models.settings import TenantSettings
from app.models.resume import ResumeVersion
from app.models.role_resume import RoleResume
from app.models.attachment import Attachment
from app.models.audit_log import AuditLog
from app.models.job_poster import JobPoster
from app.models.workflow import AutomationWorkflow, WorkflowExecution

ALL_DOCUMENT_MODELS = [
    Tenant,
    User,
    RefreshToken,
    EmailAccount,
    Contact,
    Thread,
    Message,
    Template,
    Application,
    Profile,
    TenantSettings,
    ResumeVersion,
    RoleResume,
    Attachment,
    AuditLog,
    JobPoster,
    AutomationWorkflow,
    WorkflowExecution,
]

__all__ = [
    "Tenant",
    "User",
    "RefreshToken",
    "EmailAccount",
    "Contact",
    "Thread",
    "Message",
    "Template",
    "Application",
    "Profile",
    "TenantSettings",
    "ResumeVersion",
    "RoleResume",
    "Attachment",
    "AuditLog",
    "JobPoster",
    "AutomationWorkflow",
    "WorkflowExecution",
    "ALL_DOCUMENT_MODELS",
]
