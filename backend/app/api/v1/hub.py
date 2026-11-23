"""Community Hub API router.

Handles shared job posts feed, like/comment interactions, 1-click application preparation,
and real-time group chat among users.
"""
from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import NotFoundError, AppError
from app.core.logging import get_logger
from app.models.hub import HubChatMessage, HubComment, HubPost
from app.models.profile import Profile
from app.models.role_resume import RoleResume
from app.models.user import User
from app.services.resume_matcher import ResumeMatcher
from app.services.template_matcher import TemplateMatcher

router = APIRouter(prefix="/hub", tags=["Hub"])
log = get_logger("hub_api")


class CreatePostRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    company: str = Field(..., min_length=2, max_length=150)
    hr_email: str = Field(..., min_length=5, max_length=150)
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    jd: Optional[str] = None
    image_url: Optional[str] = None
    post_type: str = "poster"


class AddCommentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class SendChatMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class HubCommentResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    text: str
    created_at: datetime


class HubPostResponse(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    user_name: str
    user_email: str
    post_type: str = "poster"
    title: str
    company: str
    hr_email: str
    location: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    jd: Optional[str] = None
    image_url: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    comments: List[HubCommentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class HubChatMessageResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    text: str
    created_at: datetime


# --- 1. Shared Job Posts Feed ---

@router.get("/posts", response_model=List[HubPostResponse])
async def list_hub_posts(
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """List shared job posts in reverse chronological order."""
    posts = await HubPost.find().sort("-created_at").limit(limit).to_list()
    return posts


@router.post("/posts", response_model=HubPostResponse)
async def create_hub_post(
    req: CreatePostRequest,
    user: User = Depends(get_current_user)
):
    """Share a job poster or opening to the Community Hub."""
    clean_email = req.hr_email.strip().lower()
    if "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Valid HR email address is required")

    post = HubPost(
        tenant_id=user.tenant_id,
        user_id=user.id,
        user_name=user.full_name or user.email.split("@")[0],
        user_email=user.email,
        post_type=req.post_type,
        title=req.title.strip(),
        company=req.company.strip(),
        hr_email=clean_email,
        location=req.location,
        skills=req.skills,
        jd=req.jd,
        image_url=req.image_url,
    )
    await post.insert()
    return post


@router.post("/posts/{post_id}/like")
async def toggle_like_post(
    post_id: str,
    user: User = Depends(get_current_user)
):
    """Toggle like or unlike on a shared job post."""
    post = await HubPost.get(post_id)
    if not post:
        raise NotFoundError("Job post not found")

    if user.id in post.likes:
        post.likes.remove(user.id)
    else:
        post.likes.append(user.id)

    post.updated_at = datetime.now(timezone.utc)
    await post.save()
    return {"liked": user.id in post.likes, "like_count": len(post.likes)}


@router.post("/posts/{post_id}/comments", response_model=HubCommentResponse)
async def add_post_comment(
    post_id: str,
    req: AddCommentRequest,
    user: User = Depends(get_current_user)
):
    """Add a validated comment to a shared job post."""
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Comment cannot be blank")

    post = await HubPost.get(post_id)
    if not post:
        raise NotFoundError("Job post not found")

    comment = HubComment(
        user_id=user.id,
        user_name=user.full_name or user.email.split("@")[0],
        text=clean_text
    )
    post.comments.append(comment)
    post.updated_at = datetime.now(timezone.utc)
    await post.save()
    return comment


# --- 2. 1-Click Application Preparation from Hub Post ---

@router.post("/posts/{post_id}/apply-prep")
async def prepare_application_from_hub_post(
    post_id: str,
    user: User = Depends(get_current_user)
):
    """Prepare a personalized application for this post using the current user's resumes and templates."""
    post = await HubPost.get(post_id)
    if not post:
        raise NotFoundError("Job post not found")

    # Locate user's best matching resume from roleResumes
    resumes = []
    if user.id:
        resumes = await RoleResume.find(RoleResume.user_id == user.id).to_list()
    if not resumes:
        resumes = await RoleResume.find(RoleResume.tenant_id == user.tenant_id).to_list()

    best_resume: Optional[RoleResume] = None
    if resumes:
        # Check role match first
        norm_title = post.title.lower()
        for r in resumes:
            if r.role.lower() in norm_title or norm_title in r.role.lower():
                best_resume = r
                break
        if not best_resume:
            best_resume = next((r for r in resumes if r.is_default), resumes[0])

    selected_resume_payload = None
    if best_resume:
        selected_resume_payload = {
            "id": best_resume.id,
            "role": best_resume.role,
            "filename": best_resume.filename,
            "attachment_id": best_resume.attachment_id or best_resume.id
        }
    else:
        # Dynamic Candidate Profile fallback
        profile = await Profile.find_one(Profile.tenant_id == user.tenant_id)
        if profile and (profile.name or profile.skills or profile.experience):
            cand_name = (profile.name or "Candidate").strip()
            selected_resume_payload = {
                "id": "profile_default",
                "role": profile.headline or post.title or "Candidate Profile",
                "filename": f"{cand_name.replace(' ', '_')}_Resume.pdf",
                "attachment_id": None
            }

    # Pre-compose application email
    composed = await TemplateMatcher.compose_email(
        tenant_id=user.tenant_id,
        job_title=post.title,
        company_name=post.company,
        hr_name=None,
        hr_email=post.hr_email,
        matching_skills=post.skills or (best_resume.skills if best_resume and hasattr(best_resume, "skills") else []),
        tone="formal",
        use_templates=True
    )

    return {
        "post_id": post.id,
        "title": post.title,
        "company": post.company,
        "hr_email": post.hr_email,
        "selected_resume": selected_resume_payload,
        "email_draft": composed,
    }


# --- 3. Community Group Chat ---

@router.get("/chat", response_model=List[HubChatMessageResponse])
async def list_chat_messages(
    limit: int = Query(80, ge=1, le=150),
    user: User = Depends(get_current_user)
):
    """List recent community group chat messages."""
    messages = await HubChatMessage.find().sort("-created_at").limit(limit).to_list()
    return list(reversed(messages))


@router.post("/chat", response_model=HubChatMessageResponse)
async def send_chat_message(
    req: SendChatMessageRequest,
    user: User = Depends(get_current_user)
):
    """Post a validated message to the community group chat."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Chat message cannot be empty")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message exceeds 2000 character limit")

    msg = HubChatMessage(
        user_id=user.id,
        user_name=user.full_name or user.email.split("@")[0],
        user_email=user.email,
        text=text
    )
    await msg.insert()
    return msg
