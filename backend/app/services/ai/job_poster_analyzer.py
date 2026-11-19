"""AI Job Poster Vision & Analysis Engine.

Extracts structured job information from uploaded images (PNG, JPG, JPEG) or PDFs using
OpenAI gpt-4o-mini vision or Gemini 1.5 Flash multimodal models.
"""
import base64
import io
import json
import re
from typing import Optional, Tuple
import httpx
from pypdf import PdfReader

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.models.job_poster import ExtractedJobDetails

log = get_logger("job_poster_analyzer")
settings = get_settings()

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

EXTRACTION_SYSTEM_PROMPT = """You are an expert AI Job Poster Analyzer and OCR Specialist.
Your task is to analyze the provided job poster (image or text) and extract accurate, structured job information.

CRITICAL RULES:
1. DO NOT HALLUCINATE: If a field is not explicitly present or reasonably inferable, return null or empty list.
2. HR EMAIL: Extract recruiter/HR email if present. If not found, return null. Do NOT fabricate email addresses.
3. HR NAME: Extract the recruiter/HR contact name if present. Otherwise return null.
4. SALARY: Extract salary, stipend, or compensation range as stated. If not mentioned, return null.
5. SKILLS: Extract explicit technical, domain, or soft skills listed in the poster as a list of strings.
6. LOCATION: Extract city, country, or whether it is Remote/Hybrid/Onsite.
7. CONFIDENCE: Provide a confidence score from 0.0 to 1.0 based on text clarity and completeness.
8. MANUAL VERIFICATION: Set requires_manual_verification=true if HR email is missing, image is partially cut off, or key job details are ambiguous.

Return ONLY a valid JSON object matching this exact schema:
{
  "company_name": "string or null",
  "job_title": "string or null",
  "location": "string or null",
  "hr_name": "string or null",
  "hr_email": "string or null",
  "contact_number": "string or null",
  "salary_range": "string or null",
  "required_skills": ["skill1", "skill2"],
  "required_experience": "string or null",
  "educational_qualifications": "string or null",
  "job_responsibilities": ["resp1", "resp2"],
  "candidate_requirements": ["req1", "req2"],
  "application_instructions": "string or null",
  "company_website": "string or null",
  "confidence_score": 0.85,
  "requires_manual_verification": false,
  "raw_text": "all readable text transcribed from the poster"
}
"""


class JobPosterAnalyzer:
    @staticmethod
    def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
        """Extract text from PDF pages using pypdf."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            texts = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    texts.append(f"--- Page {i + 1} ---\n{text.strip()}")
            return "\n\n".join(texts)
        except Exception as e:
            log.warning("pdf_text_extraction_error", error=str(e))
            return ""

    @staticmethod
    async def analyze_with_openai_vision(
        image_or_pdf_bytes: bytes,
        content_type: str,
        extracted_pdf_text: Optional[str] = None
    ) -> ExtractedJobDetails:
        """Call OpenAI gpt-4o-mini with multimodal vision or extracted text."""
        api_key = settings.openai_api_key
        if not api_key:
            raise AppError("OpenAI API key is not configured in backend/.env", status_code=503)

        messages = [{"role": "system", "content": EXTRACTION_SYSTEM_PROMPT}]

        if content_type == "application/pdf" and extracted_pdf_text and len(extracted_pdf_text.strip()) > 50:
            # Send extracted PDF text
            user_content = [
                {
                    "type": "text",
                    "text": f"Extract structured job details from this Job Description document:\n\n{extracted_pdf_text}"
                }
            ]
        else:
            # Multimodal Vision (image or scanned PDF)
            b64_data = base64.b64encode(image_or_pdf_bytes).decode("utf-8")
            mime = content_type if content_type in ["image/png", "image/jpeg", "image/jpg", "image/webp"] else "image/png"
            user_content = [
                {
                    "type": "text",
                    "text": "Analyze this job poster image and extract all structured fields according to instructions."
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{b64_data}",
                        "detail": "high"
                    }
                }
            ]

        messages.append({"role": "user", "content": user_content})

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 2000
                }
            )

            if resp.status_code != 200:
                log.error("openai_vision_error", status=resp.status_code, body=resp.text)
                raise AppError(f"OpenAI Vision failed: {resp.text}", status_code=502)

            res_json = resp.json()
            raw_content = res_json["choices"][0]["message"]["content"]
            parsed = json.loads(raw_content)
            return JobPosterAnalyzer._sanitize_and_validate(parsed)

    @staticmethod
    async def analyze_with_gemini(
        image_or_pdf_bytes: bytes,
        content_type: str,
        extracted_pdf_text: Optional[str] = None
    ) -> ExtractedJobDetails:
        """Fallback to Google Gemini 1.5 Flash multimodal vision."""
        api_key = settings.gemini_api_key
        if not api_key:
            raise AppError("Gemini API key is not configured", status_code=503)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

        parts = []
        if content_type == "application/pdf" and extracted_pdf_text and len(extracted_pdf_text.strip()) > 50:
            parts.append({"text": f"{EXTRACTION_SYSTEM_PROMPT}\n\nDocument Text:\n{extracted_pdf_text}"})
        else:
            b64_data = base64.b64encode(image_or_pdf_bytes).decode("utf-8")
            mime = content_type if content_type in ["image/png", "image/jpeg", "image/jpg", "image/webp"] else "image/png"
            parts.append({"text": EXTRACTION_SYSTEM_PROMPT})
            parts.append({
                "inline_data": {
                    "mime_type": mime,
                    "data": b64_data
                }
            })

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json"
            }
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                log.error("gemini_vision_error", status=resp.status_code, body=resp.text)
                raise AppError(f"Gemini Vision failed: {resp.text}", status_code=502)

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise AppError("Gemini Vision returned empty candidates", status_code=502)

            raw_text = candidates[0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            return JobPosterAnalyzer._sanitize_and_validate(parsed)

    @staticmethod
    def _sanitize_and_validate(parsed: dict) -> ExtractedJobDetails:
        """Sanitize email, validate fields, and calculate safety confidence."""
        hr_email = parsed.get("hr_email")
        if hr_email:
            hr_email = hr_email.strip().lower()
            match = EMAIL_REGEX.search(hr_email)
            if match:
                hr_email = match.group(0)
            else:
                hr_email = None

        requires_verification = parsed.get("requires_manual_verification", False)
        if not hr_email:
            requires_verification = True

        confidence = float(parsed.get("confidence_score") or 0.75)
        if not hr_email:
            confidence = min(confidence, 0.65)

        return ExtractedJobDetails(
            company_name=parsed.get("company_name"),
            job_title=parsed.get("job_title"),
            location=parsed.get("location"),
            hr_name=parsed.get("hr_name"),
            hr_email=hr_email,
            contact_number=parsed.get("contact_number"),
            salary_range=parsed.get("salary_range"),
            required_skills=parsed.get("required_skills") or [],
            required_experience=parsed.get("required_experience"),
            educational_qualifications=parsed.get("educational_qualifications"),
            job_responsibilities=parsed.get("job_responsibilities") or [],
            candidate_requirements=parsed.get("candidate_requirements") or [],
            application_instructions=parsed.get("application_instructions"),
            company_website=parsed.get("company_website"),
            confidence_score=round(confidence, 2),
            requires_manual_verification=requires_verification,
            raw_text=parsed.get("raw_text") or ""
        )

    @classmethod
    async def analyze(cls, file_bytes: bytes, content_type: str) -> ExtractedJobDetails:
        """Run vision extraction with automatic fallback between OpenAI and Gemini."""
        extracted_pdf_text = None
        if content_type == "application/pdf":
            extracted_pdf_text = cls._extract_text_from_pdf(file_bytes)

        # Try OpenAI first
        if settings.openai_api_key:
            try:
                log.info("analyzing_job_poster_openai", content_type=content_type, size=len(file_bytes))
                return await cls.analyze_with_openai_vision(file_bytes, content_type, extracted_pdf_text)
            except Exception as e:
                log.warning("openai_vision_failed_trying_gemini", error=str(e))

        # Fallback to Gemini
        if settings.gemini_api_key:
            try:
                log.info("analyzing_job_poster_gemini", content_type=content_type, size=len(file_bytes))
                return await cls.analyze_with_gemini(file_bytes, content_type, extracted_pdf_text)
            except Exception as e:
                log.error("gemini_vision_also_failed", error=str(e))
                raise AppError(f"AI Vision Analysis failed on all providers: {str(e)}", status_code=502)

        raise AppError("No AI Vision API key configured (OPENAI_API_KEY or GEMINI_API_KEY required)", status_code=503)

    @staticmethod
    def generate_structured_jd(details: ExtractedJobDetails) -> str:
        """Generate a clean, structured, editable markdown Job Description."""
        title = details.job_title or "Open Position"
        company = details.company_name or "Hiring Company"
        location = details.location or "Location not specified"
        salary = details.salary_range or "Negotiable / Competitive"
        exp = details.required_experience or "Relevant experience"
        edu = details.educational_qualifications or "Bachelor's degree or equivalent"

        skills_list = "\n".join(f"- {s}" for s in details.required_skills) if details.required_skills else "- General domain skills"
        resps_list = "\n".join(f"- {r}" for r in details.job_responsibilities) if details.job_responsibilities else "- Perform role-related duties and responsibilities"
        reqs_list = "\n".join(f"- {c}" for c in details.candidate_requirements) if details.candidate_requirements else f"- {exp}\n- {edu}"

        hr_contact = f"- HR Contact: {details.hr_name} ({details.hr_email})" if (details.hr_name or details.hr_email) else "- Directly through portal / attached email"
        if details.contact_number:
            hr_contact += f"\n- Phone: {details.contact_number}"

        jd_text = f"""# {title}
**Company:** {company}  
**Location:** {location}  
**Compensation:** {salary}  

---

### Company Overview
{company} is seeking an ambitious and talented {title} to join the team in {location}.

### Role Overview & Responsibilities
{resps_list}

### Required Skills & Technologies
{skills_list}

### Qualifications & Candidate Requirements
{reqs_list}

### Application Instructions
{details.application_instructions or "Submit your updated CV/Resume and portfolio for immediate consideration."}
{hr_contact}
"""
        return jd_text.strip()
