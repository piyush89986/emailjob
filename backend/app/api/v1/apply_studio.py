"""Apply Studio API Endpoints.

Handles job poster upload, multimodal vision extraction, JD generation, resume matching,
personalized email drafting, Gmail sending, and metrics overview.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import AppError, NotFoundError
from app.core.logging import get_logger
from app.models.application import Application
from app.models.job_poster import ExtractedJobDetails, JobPoster
from app.models.profile import Profile
from app.models.role_resume import RoleResume
from app.models.user import User
from app.services.ai.job_poster_analyzer import JobPosterAnalyzer
from app.services.cloudinary_service import CloudinaryService
from app.services.resume_matcher import ResumeMatcher, ResumeMatchScore
from app.services.sending_service import SendingService
from app.services.storage_service import StorageService
from app.services.template_matcher import TemplateMatcher

router = APIRouter(prefix="/apply", tags=["apply-studio"])
log = get_logger("apply_studio_api")


class GenerateJdRequest(BaseModel):
    extracted_data: Optional[Dict[str, Any]] = None


class MatchResumeRequest(BaseModel):
    extracted_data: Optional[Dict[str, Any]] = None


class GenerateEmailRequest(BaseModel):
    extracted_data: Optional[Dict[str, Any]] = None
    resume_id: Optional[str] = None
    template_id: Optional[str] = None
    tone: str = "formal"  # "formal" | "friendly" | "concise"
    use_templates: Optional[bool] = True


class DirectJobEntryRequest(BaseModel):
    hr_email: str
    job_title: str
    company_name: Optional[str] = None
    role_resume_id: Optional[str] = None
    tone: Optional[str] = "formal"
    template_id: Optional[str] = None
    use_templates: Optional[bool] = True


class SendApplicationRequest(BaseModel):
    to_email: str
    subject: str
    body_html: str
    resume_id: Optional[str] = None
    job_poster_id: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    generated_jd: Optional[str] = None


async def _get_poster(poster_id: str, tenant_id: str) -> Optional[JobPoster]:
    """Helper to locate a JobPoster by id with support for string uuid, Beanie id, and ObjectId."""
    if not poster_id or poster_id in ("undefined", "null", "none"):
        return None
    poster = await JobPoster.find_one(JobPoster.id == poster_id, JobPoster.tenant_id == tenant_id)
    if not poster:
        try:
            from bson import ObjectId
            if ObjectId.is_valid(poster_id):
                poster = await JobPoster.find_one({"_id": ObjectId(poster_id), "tenant_id": tenant_id})
        except Exception:
            pass
    if not poster:
        try:
            poster = await JobPoster.find_one({"_id": poster_id, "tenant_id": tenant_id})
        except Exception:
            pass
    return poster


@router.get("/metrics")
async def get_apply_studio_metrics(user: User = Depends(get_current_user)):
    """Fetch high-level overview metrics for Apply Studio dashboard."""
    tenant_id = user.tenant_id

    total = await Application.find(Application.tenant_id == tenant_id).count()
    sent = await Application.find(
        Application.tenant_id == tenant_id,
        {"status": {"$in": ["Applied", "Email Sent", "Email Delivered", "Response Received", "Interview Scheduled", "Offer Received"]}}
    ).count()
    pending = await Application.find(
        Application.tenant_id == tenant_id,
        {"status": {"$in": ["Draft", "Ready to Apply", "Saved"]}}
    ).count()
    responses = await Application.find(
        Application.tenant_id == tenant_id,
        Application.status == "Response Received"
    ).count()
    interviews = await Application.find(
        Application.tenant_id == tenant_id,
        Application.status == "Interview Scheduled"
    ).count()
    rejected = await Application.find(
        Application.tenant_id == tenant_id,
        Application.status == "Rejected"
    ).count()

    return {
        "totalApplications": total,
        "applicationsSent": sent,
        "pendingApplications": pending,
        "responsesReceived": responses,
        "interviewsScheduled": interviews,
        "rejectedApplications": rejected,
    }


@router.post("/upload")
async def upload_job_poster(
    file: UploadFile = File(...),
    auto_analyze: bool = Form(False),
    user: User = Depends(get_current_user)
):
    """Upload a job poster image (PNG, JPG, JPEG) or PDF job description."""
    content_type = file.content_type or "image/png"
    filename = file.filename or "job_poster.png"
    contents = await file.read()

    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 15MB limit")

    tenant_id = user.tenant_id

    # Store via Cloudinary if configured; fallback to local storage
    storage_type = "local"
    file_url = ""
    cloudinary_id = None
    attachment_id = None

    if CloudinaryService.is_configured():
        try:
            res = CloudinaryService.upload_file(contents, filename, content_type)
            if res:
                storage_type = "cloudinary"
                file_url = res["url"]
                cloudinary_id = res["public_id"]
        except Exception as ce:
            log.warning("cloudinary_upload_failed_fallback_local", error=str(ce))

    if not file_url:
        try:
            att = await StorageService.save_attachment(tenant_id, filename, content_type, contents)
            attachment_id = att.id
            file_url = f"/attachments/{att.id}"
        except Exception as se:
            log.warning("attachment_storage_failed", error=str(se))
            file_url = f"/attachments/local_{filename}"

    poster = JobPoster(
        tenant_id=tenant_id,
        user_id=user.id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(contents),
        file_url=file_url,
        storage_type=storage_type,
        cloudinary_public_id=cloudinary_id,
        attachment_id=attachment_id,
        status="uploaded"
    )

    if auto_analyze:
        try:
            poster.status = "analyzing"
            await poster.save()
            extracted = await JobPosterAnalyzer.analyze(contents, content_type)
            poster.extracted_data = extracted
            poster.generated_jd = JobPosterAnalyzer.generate_structured_jd(extracted)
            poster.status = "extracted"

            # Auto-post to Community Hub
            if extracted and extracted.hr_email:
                try:
                    from app.models.hub import HubPost
                    hub_post = HubPost(
                        tenant_id=tenant_id,
                        user_id=user.id,
                        user_name=user.full_name or user.email.split("@")[0],
                        user_email=user.email,
                        post_type="poster",
                        title=extracted.job_title or "Job Opening",
                        company=extracted.company_name or "Hiring Company",
                        hr_email=extracted.hr_email,
                        location=extracted.location,
                        skills=extracted.required_skills or [],
                        jd=poster.generated_jd,
                        image_url=poster.file_url if poster.storage_type == "cloudinary" else None
                    )
                    await hub_post.insert()
                except Exception as he:
                    log.warning("hub_auto_post_failed", error=str(he))
        except Exception as e:
            poster.status = "failed"
            poster.error_message = str(e)
            log.error("auto_analyze_job_poster_failed", error=str(e))

    await poster.save()
    resp_dict = poster.model_dump()
    resp_dict["id"] = poster.id
    resp_dict["_id"] = str(poster.id)
    return resp_dict


@router.get("/jobs")
async def list_job_posters(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user)
):
    """List uploaded job posters with pagination, search, and filters."""
    query: Dict[str, Any] = {"tenant_id": user.tenant_id}
    if status and status != "all":
        query["status"] = status

    cursor = JobPoster.find(query).sort("-created_at").skip(offset).limit(limit)
    posters = await cursor.to_list()
    total = await JobPoster.find(query).count()

    # Search filter in-memory if query string present
    if search:
        s = search.lower()
        posters = [
            p for p in posters
            if s in (p.filename or "").lower() or
            (p.extracted_data and (
                s in (p.extracted_data.company_name or "").lower() or
                s in (p.extracted_data.job_title or "").lower()
            ))
        ]

    return {"items": posters, "total": total}


@router.get("/jobs/{poster_id}")
async def get_job_poster(poster_id: str, user: User = Depends(get_current_user)):
    """Fetch single job poster details."""
    poster = await _get_poster(poster_id, user.tenant_id)
    if not poster:
        raise NotFoundError("Job poster not found")
    return poster


@router.post("/jobs/{poster_id}/analyze")
async def analyze_job_poster(poster_id: str, user: User = Depends(get_current_user)):
    """Run AI Vision analysis on an existing uploaded job poster."""
    poster = await _get_poster(poster_id, user.tenant_id)
    if not poster:
        raise NotFoundError("Job poster not found")

    file_bytes = b""
    if poster.attachment_id:
        att = await StorageService.get_attachment_data(user.tenant_id, poster.attachment_id)
        if att:
            _, _, file_bytes = att
    elif poster.file_url:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(poster.file_url)
            file_bytes = resp.content

    if not file_bytes:
        raise AppError("Could not retrieve file content for analysis", status_code=400)

    poster.status = "analyzing"
    await poster.save()

    try:
        extracted = await JobPosterAnalyzer.analyze(file_bytes, poster.content_type)
        poster.extracted_data = extracted
        poster.generated_jd = JobPosterAnalyzer.generate_structured_jd(extracted)
        poster.status = "extracted"
        poster.updated_at = datetime.now(timezone.utc)
        await poster.save()
        return poster
    except Exception as e:
        poster.status = "failed"
        poster.error_message = str(e)
        await poster.save()
        raise AppError(f"Analysis failed: {str(e)}", status_code=502)


@router.post("/jobs/{poster_id}/generate-jd")
async def generate_jd_endpoint(
    poster_id: str,
    req: GenerateJdRequest,
    user: User = Depends(get_current_user)
):
    """Generate or regenerate structured Job Description."""
    poster = await _get_poster(poster_id, user.tenant_id)

    details = None
    if req.extracted_data:
        try:
            details = ExtractedJobDetails(**req.extracted_data)
        except Exception:
            pass
    if not details and poster:
        details = poster.extracted_data

    if not details:
        raise AppError("No job details available to generate JD", status_code=400)

    jd_text = JobPosterAnalyzer.generate_structured_jd(details)
    if poster:
        poster.generated_jd = jd_text
        poster.updated_at = datetime.now(timezone.utc)
        await poster.save()
    return {"generated_jd": jd_text}


@router.post("/jobs/{poster_id}/match-resume")
async def match_resume_endpoint(
    poster_id: str,
    req: MatchResumeRequest,
    user: User = Depends(get_current_user)
):
    """Run weighted scoring algorithm against all candidate's uploaded role resumes."""
    poster = await _get_poster(poster_id, user.tenant_id)

    details = None
    if req.extracted_data:
        try:
            details = ExtractedJobDetails(**req.extracted_data)
        except Exception:
            pass
    if not details and poster:
        details = poster.extracted_data

    if not details:
        raise AppError("Job details not extracted yet", status_code=400)

    resumes = await RoleResume.find(RoleResume.tenant_id == user.tenant_id).to_list()
    profile = await Profile.find_one(Profile.tenant_id == user.tenant_id)

    matches = await ResumeMatcher.match_resumes_for_job(
        tenant_id=user.tenant_id,
        job_details=details,
        resumes=resumes,
        profile=profile
    )
    return {"matches": matches}


@router.post("/jobs/{poster_id}/generate-email")
async def generate_email_endpoint(
    poster_id: str,
    req: GenerateEmailRequest,
    user: User = Depends(get_current_user)
):
    """Generate personalized application email draft.
    
    Checks user's saved email templates first for role match.
    If matched, populates dynamic variables ({{role}}, {{company}}, {{my_name}}, etc.).
    If no template exists for the role, falls back to AI generation.
    """
    poster = await _get_poster(poster_id, user.tenant_id)

    details = None
    if req.extracted_data:
        try:
            details = ExtractedJobDetails(**req.extracted_data)
        except Exception:
            pass
    if not details and poster:
        details = poster.extracted_data

    if not details:
        raise AppError("Job details not extracted", status_code=400)

    # Resolve selected resume info
    resume_name = "Resume"
    resume_attachment_id = None
    if req.resume_id:
        r = await RoleResume.find_one(RoleResume.id == req.resume_id, RoleResume.tenant_id == user.tenant_id)
        if r:
            resume_name = f"{r.role} Resume"
            resume_attachment_id = r.attachment_id

    # Compose email using Template Matcher (Templates first -> AI fallback)
    composed = await TemplateMatcher.compose_email(
        tenant_id=user.tenant_id,
        job_title=details.job_title or "Open Role",
        company_name=details.company_name or "Hiring Team",
        hr_name=details.hr_name,
        hr_email=details.hr_email,
        matching_skills=details.required_skills,
        tone=req.tone,
        preferred_template_id=req.template_id,
        use_templates=req.use_templates if req.use_templates is not None else True
    )

    return {
        **composed,
        "resume_name": resume_name,
        "resume_attachment_id": resume_attachment_id
    }


@router.post("/direct-entry")
async def direct_job_entry_endpoint(
    req: DirectJobEntryRequest,
    user: User = Depends(get_current_user)
):
    """Create a structured job application directly from HR email, chosen role, and optional company.
    
    Prompts/uses saved role resumes, selects matching resume and email template (or AI draft).
    """
    clean_email = (req.hr_email or "").strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Valid HR / Recruiter email is required")

    job_title = (req.job_title or "").strip()
    if not job_title:
        raise HTTPException(status_code=400, detail="Target job role is required")

    # Determine company name: use provided or derive from domain
    company_name = (req.company_name or "").strip()
    if not company_name:
        domain_part = clean_email.split("@")[-1].split(".")[0].capitalize()
        if domain_part.lower() in ["gmail", "yahoo", "outlook", "hotmail", "proton", "icloud"]:
            company_name = "Hiring Team"
        else:
            company_name = domain_part

    # Locate role resume
    selected_resume: Optional[RoleResume] = None
    if req.role_resume_id:
        selected_resume = await RoleResume.find_one(RoleResume.id == req.role_resume_id, RoleResume.tenant_id == user.tenant_id)
    if not selected_resume:
        # Match by role title
        selected_resume = await RoleResume.find_one(
            RoleResume.tenant_id == user.tenant_id,
            {"role": {"$regex": f"^{re.escape(job_title)}$", "$options": "i"}}
        )
    if not selected_resume:
        selected_resume = await RoleResume.find_one(RoleResume.tenant_id == user.tenant_id, RoleResume.is_default == True) or await RoleResume.find_one(RoleResume.tenant_id == user.tenant_id)

    skills = selected_resume.skills if selected_resume and selected_resume.skills else []

    extracted_details = ExtractedJobDetails(
        company_name=company_name,
        job_title=job_title,
        hr_email=clean_email,
        required_skills=skills,
        confidence_score=1.0,
        requires_manual_verification=False,
        raw_text=f"Direct recruiter outreach for {job_title} at {company_name}"
    )

    generated_jd = f"# {job_title}\n\n**Company:** {company_name}\n**Recruiter Email:** {clean_email}\n\nTarget outreach for candidate specializing in {', '.join(skills[:5]) if skills else 'modern technical skills'}."

    poster = JobPoster(
        tenant_id=user.tenant_id,
        user_id=user.id,
        filename=f"Direct Outreach - {job_title} ({company_name})",
        content_type="text/plain",
        size_bytes=len(generated_jd),
        file_url="",
        storage_type="direct",
        extracted_data=extracted_details,
        generated_jd=generated_jd,
        status="extracted"
    )
    await poster.save()

    # Auto-post direct email job to Community Hub
    try:
        from app.models.hub import HubPost
        hub_post = HubPost(
            tenant_id=user.tenant_id,
            user_id=user.id,
            user_name=user.full_name or user.email.split("@")[0],
            user_email=user.email,
            post_type="direct_email",
            title=job_title,
            company=company_name,
            hr_email=clean_email,
            skills=skills,
            jd=generated_jd,
            image_url=None
        )
        await hub_post.insert()
    except Exception as he:
        log.warning("hub_direct_auto_post_failed", error=str(he))

    # Pre-compose email
    composed = await TemplateMatcher.compose_email(
        tenant_id=user.tenant_id,
        job_title=job_title,
        company_name=company_name,
        hr_name=None,
        hr_email=clean_email,
        matching_skills=skills,
        tone=req.tone or "formal",
        preferred_template_id=req.template_id,
        use_templates=req.use_templates if req.use_templates is not None else True
    )

    resume_name = f"{selected_resume.role} Resume" if selected_resume else "Resume"
    resume_attachment_id = selected_resume.attachment_id if selected_resume else None

    return {
        "poster": poster.model_dump(),
        "email_draft": {
            **composed,
            "resume_name": resume_name,
            "resume_attachment_id": resume_attachment_id
        },
        "selected_resume_id": selected_resume.id if selected_resume else None
    }


@router.post("/jobs/{poster_id}/send")
async def send_application_endpoint(
    poster_id: str,
    req: SendApplicationRequest,
    user: User = Depends(get_current_user)
):
    """Send application email via connected Gmail account and save to Application Tracker."""
    if not req.to_email:
        raise AppError("Recipient HR email is required", status_code=400)

    tenant_id = user.tenant_id
    att_ids = []

    # If resume_id supplied, resolve attachment_id
    if req.resume_id:
        r = await RoleResume.find_one(RoleResume.id == req.resume_id, RoleResume.tenant_id == tenant_id)
        if r:
            att_ids.append(r.attachment_id or r.id)

    # If no resume attached yet, fallback to user's default or first stored role resume
    if not att_ids:
        fallback_r = await RoleResume.find_one(RoleResume.tenant_id == tenant_id, RoleResume.is_default == True) or await RoleResume.find_one(RoleResume.tenant_id == tenant_id)
        if fallback_r:
            att_ids.append(fallback_r.attachment_id or fallback_r.id)
            if not req.resume_id:
                req.resume_id = fallback_r.id

    # Dispatch via Gmail sending service
    msg = await SendingService.enqueue_email_send(
        tenant_id=tenant_id,
        user_id=user.id,
        to_address_str=req.to_email,
        subject=req.subject,
        body_html=req.body_html,
        attachment_ids=att_ids
    )

    # Save to Application Tracker
    poster = await _get_poster(poster_id, tenant_id)
    app_record = Application(
        tenant_id=tenant_id,
        title=req.extracted_data.get("job_title", "Open Role") if req.extracted_data else (poster.extracted_data.job_title if poster and poster.extracted_data else "Open Role"),
        company=req.extracted_data.get("company_name", "Company") if req.extracted_data else (poster.extracted_data.company_name if poster and poster.extracted_data else "Company"),
        location=req.extracted_data.get("location") if req.extracted_data else None,
        hr_email=req.to_email,
        status="Applied",
        selected_resume_id=req.resume_id,
        job_poster_id=poster_id,
        job_poster_url=poster.file_url if poster else None,
        extracted_data=req.extracted_data or (poster.extracted_data.model_dump() if poster and poster.extracted_data else None),
        jd=req.generated_jd or (poster.generated_jd if poster else ""),
        email_subject=req.subject,
        email_body=req.body_html,
        gmail_message_id=msg.id,
        gmail_thread_id=msg.thread_id,
        timeline=[
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "label": f"Applied via Gmail to {req.to_email}"
            }
        ]
    )
    await app_record.insert()

    if poster:
        poster.status = "applied"
        poster.application_id = app_record.id
        await poster.save()

    return {
        "success": True,
        "application_id": app_record.id,
        "message_id": msg.id,
        "thread_id": msg.thread_id
    }
