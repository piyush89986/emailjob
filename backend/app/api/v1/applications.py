"""Job applications tracker API router."""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import get_application_repo
from app.core.errors import NotFoundError
from app.repositories.domain import ApplicationRepo
from app.schemas.domain import (
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplicationStatusUpdate,
    TimelineEntry,
)

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationResponse])
async def list_applications(repo: ApplicationRepo = Depends(get_application_repo)):
    """List all job applications."""
    apps = await repo.find_all(sort=[("created_at", -1)])
    return [
        ApplicationResponse(
            id=a.id,
            title=a.title,
            company=a.company,
            jd=a.jd,
            jd_url=a.jd_url,
            contact_id=a.contact_id,
            resume=a.resume,
            status=a.status,  # type: ignore
            timeline=[TimelineEntry(at=t.get("at", ""), label=t.get("label", "")) for t in a.timeline]
        )
        for a in apps
    ]


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
        timeline=[TimelineEntry(at=t["at"], label=t["label"]) for t in app.timeline]
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
        timeline=[TimelineEntry(at=t["at"], label=t["label"]) for t in app.timeline]
    )


@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    repo: ApplicationRepo = Depends(get_application_repo)
):
    """Delete an application."""
    deleted = await repo.delete(app_id)
    if not deleted:
        raise NotFoundError("Application not found")
    return {"status": "ok", "deleted": True}
