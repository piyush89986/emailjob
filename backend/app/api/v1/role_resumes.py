"""Role-based Resume management API with Cloudinary & local storage support."""
import io
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, Response, status
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import get_current_user, get_role_resume_repo, security
from app.core.security import decode_token
from app.core.errors import AppError, NotFoundError
from app.core.logging import get_logger
from app.models.role_resume import RoleResume
from app.models.user import User
from app.repositories.domain import RoleResumeRepo
from app.services.cloudinary_service import CloudinaryService
from app.services.storage_service import StorageService

log = get_logger("role_resumes")
router = APIRouter(prefix="/role-resumes", tags=["Role Resumes"])


@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
async def list_role_resumes(
    role: Optional[str] = None,
    repo: RoleResumeRepo = Depends(get_role_resume_repo),
    user: User = Depends(get_current_user)
):
    """List all role-based resumes for current tenant."""
    if role:
        items = await repo.find_by_role(role)
    else:
        items = await repo.list_by_tenant()

    return [
        {
            "id": item.id,
            "role": item.role,
            "filename": item.filename,
            "contentType": item.content_type,
            "sizeBytes": item.size_bytes,
            "url": item.url,
            "storageType": item.storage_type,
            "attachmentId": item.attachment_id,
            "isDefault": item.is_default,
            "notes": item.notes,
            "createdAt": item.created_at.isoformat(),
            "updatedAt": item.updated_at.isoformat()
        }
        for item in items
    ]


@router.get("/status")
async def get_storage_status(user: User = Depends(get_current_user)):
    """Check storage provider configuration status."""
    return {
        "cloudinaryConfigured": CloudinaryService.is_configured(),
        "localStorageAvailable": True
    }


@router.post("/upload")
async def upload_role_resume(
    file: UploadFile = File(...),
    role: str = Form(...),
    is_default: bool = Form(False),
    notes: Optional[str] = Form(None),
    repo: RoleResumeRepo = Depends(get_role_resume_repo),
    user: User = Depends(get_current_user)
):
    """Upload resume for a target job role (Cloudinary or local storage fallback)."""
    clean_role = role.strip()
    if not clean_role:
        raise AppError("Job role is required", status_code=400)

    filename = file.filename or "resume.pdf"
    content_type = file.content_type or "application/pdf"
    file_bytes = await file.read()
    size_bytes = len(file_bytes)

    if size_bytes == 0:
        raise AppError("File is empty", status_code=400)

    if size_bytes > 15 * 1024 * 1024:
        raise AppError("File size exceeds 15MB limit", status_code=400)

    # 1. Try Cloudinary upload if configured
    cloud_res = None
    if CloudinaryService.is_configured():
        cloud_res = CloudinaryService.upload_resume(file_bytes, filename, user.tenant_id, clean_role)

    storage_type = "cloudinary" if cloud_res else "local"
    cloudinary_public_id = cloud_res.get("public_id") if cloud_res else None
    attachment_id = None

    if cloud_res:
        url = cloud_res["url"]
    else:
        # Fallback to local MongoDB storage
        att = await StorageService.save_attachment(
            tenant_id=user.tenant_id,
            filename=filename,
            content_type=content_type,
            data=file_bytes
        )
        attachment_id = att.id
        url = f"/role-resumes/{attachment_id}/file"

    # If is_default, clear previous defaults for this role
    if is_default:
        await repo.clear_default_for_role(clean_role)

    # Create record
    doc = await repo.create(
        role=clean_role,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        url=url,
        storage_type=storage_type,
        cloudinary_public_id=cloudinary_public_id,
        attachment_id=attachment_id,
        is_default=is_default,
        notes=notes
    )

    if storage_type == "local":
        doc.url = f"/role-resumes/{doc.id}/file"
        await doc.save()

    return {
        "id": doc.id,
        "role": doc.role,
        "filename": doc.filename,
        "contentType": doc.content_type,
        "sizeBytes": doc.size_bytes,
        "url": doc.url,
        "storageType": doc.storage_type,
        "attachmentId": doc.attachment_id,
        "isDefault": doc.is_default,
        "notes": doc.notes,
        "createdAt": doc.created_at.isoformat(),
        "updatedAt": doc.updated_at.isoformat()
    }


@router.get("/{resume_id}/file")
async def download_resume_file(
    resume_id: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """View or download resume file."""
    auth_token = credentials.credentials if credentials and credentials.credentials else token
    tenant_id = None
    if auth_token:
        try:
            payload = decode_token(auth_token)
            tenant_id = payload.get("tenant_id")
        except Exception:
            pass

    doc = await RoleResume.get(resume_id)
    if not doc:
        raise NotFoundError("Resume not found")

    if doc.storage_type == "cloudinary" and doc.url and doc.url.startswith("http"):
        return RedirectResponse(url=doc.url)

    target_tenant = tenant_id or doc.tenant_id
    att_id = doc.attachment_id or doc.id
    att_data = await StorageService.get_attachment_data(target_tenant, att_id)
    if not att_data:
        if doc.url and doc.url.startswith("http"):
            return RedirectResponse(url=doc.url)
        raise NotFoundError("Resume file data not found")

    fname, ctype, data = att_data
    return StreamingResponse(
        io.BytesIO(data),
        media_type=ctype,
        headers={"Content-Disposition": f'inline; filename="{fname}"'}
    )


@router.delete("/{resume_id}")
async def delete_role_resume(
    resume_id: str,
    repo: RoleResumeRepo = Depends(get_role_resume_repo),
    user: User = Depends(get_current_user)
):
    """Delete role resume."""
    doc = await repo.get_by_id(resume_id)
    if not doc:
        raise NotFoundError("Resume not found")

    if doc.cloudinary_public_id:
        CloudinaryService.delete_file(doc.cloudinary_public_id)

    await repo.delete(resume_id)
    return {"status": "ok", "deleted": resume_id}


@router.patch("/{resume_id}/default")
async def set_default_resume(
    resume_id: str,
    repo: RoleResumeRepo = Depends(get_role_resume_repo),
    user: User = Depends(get_current_user)
):
    """Set resume as default for its role."""
    doc = await repo.get_by_id(resume_id)
    if not doc:
        raise NotFoundError("Resume not found")

    await repo.clear_default_for_role(doc.role)
    doc.is_default = True
    await doc.save()
    return {"status": "ok", "id": doc.id, "role": doc.role, "isDefault": True}
