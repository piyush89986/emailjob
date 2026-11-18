"""Tests for symmetric encryption of credentials at rest."""
import json
import pytest
from app.core.security import decrypt_secret, encrypt_secret
from app.models.account import EmailAccount


def test_encryption_roundtrip():
    """Test Fernet encryption and decryption."""
    secret = "my-super-secret-oauth-refresh-token-12345"
    encrypted = encrypt_secret(secret)
    assert encrypted != secret
    assert len(encrypted) > len(secret)

    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret


@pytest.mark.asyncio
async def test_credentials_never_exposed_in_api(async_client, tenant_a, auth_headers_a):
    """Prove that encrypted credentials and tokens never appear in API responses."""
    secret_token = "ultra_confidential_oauth_token_xyz"
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="gmail",
        address="user@gmail.com",
        encrypted_creds=encrypt_secret(json.dumps({"token": secret_token})),
        status="connected",
        is_default=True
    )
    await acc.insert()

    # 1. Accounts list endpoint
    resp = await async_client.get("/accounts", headers=auth_headers_a)
    assert resp.status_code == 200
    accounts_json = resp.text
    assert secret_token not in accounts_json
    assert "encrypted_creds" not in accounts_json

    # 2. Data export endpoint
    export_resp = await async_client.get("/account/export", headers=auth_headers_a)
    assert export_resp.status_code == 200
    export_json = export_resp.text
    assert secret_token not in export_json
    assert "encrypted_creds" not in export_json
