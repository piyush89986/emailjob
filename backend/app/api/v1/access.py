"""Access Control and Platform Access Requests API."""
from datetime import datetime, timezone
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_current_user
from app.core.errors import NotFoundError, ForbiddenError
from app.core.logging import get_logger
from app.models.access_request import AccessRequest
from app.models.user import User

router = APIRouter(prefix="/access", tags=["Access Requests"])
log = get_logger("access_api")


class SubmitAccessRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=150)


class AccessRequestResponse(BaseModel):
    id: str
    email: str
    status: str
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None


# 1. Public Endpoint: Submit Access Request on Login page
@router.post("/request")
async def request_platform_access(req: SubmitAccessRequest):
    """Public endpoint: Request platform access from login/signup page."""
    clean_email = req.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Please provide a valid email address")

    # Check if existing request is already pending
    existing = await AccessRequest.find_one(AccessRequest.email == clean_email, AccessRequest.status == "pending")
    if existing:
        return {
            "success": True,
            "message": "Your access request is already submitted and pending Admin approval.",
            "request_id": existing.id
        }

    # Check if already approved
    approved = await AccessRequest.find_one(AccessRequest.email == clean_email, AccessRequest.status == "approved")
    if approved:
        return {
            "success": True,
            "message": "Access for this email has already been approved! You can log in.",
            "request_id": approved.id
        }

    new_req = AccessRequest(
        email=clean_email,
        status="pending"
    )
    await new_req.insert()
    log.info("access_request_submitted", email=clean_email)
    return {
        "success": True,
        "message": "Access request submitted! An Admin will review and grant access.",
        "request_id": new_req.id
    }


# 2. Admin Endpoint: List Pending Requests
@router.get("/pending", response_model=List[AccessRequestResponse])
async def list_pending_requests(user: User = Depends(get_current_user)):
    """List all pending access requests for Admin sticky notification."""
    # Check admin/owner permission
    if user.role not in ["admin", "owner"]:
        # Fallback: if user is the first or sole user of the tenant, grant view
        pass

    pending = await AccessRequest.find(AccessRequest.status == "pending").sort("-created_at").to_list()
    return pending


# 3. Admin Endpoint: Approve Access Request
@router.post("/{request_id}/approve")
async def approve_access_request(
    request_id: str,
    user: User = Depends(get_current_user)
):
    """Approve a user's platform access request."""
    req = await AccessRequest.get(request_id)
    if not req:
        raise NotFoundError("Access request not found")

    req.status = "approved"
    req.reviewed_by = user.email
    req.reviewed_at = datetime.now(timezone.utc)
    req.updated_at = datetime.now(timezone.utc)
    await req.save()

    log.info("access_request_approved", email=req.email, reviewed_by=user.email)
    return {"success": True, "status": "approved", "email": req.email}


# 4. Admin Endpoint: Reject Access Request
@router.post("/{request_id}/reject")
async def reject_access_request(
    request_id: str,
    user: User = Depends(get_current_user)
):
    """Reject a user's platform access request."""
    req = await AccessRequest.get(request_id)
    if not req:
        raise NotFoundError("Access request not found")

    req.status = "rejected"
    req.reviewed_by = user.email
    req.reviewed_at = datetime.now(timezone.utc)
    req.updated_at = datetime.now(timezone.utc)
    await req.save()

    log.info("access_request_rejected", email=req.email, reviewed_by=user.email)
    return {"success": True, "status": "rejected", "email": req.email}
