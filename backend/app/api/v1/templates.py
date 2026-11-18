"""Email templates API router."""
from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import get_template_repo
from app.core.errors import NotFoundError
from app.repositories.domain import TemplateRepo
from app.schemas.domain import (
    TemplateCreateRequest,
    TemplateResponse,
    TemplateUpdateRequest,
)

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.get("", response_model=List[TemplateResponse])
async def list_templates(repo: TemplateRepo = Depends(get_template_repo)):
    """List templates available to tenant including global seed templates."""
    templates = await repo.list_for_tenant_with_globals()
    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            subject=t.subject,
            body=t.body,
            global_template=t.global_template
        )
        for t in templates
    ]


@router.post("", response_model=TemplateResponse)
async def create_template(
    body: TemplateCreateRequest,
    repo: TemplateRepo = Depends(get_template_repo)
):
    """Create a tenant-specific email template."""
    t = await repo.create(
        name=body.name,
        subject=body.subject,
        body=body.body,
        global_template=False
    )
    return TemplateResponse(
        id=t.id,
        name=t.name,
        subject=t.subject,
        body=t.body,
        global_template=False
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    body: TemplateUpdateRequest,
    repo: TemplateRepo = Depends(get_template_repo)
):
    """Update an existing template."""
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await repo.update(template_id, **update_data)
    if not updated:
        raise NotFoundError("Template not found or cannot be modified")
    return TemplateResponse(
        id=updated.id,
        name=updated.name,
        subject=updated.subject,
        body=updated.body,
        global_template=updated.global_template
    )


@router.post("/{template_id}/clone", response_model=TemplateResponse)
async def clone_template(
    template_id: str,
    repo: TemplateRepo = Depends(get_template_repo)
):
    """Clone an existing template into tenant's custom templates."""
    cloned = await repo.clone_template(template_id)
    if not cloned:
        raise NotFoundError("Template not found")
    return TemplateResponse(
        id=cloned.id,
        name=cloned.name,
        subject=cloned.subject,
        body=cloned.body,
        global_template=False
    )


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    repo: TemplateRepo = Depends(get_template_repo)
):
    """Delete a tenant-specific template."""
    deleted = await repo.delete(template_id)
    if not deleted:
        raise NotFoundError("Template not found or cannot be deleted")
    return {"status": "ok", "deleted": True}
