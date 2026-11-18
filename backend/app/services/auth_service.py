"""Authentication service managing user signup, login, and rotating refresh tokens."""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from app.core.config import get_settings
from app.core.errors import AppError, ConflictError, UnauthorizedError, NotFoundError
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.settings import TenantSettings
from app.models.profile import Profile
from app.repositories.domain import TenantRepo, UserRepo, RefreshTokenRepo, AuditRepo

log = get_logger("auth_service")
settings = get_settings()


class AuthService:
    @staticmethod
    async def signup(email: str, password: str, full_name: str = "", org_name: str = "") -> Tuple[User, str, str]:
        """Sign up a new user and organization tenant."""
        clean_email = email.lower().strip()
        existing = await UserRepo.find_by_email_global(clean_email)
        if existing:
            raise ConflictError("User with this email already exists")

        # 1. Create Tenant
        t_name = org_name.strip() or f"{full_name.strip() or clean_email.split('@')[0]}'s Workspace"
        tenant = await TenantRepo.create(name=t_name)

        # 2. Create Owner User
        hashed = get_password_hash(password)
        user = User(
            tenant_id=tenant.id,
            email=clean_email,
            hashed_password=hashed,
            full_name=full_name.strip(),
            role="owner"
        )
        await user.insert()

        # 3. Create Tenant Settings & Master Profile Defaults
        settings_doc = TenantSettings(
            tenant_id=tenant.id,
            signature=full_name.strip() or clean_email.split('@')[0]
        )
        await settings_doc.insert()

        profile_doc = Profile(
            tenant_id=tenant.id,
            name=full_name.strip() or clean_email.split('@')[0],
            email=clean_email
        )
        await profile_doc.insert()

        # 4. Generate Tokens
        access_token, refresh_token = await AuthService._create_token_pair(user)

        # 5. Audit Log
        audit_repo = AuditRepo(tenant.id)
        await audit_repo.log_action("signup", user_id=user.id, details={"email": clean_email})
        log.info("user_signup", email=clean_email, tenant_id=tenant.id)

        return user, access_token, refresh_token

    @staticmethod
    async def login(email: str, password: str, ip_address: Optional[str] = None) -> Tuple[User, str, str]:
        """Authenticate user and issue token pair."""
        clean_email = email.lower().strip()
        user = await UserRepo.find_by_email_global(clean_email)
        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedError("User account is disabled")

        access_token, refresh_token = await AuthService._create_token_pair(user)

        audit_repo = AuditRepo(user.tenant_id)
        await audit_repo.log_action("login", user_id=user.id, ip_address=ip_address, details={"email": clean_email})
        log.info("user_login", email=clean_email, user_id=user.id, tenant_id=user.tenant_id)

        return user, access_token, refresh_token

    @staticmethod
    async def refresh(refresh_token_str: str) -> Tuple[User, str, str]:
        """Rotate refresh token: revoke used token, return new access and refresh token."""
        try:
            payload = decode_token(refresh_token_str)
        except Exception:
            raise UnauthorizedError("Invalid or expired refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Token is not a refresh token")

        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        if not user_id or not tenant_id:
            raise UnauthorizedError("Malformed token payload")

        t_hash = hash_token(refresh_token_str)
        token_doc = await RefreshTokenRepo.get_by_hash_global(t_hash)
        if not token_doc:
            raise UnauthorizedError("Refresh token not found or revoked")

        if token_doc.revoked:
            # Token reuse detected! Revoke all tokens for user as a security measure
            rf_repo = RefreshTokenRepo(tenant_id)
            await rf_repo.revoke_user_tokens(user_id)
            log.warning("token_reuse_detected", user_id=user_id, tenant_id=tenant_id)
            raise UnauthorizedError("Refresh token revoked due to reuse")

        exp_at = token_doc.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)
        if exp_at < datetime.now(timezone.utc):
            token_doc.revoked = True
            await token_doc.save()
            raise UnauthorizedError("Refresh token has expired")

        user = await User.get(user_id)
        if not user or not user.is_active or user.tenant_id != tenant_id:
            raise UnauthorizedError("User not found or inactive")

        # Rotate: Mark old token revoked and issue new pair
        new_access, new_refresh = await AuthService._create_token_pair(user)
        token_doc.revoked = True
        token_doc.replaced_by = hash_token(new_refresh)
        await token_doc.save()

        log.info("token_refreshed", user_id=user.id, tenant_id=tenant_id)
        return user, new_access, new_refresh

    @staticmethod
    async def _create_token_pair(user: User) -> Tuple[str, str]:
        token_payload = {
            "sub": user.id,
            "tenant_id": user.tenant_id,
            "email": user.email,
            "role": user.role
        }
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)

        # Store refresh token hash
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        rt_doc = RefreshToken(
            tenant_id=user.tenant_id,
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at
        )
        await rt_doc.insert()

        return access_token, refresh_token
