"""Intelligent Resume Matching Engine.

Implements a weighted multi-factor scoring algorithm across existing candidate resumes:
- Skills Match: 40%
- Job Title Relevance: 25%
- Experience Match: 15%
- Responsibilities Similarity: 10%
- Education Match: 10%
"""
import io
import re
from typing import Any, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.job_poster import ExtractedJobDetails
from app.models.profile import Profile
from app.models.role_resume import RoleResume
from app.services.storage_service import StorageService

log = get_logger("resume_matcher")
settings = get_settings()

COMMON_SKILL_SYNONYMS = {
    "react": ["react.js", "reactjs", "react-native"],
    "node": ["node.js", "nodejs", "express", "backend"],
    "python": ["fastapi", "django", "flask", "python3"],
    "typescript": ["ts", "javascript", "js"],
    "mongodb": ["mongo", "nosql", "documentdb"],
    "sql": ["postgresql", "postgres", "mysql", "sqlite"],
    "aws": ["amazon web services", "cloud", "ec2", "s3"],
    "docker": ["containers", "kubernetes", "k8s"],
    "communication": ["client communication", "presentation", "interpersonal skills"],
    "sales": ["business development", "lead generation", "cold calling", "b2b sales"]
}


class ResumeMatchScore(BaseModel):
    resume_id: str
    role_name: str
    filename: str
    match_percentage: int
    breakdown: Dict[str, int] = Field(default_factory=dict)
    matching_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    rationale: str
    is_recommended: bool = False
    attachment_id: Optional[str] = None
    url: str = ""


class ResumeMatcher:
    @staticmethod
    async def extract_resume_text(tenant_id: str, resume: RoleResume) -> str:
        """Extract plain text from resume PDF stored in Cloudinary or local storage."""
        try:
            if not PdfReader:
                return f"{resume.role} {resume.filename} {resume.notes or ''}"

            # 1. Try local storage first if attachment_id exists
            if resume.attachment_id:
                att_info = await StorageService.get_attachment_data(tenant_id, resume.attachment_id)
                if att_info:
                    _, _, raw_bytes = att_info
                    reader = PdfReader(io.BytesIO(raw_bytes))
                    return " ".join([page.extract_text() or "" for page in reader.pages])

            # 2. Try fetching from Cloudinary/URL if remote
            if resume.url and resume.url.startswith("http"):
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(resume.url)
                    if resp.status_code == 200:
                        reader = PdfReader(io.BytesIO(resp.content))
                        return " ".join([page.extract_text() or "" for page in reader.pages])
        except Exception as e:
            log.warning("failed_to_read_resume_pdf_text", resume_id=resume.id, error=str(e))

        # Fallback to role name and notes as text
        return f"{resume.role} {resume.filename} {resume.notes or ''}"

    @classmethod
    async def match_resumes_for_job(
        cls,
        tenant_id: str,
        job_details: ExtractedJobDetails,
        resumes: List[RoleResume],
        profile: Optional[Profile] = None
    ) -> List[ResumeMatchScore]:
        """Score each uploaded resume against job requirements using 5-factor weighted scoring."""
        if not resumes:
            return []

        results: List[ResumeMatchScore] = []

        job_title_words = set(re.findall(r"\w+", (job_details.job_title or "").lower()))
        req_skills = [s.strip().lower() for s in job_details.required_skills if s.strip()]

        for r in resumes:
            resume_text = await cls.extract_resume_text(tenant_id, r)
            resume_text_lower = resume_text.lower()
            role_lower = (r.role or "").lower()

            # 1. Skills Match (40% weight)
            matching_skills = []
            missing_skills = []
            for skill in req_skills:
                # Direct check or synonym check
                variants = [skill] + COMMON_SKILL_SYNONYMS.get(skill, [])
                if any(v in resume_text_lower or v in role_lower for v in variants):
                    matching_skills.append(skill)
                else:
                    missing_skills.append(skill)

            skills_score = (len(matching_skills) / len(req_skills) * 100) if req_skills else 85
            skills_weighted = (skills_score * 0.40)

            # 2. Job Title Relevance (25% weight)
            resume_title_words = set(re.findall(r"\w+", role_lower))
            overlap_title = job_title_words.intersection(resume_title_words)
            if job_title_words:
                title_score = min(100, int((len(overlap_title) / len(job_title_words)) * 120))
            else:
                title_score = 70
            title_weighted = (title_score * 0.25)

            # 3. Experience Match (15% weight)
            # Check experience keywords in text (e.g. senior, lead, junior, years, intern)
            exp_score = 75
            job_exp = (job_details.required_experience or "").lower()
            if "senior" in job_exp and ("senior" in resume_text_lower or "lead" in resume_text_lower):
                exp_score = 95
            elif "fresher" in job_exp or "entry" in job_exp:
                exp_score = 90
            elif "year" in job_exp and ("year" in resume_text_lower or "202" in resume_text_lower):
                exp_score = 85
            exp_weighted = (exp_score * 0.15)

            # 4. Responsibilities Similarity (10% weight)
            resp_score = 70
            resps = job_details.job_responsibilities
            if resps:
                matched_resps = sum(
                    1 for resp in resps
                    if any(w in resume_text_lower for w in re.findall(r"\w{4,}", resp.lower()))
                )
                resp_score = min(100, int((matched_resps / len(resps)) * 100))
            resp_weighted = (resp_score * 0.10)

            # 5. Education Match (10% weight)
            edu_score = 80
            job_edu = (job_details.educational_qualifications or "").lower()
            if any(deg in resume_text_lower for deg in ["b.tech", "btech", "degree", "bachelor", "master", "m.tech", "bsc", "bca", "mca"]):
                edu_score = 95
            edu_weighted = (edu_score * 0.10)

            # Total score
            total_score = int(round(skills_weighted + title_weighted + exp_weighted + resp_weighted + edu_weighted))
            total_score = max(5, min(99, total_score))

            # Compile strengths & weaknesses
            strengths = []
            weaknesses = []

            if matching_skills:
                strengths.append(f"Strong overlap in core skills: {', '.join(matching_skills[:4])}")
            if title_score >= 80:
                strengths.append(f"Target role aligns directly with '{job_details.job_title}'")
            if exp_score >= 85:
                strengths.append("Meets stated experience level requirements")

            if missing_skills:
                weaknesses.append(f"Missing explicit keywords for: {', '.join(missing_skills[:3])}")
            if title_score < 50:
                weaknesses.append(f"Role title '{r.role}' differs from target '{job_details.job_title}'")

            rationale = (
                f"Selected for {r.role} due to {len(matching_skills)}/{len(req_skills or ['general'])} matching skills "
                f"and {title_score}% title relevance to {job_details.job_title or 'this role'}."
            )

            results.append(ResumeMatchScore(
                resume_id=r.id,
                role_name=r.role,
                filename=r.filename,
                match_percentage=total_score,
                breakdown={
                    "skills": int(skills_score),
                    "title": int(title_score),
                    "experience": int(exp_score),
                    "responsibilities": int(resp_score),
                    "education": int(edu_score)
                },
                matching_skills=matching_skills,
                missing_skills=missing_skills,
                strengths=strengths,
                weaknesses=weaknesses,
                rationale=rationale,
                attachment_id=r.attachment_id,
                url=r.url
            ))

        # Sort descending by match percentage
        results.sort(key=lambda x: x.match_percentage, reverse=True)
        if results:
            results[0].is_recommended = True

        return results
