"""Job applications tracker API router."""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends
from app.api.deps import get_application_repo, get_current_user
from app.core.errors import NotFoundError
from app.models.hr_inbox import HRInbox
from app.models.user import User
from app.repositories.domain import ApplicationRepo
from app.schemas.domain import (
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplicationStatusUpdate,
    TimelineEntry,
)

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationResponse])
async def list_applications(
    repo: ApplicationRepo = Depends(get_application_repo),
    user: User = Depends(get_current_user)
):
    """List all job applications with linked communications from same HR email or company."""
    apps = await repo.find_all(sort=[("created_at", -1)])
    hr_emails = await HRInbox.find(HRInbox.tenant_id == user.tenant_id).to_list()

    responses = []
    for a in apps:
        combined_replies = list(a.recruiter_replies or [])
        existing_msg_ids = {r.get("gmail_message_id") for r in combined_replies if r.get("gmail_message_id")}

        # Cross-reference with HRInbox for matches on same HR email or same company
        app_hr = (a.hr_email or "").strip().lower()
        app_comp = (a.company or "").strip().lower()

        for h in hr_emails:
            if h.gmail_message_id in existing_msg_ids:
                continue
            h_sender = (h.sender_email or "").strip().lower()
            h_comp = (h.company or "").strip().lower()
            h_subj = (h.subject or "").strip().lower()

            matched = False
            if app_hr and (app_hr == h_sender or (len(app_hr) > 5 and app_hr in h_sender)):
                matched = True
            elif app_comp and len(app_comp) >= 3:
                if app_comp in h_comp or app_comp in h_sender or app_comp in h_subj:
                    matched = True

            if matched:
                combined_replies.append({
                    "from": h.sender_email,
                    "sender_name": h.sender_name or h.sender_email,
                    "subject": h.subject,
                    "body_snippet": h.preview_body or "",
                    "at": h.received_at.isoformat() if h.received_at else datetime.now(timezone.utc).isoformat(),
                    "received_at": h.received_at.isoformat() if h.received_at else datetime.now(timezone.utc).isoformat(),
                    "gmail_message_id": h.gmail_message_id,
                    "gmail_thread_id": h.gmail_thread_id,
                    "company": h.company or a.company,
                    "category": h.category
                })
                existing_msg_ids.add(h.gmail_message_id)

        responses.append(
            ApplicationResponse(
                id=a.id,
                title=a.title,
                company=a.company,
                jd=a.jd or "",
                jd_url=a.jd_url or "",
                contact_id=a.contact_id or "",
                resume=a.resume or "v1",
                status=a.status,  # type: ignore
                hr_email=a.hr_email,
                location=a.location,
                salary_range=a.salary_range,
                match_score=a.match_score,
                job_poster_url=a.job_poster_url,
                email_subject=a.email_subject,
                email_body=a.email_body,
                gmail_thread_id=a.gmail_thread_id,
                created_at=a.created_at.isoformat() if a.created_at else None,
                timeline=[TimelineEntry(at=t.get("at", ""), label=t.get("label", "")) for t in a.timeline],
                recruiter_replies=combined_replies
            )
        )

    return responses


@router.post("", response_model=ApplicationResponse)
async def create_application(
    body: ApplicationCreateRequest,
    repo: ApplicationRepo = Depends(get_application_repo)
):
    """Create a new tracked application."""
    initial_timeline = [{"at": datetime.now(timezone.utc).isoformat(), "label": body.status}]
    app = await repo.create(
        title=body.title,
        company=body.company,
        jd=body.jd,
        jd_url=body.jd_url,
        contact_id=body.contact_id,
        resume=body.resume,
        status=body.status,
        timeline=initial_timeline
    )
    return ApplicationResponse(
        id=app.id,
        title=app.title,
        company=app.company,
        jd=app.jd,
        jd_url=app.jd_url,
        contact_id=app.contact_id,
        resume=app.resume,
        status=app.status,  # type: ignore
        timeline=[TimelineEntry(at=t["at"], label=t["label"]) for t in app.timeline],
        recruiter_replies=app.recruiter_replies
    )


@router.patch("/{app_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    app_id: str,
    body: ApplicationStatusUpdate,
    repo: ApplicationRepo = Depends(get_application_repo)
):
    """Update application status and append to timeline."""
    app = await repo.get_by_id(app_id)
    if not app:
        raise NotFoundError("Application not found")

    entry = {"at": datetime.now(timezone.utc).isoformat(), "label": body.status}
    app.status = body.status
    app.timeline.append(entry)
    app.updated_at = datetime.now(timezone.utc)
    await app.save()

    return ApplicationResponse(
        id=app.id,
        title=app.title,
        company=app.company,
        jd=app.jd,
        jd_url=app.jd_url,
        contact_id=app.contact_id,
        resume=app.resume,
        status=app.status,  # type: ignore
        timeline=[TimelineEntry(at=t["at"], label=t["label"]) for t in app.timeline],
        recruiter_replies=app.recruiter_replies
    )


@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    repo: ApplicationRepo = Depends(get_application_repo)
):
    """Delete an application."""
    app = await repo.get_by_id(app_id)
    if not app:
        raise NotFoundError("Application not found")
    await app.delete()
    return {"ok": True}


@router.post("/{app_id}/follow-up")
async def trigger_follow_up(
    app_id: str,
    auto_send: bool = False,
    repo: ApplicationRepo = Depends(get_application_repo)
):
    """Generate or send a follow-up email for an existing application."""
    app = await repo.get_by_id(app_id)
    if not app:
        raise NotFoundError("Application not found")

    if app.status in ["Rejected", "Withdrawn", "Offer Received", "Offer"]:
        raise AppError(f"Cannot follow up on application with status '{app.status}'", status_code=400)

    from app.models.profile import Profile
    from app.services.sending_service import SendingService
    from app.core.errors import AppError

    profile = await Profile.find_one(Profile.tenant_id == app.tenant_id)
    candidate_name = profile.name if profile and profile.name else "Candidate"
    hr_email = app.hr_email or (app.extracted_data.get("hr_email") if app.extracted_data else None)

    if not hr_email:
        raise AppError("No recipient HR email available for this application", status_code=400)

    subject = f"Following up: Application for {app.title} - {candidate_name}"
    body = f"""<p>Dear Hiring Team,</p>
<p>I hope you are having a productive week.</p>
<p>I am writing to briefly follow up on my application for the <strong>{app.title}</strong> role at <strong>{app.company}</strong> submitted recently.</p>
<p>I remain very interested in the opportunity to contribute to your team and would be happy to provide any additional details or work samples if helpful.</p>
<p>Thank you again for your time and consideration.</p>
<p>Best regards,<br><strong>{candidate_name}</strong></p>"""

    if auto_send:
        msg = await SendingService.enqueue_email_send(
            tenant_id=app.tenant_id,
            user_id="system",
            to_address_str=hr_email,
            subject=subject,
            body_html=body,
            thread_id=app.gmail_thread_id
        )
        app.follow_up_count += 1
        app.last_follow_up_at = datetime.now(timezone.utc)
        app.timeline.append({
            "at": datetime.now(timezone.utc).isoformat(),
            "label": f"Sent follow-up #{app.follow_up_count} to {hr_email}"
        })
        await app.save()
        return {"sent": True, "message_id": msg.id, "subject": subject, "body": body}

    return {"sent": False, "subject": subject, "body": body, "to_email": hr_email}
