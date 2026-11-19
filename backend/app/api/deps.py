"""FastAPI dependency injection for authentication, tenancy, and repositories."""
from typing import Optional
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.models.user import User
from app.repositories.domain import (
    AccountRepo,
    ApplicationRepo,
    AuditRepo,
    ContactRepo,
    MessageRepo,
    ProfileRepo,
    ResumeRepo,
    RoleResumeRepo,
    SettingsRepo,
    TemplateRepo,
    ThreadRepo,
    UserRepo,
)

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Resolve and validate the current authenticated user from JWT Bearer token."""
    if not credentials or not credentials.credentials:
        raise UnauthorizedError("Authentication token is missing")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise UnauthorizedError("Invalid or expired token")

    if payload.get("type") != "access":
        raise UnauthorizedError("Token is not an access token")

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise UnauthorizedError("Invalid token claims")

    user = await User.get(user_id)
    if not user or not user.is_active or user.tenant_id != tenant_id:
        raise UnauthorizedError("User not found or inactive")

    return user


async def get_current_active_owner(user: User = Depends(get_current_user)) -> User:
    """Require owner role."""
    if user.role != "owner":
        raise ForbiddenError("Action requires organization owner role")
    return user


# --- Repository Injections Scoped to Authenticated Tenant ---
def get_account_repo(user: User = Depends(get_current_user)) -> AccountRepo:
    return AccountRepo(user.tenant_id)


def get_contact_repo(user: User = Depends(get_current_user)) -> ContactRepo:
    return ContactRepo(user.tenant_id)


def get_thread_repo(user: User = Depends(get_current_user)) -> ThreadRepo:
    return ThreadRepo(user.tenant_id)


def get_message_repo(user: User = Depends(get_current_user)) -> MessageRepo:
    return MessageRepo(user.tenant_id)


def get_template_repo(user: User = Depends(get_current_user)) -> TemplateRepo:
    return TemplateRepo(user.tenant_id)


def get_application_repo(user: User = Depends(get_current_user)) -> ApplicationRepo:
    return ApplicationRepo(user.tenant_id)


def get_profile_repo(user: User = Depends(get_current_user)) -> ProfileRepo:
    return ProfileRepo(user.tenant_id)


def get_settings_repo(user: User = Depends(get_current_user)) -> SettingsRepo:
    return SettingsRepo(user.tenant_id)


def get_resume_repo(user: User = Depends(get_current_user)) -> ResumeRepo:
    return ResumeRepo(user.tenant_id)


def get_role_resume_repo(user: User = Depends(get_current_user)) -> RoleResumeRepo:
    return RoleResumeRepo(user.tenant_id)


def get_audit_repo(user: User = Depends(get_current_user)) -> AuditRepo:
    return AuditRepo(user.tenant_id)
