"""Authentication API router."""
from fastapi import APIRouter, Depends, Request
from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.rate_limit import rate_limit_dependency
from app.models.user import User
from app.schemas.domain import (
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_auth_per_minute))]
)
async def signup(body: SignupRequest):
    """Register tenant organization and owner user."""
    _, access_token, refresh_token = await AuthService.signup(
        email=body.email,
        password=body.password,
        full_name=body.name,
        org_name=body.org or ""
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_auth_per_minute))]
)
async def login(body: LoginRequest, request: Request):
    """Log in with email and password."""
    client_ip = request.client.host if request.client else None
    _, access_token, refresh_token = await AuthService.login(
        email=body.email,
        password=body.password,
        ip_address=client_ip
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_auth_per_minute))]
)
async def refresh_token(body: RefreshRequest):
    """Rotate refresh token and issue new access token."""
    _, access_token, refresh_token = await AuthService.refresh(body.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.full_name or user.email.split("@")[0],
        role=user.role,
        tenant_id=user.tenant_id
    )
