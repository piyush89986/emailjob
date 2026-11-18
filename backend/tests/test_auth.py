"""Tests for authentication, password hashing, and rotating refresh tokens."""
from datetime import datetime, timezone, timedelta
import pytest
from app.core.security import create_refresh_token, hash_token
from app.models.refresh_token import RefreshToken
from app.services.auth_service import AuthService


@pytest.mark.asyncio
async def test_signup_creates_tenant_and_owner(async_client):
    """Test user signup initializes organization and owner user."""
    resp = await async_client.post(
        "/auth/signup",
        json={
            "name": "Jane Doe",
            "email": "jane@startup.io",
            "password": "securepassword123",
            "org": "Jane's Org"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "accessToken" in data or "access_token" in data
    assert "refreshToken" in data or "refresh_token" in data


@pytest.mark.asyncio
async def test_duplicate_signup_fails(async_client):
    """Test signing up with existing email returns 409 conflict."""
    body = {"name": "Test User", "email": "test@dup.com", "password": "password123"}
    resp1 = await async_client.post("/auth/signup", json=body)
    assert resp1.status_code == 200

    resp2 = await async_client.post("/auth/signup", json=body)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success_and_invalid_password(async_client):
    """Test login credentials validation."""
    await async_client.post(
        "/auth/signup",
        json={"name": "Alice", "email": "alice@corp.com", "password": "correctpassword1"}
    )

    # Valid login
    resp_ok = await async_client.post(
        "/auth/login",
        json={"email": "alice@corp.com", "password": "correctpassword1"}
    )
    assert resp_ok.status_code == 200
    tokens = resp_ok.json()
    assert "accessToken" in tokens or "access_token" in tokens

    # Invalid password
    resp_bad = await async_client.post(
        "/auth/login",
        json={"email": "alice@corp.com", "password": "wrongpassword"}
    )
    assert resp_bad.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation(async_client):
    """Test rotating refresh token: old token is revoked, new token issued."""
    res_signup = await async_client.post(
        "/auth/signup",
        json={"name": "Rotator", "email": "rotator@domain.com", "password": "password1234"}
    )
    tokens = res_signup.json()
    old_refresh = tokens.get("refreshToken") or tokens.get("refresh_token")

    # First refresh succeeds
    res_ref1 = await async_client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert res_ref1.status_code == 200
    new_tokens = res_ref1.json()
    new_refresh = new_tokens.get("refreshToken") or new_tokens.get("refresh_token")
    assert new_refresh != old_refresh

    # Reusing the old refresh token must be rejected (revoked due to rotation)
    res_reuse = await async_client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert res_reuse.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_rejected(async_client, tenant_a):
    """Test expired refresh token is rejected."""
    # Create expired token
    user = tenant_a["user"]
    expired_token = create_refresh_token(
        {"sub": user.id, "tenant_id": user.tenant_id, "type": "refresh"},
        expires_delta=timedelta(seconds=-10)
    )
    rt_doc = RefreshToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        token_hash=hash_token(expired_token),
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=10)
    )
    await rt_doc.insert()

    resp = await async_client.post("/auth/refresh", json={"refresh_token": expired_token})
    assert resp.status_code == 401
