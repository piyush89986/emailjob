"""Email accounts API router."""
from typing import List
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from app.api.deps import get_account_repo, get_audit_repo, get_current_user
from app.core.errors import NotFoundError
from app.models.user import User
from app.repositories.domain import AccountRepo, AuditRepo
from app.schemas.domain import (
    AccountResponse,
    ImapConnectRequest,
    ImapTestRequest,
)
from app.services.account_service import AccountService
from app.services.sync_service import SyncService

router = APIRouter(prefix="/accounts", tags=["Email Accounts"])


@router.get("", response_model=List[AccountResponse])
async def list_accounts(repo: AccountRepo = Depends(get_account_repo)):
    """List connected email accounts for current tenant."""
    accounts = await repo.find_all()
    return [
        AccountResponse(
            id=a.id,
            provider=a.provider,  # type: ignore
            address=a.address,
            status=a.status,  # type: ignore
            is_default=a.is_default
        )
        for a in accounts
    ]


@router.get("/oauth/{provider}/start")
async def start_oauth(
    provider: str,
    user: User = Depends(get_current_user)
):
    """Get OAuth authorization URL for Gmail or Outlook."""
    url = AccountService.get_oauth_start_url(provider, user.tenant_id)
    return {"url": url}


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...)
):
    """Handle OAuth redirect callback."""
    # State parameter carries tenant_id
    tenant_id = state
    await AccountService.handle_oauth_callback(provider, code, tenant_id)
    # Redirect back to frontend settings page
    settings_obj = get_settings()
    frontend_url = settings_obj.cors_list[0] if settings_obj.cors_list else "http://localhost:5173"
    return RedirectResponse(url=f"{frontend_url}/settings")


@router.post("/imap/test")
async def test_imap_connection(body: ImapTestRequest):
    """Test IMAP and SMTP connection parameters."""
    ok = await AccountService.test_imap(
        host=body.host,
        port=body.port,
        ssl=body.ssl,
        user=body.user,
        password=body.pass_
    )
    return {"status": "ok" if ok else "failed", "tested": ok}


@router.post("/imap", response_model=AccountResponse)
async def connect_imap_account(
    body: ImapConnectRequest,
    user: User = Depends(get_current_user)
):
    """Save verified IMAP account."""
    account = await AccountService.connect_imap(
        tenant_id=user.tenant_id,
        host=body.host,
        port=body.port,
        ssl=body.ssl,
        user=body.user,
        password=body.pass_,
        address=body.address
    )
    return AccountResponse(
        id=account.id,
        provider=account.provider,  # type: ignore
        address=account.address,
        status=account.status,  # type: ignore
        is_default=account.is_default
    )


@router.patch("/{account_id}/default", response_model=AccountResponse)
async def make_default_account(
    account_id: str,
    repo: AccountRepo = Depends(get_account_repo)
):
    """Set account as default sender."""
    updated = await repo.set_default(account_id)
    if not updated:
        raise NotFoundError("Account not found")
    return AccountResponse(
        id=updated.id,
        provider=updated.provider,  # type: ignore
        address=updated.address,
        status=updated.status,  # type: ignore
        is_default=updated.is_default
    )


@router.post("/{account_id}/reconnect", response_model=AccountResponse)
async def reconnect_account(
    account_id: str,
    repo: AccountRepo = Depends(get_account_repo)
):
    """Reset account status to connected."""
    updated = await repo.update(account_id, status="connected", error_message=None)
    if not updated:
        raise NotFoundError("Account not found")
    return AccountResponse(
        id=updated.id,
        provider=updated.provider,  # type: ignore
        address=updated.address,
        status=updated.status,  # type: ignore
        is_default=updated.is_default
    )


@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    repo: AccountRepo = Depends(get_account_repo),
    audit: AuditRepo = Depends(get_audit_repo),
    user: User = Depends(get_current_user)
):
    """Disconnect and delete email account."""
    acc = await repo.get_by_id(account_id)
    if not acc:
        raise NotFoundError("Account not found")
    await repo.delete(account_id)
    await audit.log_action("disconnect_mailbox", user_id=user.id, target_type="account", target_id=account_id)
    return {"status": "ok", "deleted": True}


@router.post("/{account_id}/sync")
async def sync_account_now(
    account_id: str,
    repo: AccountRepo = Depends(get_account_repo),
):
    """Trigger on-demand email sync for account."""
    acc = await repo.get_by_id(account_id)
    if not acc:
        raise NotFoundError("Account not found")
    count = await SyncService.sync_account(acc)
    return {"status": "ok", "synced": count}
