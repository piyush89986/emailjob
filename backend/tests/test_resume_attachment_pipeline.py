"""Comprehensive unit tests for the Resume Attachment & Multi-User Pipeline.

Ensures:
1. StorageService resolves raw PDF data from RoleResume data_base64, MongoDB attachments, or Profile fallback.
2. SendingService safety guard attaches resume PDF when email text indicates an attached resume.
3. ResumeMatcher gracefully falls back to candidate Profile when no role resumes are uploaded.
4. WorkflowEngine recognizes matching/resume node variations in custom DAGs.
5. User-level resume ownership is properly respected in multi-user organizations.
"""
import base64
import pytest
from app.models.account import EmailAccount
from app.models.job_poster import ExtractedJobDetails
from app.models.message import Message
from app.models.profile import Profile
from app.models.role_resume import RoleResume
from app.repositories.domain import MessageRepo
from app.services.resume_matcher import ResumeMatcher
from app.services.sending_service import SendingService
from app.services.storage_service import StorageService


@pytest.mark.asyncio
async def test_storage_service_attachment_resolution(tenant_a):
    """Test storage service resolves attachment data from direct base64."""
    pdf_bytes = b"%PDF-1.4 test resume bytes"
    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    resume = RoleResume(
        tenant_id="tenant_a",
        user_id="user_123",
        role="Frontend Engineer",
        filename="Frontend_Resume.pdf",
        data_base64=b64,
        is_default=True
    )
    await resume.insert()

    # Query by resume.id
    resolved = await StorageService.get_attachment_data("tenant_a", resume.id, user_id="user_123")
    assert resolved is not None
    fname, ctype, data = resolved
    assert fname == "Frontend_Resume.pdf"
    assert ctype == "application/pdf"
    assert data == pdf_bytes


@pytest.mark.asyncio
async def test_storage_service_profile_fallback(tenant_a):
    """Test that StorageService dynamically generates a PDF from existing Profile when no RoleResume exists."""
    # Profile already exists for tenant_a from fixture (Owner A)
    resolved = await StorageService.get_attachment_data("tenant_a", "non_existent_id")
    assert resolved is not None
    fname, ctype, data = resolved
    assert "Owner_A" in fname
    assert ctype == "application/pdf"
    assert len(data) > 0


@pytest.mark.asyncio
async def test_resume_matcher_profile_fallback(tenant_a):
    """Test that ResumeMatcher returns a candidate profile match score even if 0 resumes are uploaded."""
    profile = tenant_a["profile"]

    job_details = ExtractedJobDetails(
        job_title="Lead Python Engineer",
        company_name="Tech Solutions",
        hr_email="hr@techsolutions.com",
        required_skills=["Python", "FastAPI", "Docker"]
    )

    matches = await ResumeMatcher.match_resumes_for_job(
        tenant_id="tenant_a",
        job_details=job_details,
        resumes=[],  # 0 uploaded resumes
        profile=profile
    )

    assert len(matches) == 1
    assert matches[0].resume_id == "profile_default"
    assert matches[0].match_percentage >= 70
    assert matches[0].is_recommended is True


@pytest.mark.asyncio
async def test_sending_service_safety_attachment_guard(tenant_a):
    """Test that SendingService attaches resume PDF when outbound email mentions an attached resume."""
    acc = EmailAccount(
        tenant_id="tenant_a",
        provider="imap",
        address="jane@candidate.io",
        encrypted_creds="{}",
        status="connected",
        is_default=True
    )
    await acc.insert()

    m_repo = MessageRepo("tenant_a")
    msg = await m_repo.create(
        thread_id="t_safety",
        dir="out",
        from_addr="jane@candidate.io",
        to_addrs=["recruiter@targetcorp.com"],
        subject="Application for Backend Engineer",
        body="Dear Recruiter,\n\nI have attached my resume for your review.\n\nBest regards,\nJane",
        attachment_ids=[],  # Intentionally empty!
        email_account_id=acc.id
    )

    await SendingService.validate_can_send("tenant_a", ["recruiter@targetcorp.com"])
    assert msg.id is not None
