"""AI endpoints for JD extraction, email drafting, resume tailoring, and export."""
from typing import List
from fastapi import APIRouter, Depends, Query, Response
from app.api.deps import get_current_user, get_profile_repo, get_resume_repo
from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.core.rate_limit import rate_limit_dependency
from app.models.user import User
from app.repositories.domain import ProfileRepo, ResumeRepo
from app.schemas.domain import (
    DraftEmailRequest,
    DraftVariant,
    ExtractJdRequest,
    ExtractJdResponse,
    ResumeSaveRequest,
    ResumeVersionResponse,
    TailorResumeRequest,
    TailorResumeResponse,
)
from app.services.ai.email_drafter import EmailDrafter
from app.services.ai.jd_extractor import JdExtractor
from app.services.ai.resume_export_service import ResumeExportService
from app.services.ai.resume_tailorer import ResumeTailorer

settings = get_settings()
router = APIRouter(tags=["AI & Resume"])


@router.post(
    "/ai/extract-jd",
    response_model=ExtractJdResponse,
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_ai_per_minute))]
)
async def extract_job_description(
    body: ExtractJdRequest,
    user: User = Depends(get_current_user)
):
    """Extract role, company, recruiter, and skills from text or safe URL."""
    return await JdExtractor.extract_from_url_or_text(
        tenant_id=user.tenant_id,
        text=body.text,
        url=body.url
    )


@router.post(
    "/ai/draft-email",
    response_model=List[DraftVariant],
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_ai_per_minute))]
)
async def draft_email(
    body: DraftEmailRequest,
    user: User = Depends(get_current_user)
):
    """Generate 3 application draft variants strictly from master profile."""
    return await EmailDrafter.generate_draft_variants(
        tenant_id=user.tenant_id,
        jd=body.jd,
        tone=body.tone,
        template_id=body.template_id
    )


@router.post(
    "/resume/tailor",
    response_model=TailorResumeResponse,
    dependencies=[Depends(rate_limit_dependency(settings.rate_limit_ai_per_minute))]
)
async def tailor_resume(
    body: TailorResumeRequest,
    user: User = Depends(get_current_user)
):
    """Tailor resume bullets, calculate deterministic ATS score, and verify claims."""
    return await ResumeTailorer.tailor_and_verify(
        tenant_id=user.tenant_id,
        jd=body.jd
    )


@router.post("/resumes", response_model=ResumeVersionResponse)
async def save_resume_version(
    body: ResumeSaveRequest,
    repo: ResumeRepo = Depends(get_resume_repo)
):
    """Save tailored resume version."""
    v = await repo.create(
        application_id=body.application_id,
        label=body.label,
        ats=body.ats,
        text=body.text
    )
    return ResumeVersionResponse(
        id=v.id,
        label=v.label,
        at=v.at.isoformat(),
        ats=v.ats,
        text=v.text
    )


@router.get("/resumes", response_model=List[ResumeVersionResponse])
async def list_resume_versions(repo: ResumeRepo = Depends(get_resume_repo)):
    """List saved resume versions."""
    versions = await repo.list_versions()
    return [
        ResumeVersionResponse(
            id=v.id,
            label=v.label,
            at=v.at.isoformat(),
            ats=v.ats,
            text=v.text
        )
        for v in versions
    ]


@router.get("/resumes/{resume_id}/export")
async def export_resume(
    resume_id: str,
    format: str = Query("pdf", pattern="^(pdf|docx)$"),
    resume_repo: ResumeRepo = Depends(get_resume_repo),
    profile_repo: ProfileRepo = Depends(get_profile_repo)
):
    """Export tailored resume as styled PDF or DOCX."""
    v = await resume_repo.get_by_id(resume_id)
    if not v:
        raise NotFoundError("Resume version not found")

    profile = await profile_repo.get_or_create()

    if format == "pdf":
        pdf_bytes = ResumeExportService.export_pdf(profile, v)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{v.label}.pdf"'}
        )
    else:
        docx_bytes = ResumeExportService.export_docx(profile, v)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{v.label}.docx"'}
        )
