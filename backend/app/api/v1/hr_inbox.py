"""HR Inbox API router for viewing, filtering, reclassifying, and replying to recruiter emails."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import AppError, NotFoundError
from app.core.events import publish_event
from app.core.logging import get_logger
from app.models.account import EmailAccount
from app.models.application import Application
from app.models.hr_inbox import (
    ALL_CATEGORIES,
    CATEGORY_APPLICATION_CONFIRMATION,
    CATEGORY_ASSESSMENT,
    CATEGORY_HR_RECRUITER,
    CATEGORY_INTERVIEW_INVITATION,
    CATEGORY_OFFER_RECEIVED,
    CATEGORY_REJECTION,
    HRInbox,
    RELEVANT_HR_CATEGORIES,
)
from app.models.message import Message
from app.models.user import User
from app.services.ai.hr_classifier import HRClassifierService
from app.services.sending_service import SendingService
from app.services.sync_service import SyncService

log = get_logger("hr_inbox_api")
router = APIRouter(prefix="/hr-inbox", tags=["HR Inbox"])


class ReclassifyRequest(BaseModel):
    category: str = Field(..., description="Target category from ALL_CATEGORIES")
    is_relevant: Optional[bool] = None
    notes: Optional[str] = None


class ReplyHRRequest(BaseModel):
    body_html: str = Field(..., min_length=1, description="HTML or plain text reply body")
    subject: Optional[str] = None


class MarkReadRequest(BaseModel):
    is_read: bool = True


@router.get("")
async def list_hr_inbox(
    filter: str = Query("all", pattern="^(all|hr|interviews|applications|unread|rejections|review)$"),
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """Lists HR emails with filtering, search, pagination, and real-time category summary counts."""
    tenant_id = user.tenant_id

    # Base conditions
    base_query: Dict[str, Any] = {"tenant_id": tenant_id}

    if filter == "all":
        base_query["is_relevant"] = True
    elif filter == "hr":
        base_query["category"] = CATEGORY_HR_RECRUITER
    elif filter == "interviews":
        base_query["category"] = CATEGORY_INTERVIEW_INVITATION
    elif filter == "applications":
        base_query["category"] = CATEGORY_APPLICATION_CONFIRMATION
    elif filter == "rejections":
        base_query["category"] = CATEGORY_REJECTION
    elif filter == "unread":
        base_query["is_relevant"] = True
        base_query["is_read"] = False
    elif filter == "review":
        base_query["needs_manual_review"] = True

    # Search filter
    if q and q.strip():
        term = q.strip()
        base_query["$or"] = [
            {"subject": {"$regex": term, "$options": "i"}},
            {"sender_name": {"$regex": term, "$options": "i"}},
            {"sender_email": {"$regex": term, "$options": "i"}},
            {"company": {"$regex": term, "$options": "i"}},
            {"body_preview": {"$regex": term, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    total = await HRInbox.find(base_query).count()
    items = await HRInbox.find(base_query).sort("-received_at").skip(skip).limit(limit).to_list()

    # Calculate badge counts
    counts = {
        "all": await HRInbox.find({"tenant_id": tenant_id, "is_relevant": True}).count(),
        "hr": await HRInbox.find({"tenant_id": tenant_id, "category": CATEGORY_HR_RECRUITER}).count(),
        "interviews": await HRInbox.find({"tenant_id": tenant_id, "category": CATEGORY_INTERVIEW_INVITATION}).count(),
        "applications": await HRInbox.find({"tenant_id": tenant_id, "category": CATEGORY_APPLICATION_CONFIRMATION}).count(),
        "rejections": await HRInbox.find({"tenant_id": tenant_id, "category": CATEGORY_REJECTION}).count(),
        "unread": await HRInbox.find({"tenant_id": tenant_id, "is_relevant": True, "is_read": False}).count(),
        "review": await HRInbox.find({"tenant_id": tenant_id, "needs_manual_review": True}).count(),
    }

    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "limit": limit,
        "counts": counts
    }


@router.get("/{email_id}")
async def get_hr_email(
    email_id: str,
    user: User = Depends(get_current_user)
):
    """Fetches complete email details, including full HTML body and linked application details."""
    item = await HRInbox.find_one(HRInbox.id == email_id, HRInbox.tenant_id == user.tenant_id)
    if not item:
        raise NotFoundError("HR email not found")

    # Mark as read automatically when opened
    if not item.is_read:
        item.is_read = True
        item.updated_at = datetime.now(timezone.utc)
        await item.save()
        unread_count = await HRInbox.find(HRInbox.tenant_id == user.tenant_id, HRInbox.is_relevant == True, HRInbox.is_read == False).count()
        await publish_event(user.tenant_id, "hr_inbox.unread_count", {"count": unread_count})

    app_details = None
    if item.application_id:
        app_obj = await Application.find_one(Application.id == item.application_id, Application.tenant_id == user.tenant_id)
        if app_obj:
            app_details = {
                "id": app_obj.id,
                "title": app_obj.title,
                "company": app_obj.company,
                "status": app_obj.status,
                "created_at": app_obj.created_at.isoformat()
            }

    return {
        **item.model_dump(),
        "application": app_details
    }


@router.patch("/{email_id}/read")
async def toggle_read_status(
    email_id: str,
    req: MarkReadRequest,
    user: User = Depends(get_current_user)
):
    """Marks an HR email as read or unread."""
    item = await HRInbox.find_one(HRInbox.id == email_id, HRInbox.tenant_id == user.tenant_id)
    if not item:
        raise NotFoundError("HR email not found")

    item.is_read = req.is_read
    item.updated_at = datetime.now(timezone.utc)
    await item.save()

    unread_count = await HRInbox.find(HRInbox.tenant_id == user.tenant_id, HRInbox.is_relevant == True, HRInbox.is_read == False).count()
    await publish_event(user.tenant_id, "hr_inbox.unread_count", {"count": unread_count})

    return {"status": "ok", "is_read": item.is_read, "unread_count": unread_count}


@router.patch("/{email_id}/reclassify")
async def reclassify_email(
    email_id: str,
    req: ReclassifyRequest,
    user: User = Depends(get_current_user)
):
    """Manual review action: allows user to confirm or reclassify an email category."""
    if req.category not in ALL_CATEGORIES:
        raise AppError(f"Invalid category '{req.category}'. Must be one of {ALL_CATEGORIES}", status_code=400)

    item = await HRInbox.find_one(HRInbox.id == email_id, HRInbox.tenant_id == user.tenant_id)
    if not item:
        raise NotFoundError("HR email not found")

    item.category = req.category
    item.manual_category_override = req.category
    item.needs_manual_review = False  # Clear review flag
    item.confidence_score = 1.0  # User confirmed

    if req.is_relevant is not None:
        item.is_relevant = req.is_relevant
    else:
        item.is_relevant = req.category in RELEVANT_HR_CATEGORIES

    item.updated_at = datetime.now(timezone.utc)
    await item.save()

    # Emit update event
    await publish_event(user.tenant_id, "hr_inbox.updated", {
        "id": item.id,
        "category": item.category,
        "isRelevant": item.is_relevant,
        "needsReview": item.needs_manual_review
    })

    return item.model_dump()


@router.post("/{email_id}/reply")
async def reply_to_hr_email(
    email_id: str,
    req: ReplyHRRequest,
    user: User = Depends(get_current_user)
):
    """Sends a reply to the recruiter using existing Gmail OAuth and SendingService."""
    item = await HRInbox.find_one(HRInbox.id == email_id, HRInbox.tenant_id == user.tenant_id)
    if not item:
        raise NotFoundError("HR email not found")

    subj = req.subject or item.subject
    if not subj.lower().startswith("re:"):
        subj = f"Re: {subj}"

    # Enqueue outbound email using existing SendingService
    msg = await SendingService.enqueue_email_send(
        tenant_id=user.tenant_id,
        user_id=user.id,
        to_address_str=item.sender_email,
        subject=subj,
        body_html=req.body_html
    )

    return {
        "status": "sent",
        "message_id": msg.id,
        "to": item.sender_email,
        "subject": subj,
        "at": msg.at.isoformat()
    }


@router.post("/sync")
async def sync_hr_inbox(
    user: User = Depends(get_current_user)
):
    """Triggers an incremental Gmail synchronization and processes any unclassified inbound emails."""
    accounts = await EmailAccount.find(EmailAccount.tenant_id == user.tenant_id).to_list()
    synced_total = 0

    for acc in accounts:
        try:
            count = await SyncService.sync_account(acc)
            synced_total += count
        except Exception as e:
            log.warning("manual_sync_account_failed", account_id=acc.id, error=str(e))

    # Backfill: check for any existing inbound messages not yet in HRInbox
    inbound_msgs = await Message.find(Message.tenant_id == user.tenant_id, Message.dir == "in").sort("-at").limit(30).to_list()
    backfilled_count = 0
    for m in inbound_msgs:
        if m.provider_message_id:
            exists = await HRInbox.find_one(HRInbox.user_id == user.id, HRInbox.gmail_message_id == m.provider_message_id)
            if not exists and accounts:
                acc = accounts[0]
                item_dict = {
                    "provider_message_id": m.provider_message_id,
                    "from": m.from_addr,
                    "to": m.to_addrs,
                    "subject": m.subject,
                    "body": m.body,
                    "label_ids": []
                }
                try:
                    await HRClassifierService.process_inbound_email(acc, item_dict, m)
                    backfilled_count += 1
                except Exception as ex:
                    log.warning("backfill_error", mid=m.provider_message_id, error=str(ex))

    return {
        "status": "ok",
        "synced_new": synced_total,
        "backfilled": backfilled_count,
        "accounts_synced": len(accounts)
    }
