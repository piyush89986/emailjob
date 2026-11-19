"""Job poster model storing uploaded posters, AI-extracted details, and generated JDs."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import BaseModel, Field


class ExtractedJobDetails(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    hr_name: Optional[str] = None
    hr_email: Optional[str] = None
    contact_number: Optional[str] = None
    salary_range: Optional[str] = None
    required_skills: List[str] = Field(default_factory=list)
    required_experience: Optional[str] = None
    educational_qualifications: Optional[str] = None
    job_responsibilities: List[str] = Field(default_factory=list)
    candidate_requirements: List[str] = Field(default_factory=list)
    application_instructions: Optional[str] = None
    company_website: Optional[str] = None
    confidence_score: float = 0.0
    requires_manual_verification: bool = False
    raw_text: str = ""


class JobPoster(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    user_id: str
    filename: str
    content_type: str = "image/png"
    size_bytes: int = 0
    file_url: str = ""
    storage_type: str = "local"  # "cloudinary" | "local"
    cloudinary_public_id: Optional[str] = None
    attachment_id: Optional[str] = None
    extracted_data: Optional[ExtractedJobDetails] = None
    generated_jd: Optional[str] = None
    selected_resume_id: Optional[str] = None
    application_id: Optional[str] = None
    status: str = "uploaded"  # "uploaded" | "analyzing" | "extracted" | "applied" | "failed"
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "job_posters"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("created_at", ASCENDING)]),
        ]
