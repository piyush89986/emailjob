"""Email accounts management service."""
import json
from typing import Any, Dict, List, Optional
import httpx
import msal
from app.core.config import get_settings
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.events import publish_event
from app.core.logging import get_logger
from app.core.security import encrypt_secret
from app.models.account import EmailAccount
from app.repositories.domain import AccountRepo, AuditRepo
from app.services.providers import get_email_provider
from app.services.providers.imap_smtp_provider import ImapSmtpProvider

log = get_logger("account_service")
settings = get_settings()


class AccountService:
    @staticmethod
    def get_oauth_start_url(provider: str, tenant_id: str, return_url: Optional[str] = None) -> str:
        """Generate OAuth authorization redirect URL."""
        state_payload = f"{tenant_id}|{return_url}" if return_url else tenant_id
        if provider == "gmail":
            scopes = [
                "https://mail.google.com/",
                "https://www.googleapis.com/auth/userinfo.email"
            ]
            params = {
                "client_id": settings.google_client_id,
                "redirect_uri": settings.google_redirect_uri,
                "response_type": "code",
                "scope": " ".join(scopes),
                "access_type": "offline",
                "prompt": "consent",
                "state": state_payload
            }
            query = "&".join(f"{k}={v}" for k, v in params.items())
            return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

        elif provider == "outlook":
            cca = msal.ConfidentialClientApplication(
                settings.ms_client_id,
                authority=f"https://login.microsoftonline.com/{settings.ms_tenant_id}",
                client_credential=settings.ms_client_secret
            )
            scopes = [
                "offline_access",
                "https://graph.microsoft.com/Mail.ReadWrite",
                "https://graph.microsoft.com/Mail.Send",
                "https://graph.microsoft.com/User.Read"
            ]
            return cca.get_authorization_request_url(
                scopes=scopes,
                state=state_payload,
                redirect_uri=settings.ms_redirect_uri
            )
        else:
            raise AppError(f"Unsupported OAuth provider: {provider}", status_code=400)

    @staticmethod
    async def handle_oauth_callback(provider: str, code: str, tenant_id: str) -> EmailAccount:
        """Exchange OAuth code for tokens and persist encrypted account."""
        repo = AccountRepo(tenant_id)
        creds_data: Dict[str, Any] = {}
        email_address = ""

        if provider == "gmail":
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": settings.google_client_id,
                        "client_secret": settings.google_client_secret,
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": settings.google_redirect_uri
                    },
                    timeout=15.0
                )
                if resp.status_code != 200:
                    raise AppError(f"Google token exchange failed: {resp.text}", status_code=502)
                creds_data = resp.json()

                # Get email
                userinfo = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {creds_data.get('access_token')}"}
                )
                if userinfo.status_code == 200:
                    email_address = userinfo.json().get("email", "")

        elif provider == "outlook":
            cca = msal.ConfidentialClientApplication(
                settings.ms_client_id,
                authority=f"https://login.microsoftonline.com/{settings.ms_tenant_id}",
                client_credential=settings.ms_client_secret
            )
            result = cca.acquire_token_by_authorization_code(
                code=code,
                scopes=[
                    "offline_access",
                    "https://graph.microsoft.com/Mail.ReadWrite",
                    "https://graph.microsoft.com/Mail.Send",
                    "https://graph.microsoft.com/User.Read"
                ],
                redirect_uri=settings.ms_redirect_uri
            )
            if "error" in result:
                raise AppError(f"Microsoft token exchange failed: {result.get('error_description')}", status_code=502)
            creds_data = result
            email_address = result.get("id_token_claims", {}).get("preferred_username") or ""
        else:
            raise AppError("Invalid provider", status_code=400)

        if not email_address:
            email_address = f"connected_{provider}@jobmail.app"

        # Check existing account
        existing = await repo.find_by_address(email_address)
        is_first = (await repo.count()) == 0

        encrypted = encrypt_secret(json.dumps(creds_data))
        if existing:
            account = await repo.update(
                existing.id,
                encrypted_creds=encrypted,
                status="connected",
                error_message=None
            )
        else:
            account = await repo.create(
                provider=provider,
                address=email_address,
                encrypted_creds=encrypted,
                status="connected",
                is_default=is_first
            )

        # Audit
        audit = AuditRepo(tenant_id)
        await audit.log_action("connect_mailbox", target_type="account", target_id=account.id, details={"address": email_address, "provider": provider})

        return account

    @staticmethod
    async def test_imap(host: str, port: str, ssl: bool, user: str, password: str) -> bool:
        """Test IMAP and SMTP connection with provided credentials."""
        provider = ImapSmtpProvider({
            "host": host,
            "port": port,
            "ssl": ssl,
            "user": user,
            "pass": password
        })
        return await provider.test_connection()

    @staticmethod
    async def connect_imap(tenant_id: str, host: str, port: str, ssl: bool, user: str, password: str, address: Optional[str] = None) -> EmailAccount:
        """Save verified IMAP account."""
        repo = AccountRepo(tenant_id)
        email_addr = (address or user).lower().strip()

        creds = {"host": host, "port": port, "ssl": ssl, "user": user, "pass": password}
        encrypted = encrypt_secret(json.dumps(creds))
        is_first = (await repo.count()) == 0

        existing = await repo.find_by_address(email_addr)
        if existing:
            account = await repo.update(existing.id, encrypted_creds=encrypted, status="connected", error_message=None)
        else:
            account = await repo.create(
                provider="imap",
                address=email_addr,
                encrypted_creds=encrypted,
                status="connected",
                is_default=is_first
            )

        audit = AuditRepo(tenant_id)
        await audit.log_action("connect_mailbox", target_type="account", target_id=account.id, details={"address": email_addr, "provider": "imap"})
        return account

    @staticmethod
    async def mark_needs_reauth(account_id: str, tenant_id: str, reason: str = "Token expired") -> None:
        """Set account to needs_reauth and emit SSE event for banner."""
        repo = AccountRepo(tenant_id)
        await repo.update(account_id, status="needs_reauth", error_message=reason)
        await publish_event(tenant_id, "account.needs_reauth", {
            "accountId": account_id,
            "reason": reason
        })
        log.warning("account_needs_reauth", account_id=account_id, tenant_id=tenant_id, reason=reason)
