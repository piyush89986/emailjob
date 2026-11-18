"""Account export and GDPR data purge API router."""
from typing import Any, Dict
from fastapi import APIRouter, Depends
from app.api.deps import (
    get_account_repo,
    get_application_repo,
    get_audit_repo,
    get_contact_repo,
    get_current_active_owner,
    get_message_repo,
    get_profile_repo,
    get_resume_repo,
    get_settings_repo,
    get_template_repo,
    get_thread_repo,
)
from app.models.user import User
from app.repositories.domain import (
    AccountRepo,
    ApplicationRepo,
    AuditRepo,
    ContactRepo,
    MessageRepo,
    ProfileRepo,
    ResumeRepo,
    SettingsRepo,
    TemplateRepo,
    TenantRepo,
    ThreadRepo,
)

router = APIRouter(prefix="/account", tags=["Account Management"])


@router.get("/export")
async def export_tenant_data(
    user: User = Depends(get_current_active_owner),
    contact_repo: ContactRepo = Depends(get_contact_repo),
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo),
    tpl_repo: TemplateRepo = Depends(get_template_repo),
    app_repo: ApplicationRepo = Depends(get_application_repo),
    profile_repo: ProfileRepo = Depends(get_profile_repo),
    settings_repo: SettingsRepo = Depends(get_settings_repo),
    resume_repo: ResumeRepo = Depends(get_resume_repo),
    audit_repo: AuditRepo = Depends(get_audit_repo)
) -> Dict[str, Any]:
    """Export all tenant data cleanly formatted as JSON, excluding secrets and tokens."""
    contacts = await contact_repo.find_all()
    threads = await thread_repo.find_all()
    templates = await tpl_repo.find_all()
    apps = await app_repo.find_all()
    profile = await profile_repo.get_or_create()
    settings = await settings_repo.get_or_create()
    resumes = await resume_repo.find_all()

    # Log audit
    await audit_repo.log_action("export_data", user_id=user.id)

    return {
        "tenantId": user.tenant_id,
        "exportedAt": user.created_at.isoformat(),
        "user": {"email": user.email, "name": user.full_name},
        "contacts": [c.model_dump(exclude={"tenant_id"}) for c in contacts],
        "threads": [t.model_dump(exclude={"tenant_id"}) for t in threads],
        "templates": [t.model_dump(exclude={"tenant_id"}) for t in templates],
        "applications": [a.model_dump(exclude={"tenant_id"}) for a in apps],
        "profile": profile.model_dump(exclude={"tenant_id", "id"}),
        "settings": settings.model_dump(exclude={"tenant_id", "id"}),
        "resumes": [r.model_dump(exclude={"tenant_id"}) for r in resumes]
    }


@router.delete("/data")
async def delete_tenant_data(
    user: User = Depends(get_current_active_owner),
    acc_repo: AccountRepo = Depends(get_account_repo),
    contact_repo: ContactRepo = Depends(get_contact_repo),
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo),
    tpl_repo: TemplateRepo = Depends(get_template_repo),
    app_repo: ApplicationRepo = Depends(get_application_repo),
    profile_repo: ProfileRepo = Depends(get_profile_repo),
    settings_repo: SettingsRepo = Depends(get_settings_repo),
    resume_repo: ResumeRepo = Depends(get_resume_repo),
    audit_repo: AuditRepo = Depends(get_audit_repo)
):
    """Hard delete all tenant records and disconnect mailboxes."""
    tenant_id = user.tenant_id

    # Record final audit before purge
    await audit_repo.log_action("delete_tenant", user_id=user.id)

    # Purge all collections for tenant
    await acc_repo.delete_all_for_tenant()
    await contact_repo.delete_all_for_tenant()
    await thread_repo.delete_all_for_tenant()
    await msg_repo.delete_all_for_tenant()
    await tpl_repo.delete_all_for_tenant()
    await app_repo.delete_all_for_tenant()
    await profile_repo.delete_all_for_tenant()
    await settings_repo.delete_all_for_tenant()
    await resume_repo.delete_all_for_tenant()
    await TenantRepo.delete(tenant_id)

    return {"status": "ok", "message": "All tenant data permanently erased."}
