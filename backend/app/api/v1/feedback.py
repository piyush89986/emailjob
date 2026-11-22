"""App Feedback & Improvement Suggestions API router."""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import NotFoundError
from app.models.feedback import Feedback
from app.models.user import User

router = APIRouter(prefix="/feedback", tags=["Feedback"])


class CreateFeedbackRequest(BaseModel):
    category: str = Field("Feature Suggestion", max_length=50)
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=5, max_length=2000)
    impact: str = Field("Medium", max_length=30)


class FeedbackResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    category: str
    title: str
    description: str
    impact: str
    status: str
    votes: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


@router.get("", response_model=List[FeedbackResponse])
async def list_feedbacks(
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """List product feedback and improvement suggestions."""
    items = await Feedback.find().sort("-created_at").limit(limit).to_list()
    return items


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    req: CreateFeedbackRequest,
    user: User = Depends(get_current_user)
):
    """Submit a suggestion for improving the application."""
    item = Feedback(
        user_id=user.id,
        user_name=user.full_name or user.email.split("@")[0],
        user_email=user.email,
        category=req.category,
        title=req.title.strip(),
        description=req.description.strip(),
        impact=req.impact,
        votes=[user.id]
    )
    await item.insert()
    return item


@router.post("/{feedback_id}/vote")
async def vote_feedback(
    feedback_id: str,
    user: User = Depends(get_current_user)
):
    """Upvote or remove vote for a feedback item."""
    item = await Feedback.get(feedback_id)
    if not item:
        raise NotFoundError("Feedback not found")

    if user.id in item.votes:
        item.votes.remove(user.id)
    else:
        item.votes.append(user.id)

    item.updated_at = datetime.now(timezone.utc)
    await item.save()
    return {"voted": user.id in item.votes, "vote_count": len(item.votes)}
