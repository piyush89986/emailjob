"""AI email drafter generating 3 preview variants strictly from the master profile."""
from typing import List, Optional
from pydantic import BaseModel
from app.repositories.domain import ProfileRepo, TemplateRepo
from app.schemas.domain import DraftVariant
from app.services.ai.jd_extractor import JdExtractor
from app.services.ai.llm_router import LLMRouter


class DraftsOutput(BaseModel):
    variants: List[DraftVariant]


class EmailDrafter:
    @staticmethod
    async def generate_draft_variants(
        tenant_id: str,
        jd: str,
        tone: str = "friendly",
        template_id: Optional[str] = None
    ) -> List[DraftVariant]:
        """Generate 3 draft email variants (Direct, Warm/Formal, Short) strictly using the master profile."""
        profile_repo = ProfileRepo(tenant_id)
        profile = await profile_repo.get_or_create()

        extracted = await JdExtractor.extract_from_url_or_text(tenant_id, text=jd)
        role = extracted.role or "the open position"
        company = extracted.company or "your company"
        hr_name = extracted.hr or "Hiring Team"
        top_skills = ", ".join(extracted.skills[:4] if extracted.skills else profile.skills[:4])
        my_name = profile.name

        # If a specific template was selected, check if user wanted to interpolate it
        tpl_subject = ""
        tpl_body = ""
        if template_id:
            tpl_repo = TemplateRepo(tenant_id)
            tpl = await tpl_repo.get_by_id(template_id)
            if tpl:
                tpl_subject = tpl.subject
                tpl_body = tpl.body

        prompt = f"""
Candidate Profile:
Name: {profile.name}
Headline: {profile.headline}
Skills: {', '.join(profile.skills)}
Education: {profile.education}

Target Job:
Role: {role}
Company: {company}
Recipient: {hr_name}
Target Skills: {top_skills}
Tone: {tone}
{"Template to adapt:" + tpl_body if tpl_body else ""}

Generate 3 distinct email draft variants:
1. "Direct" (clear, professional, to the point)
2. "{"Formal" if tone == "formal" else "Warm"}" (engaging, highlighting enthusiasm and team fit)
3. "Short" (concise 2-3 sentences for busy recruiters)

Rule: Do NOT invent any past companies or degrees that are not in the candidate profile.
Return valid HTML in body (<p> paragraphs, <br> line breaks).
"""

        system_instruction = (
            "You are an expert career advisor. Generate 3 email applications. "
            "Never invent facts or claims not present in the candidate profile. "
            "Output must strictly follow the JSON schema with exactly 3 variants: Direct, Warm/Formal, Short."
        )

        try:
            res = await LLMRouter.generate_with_fallback(
                tenant_id=tenant_id,
                prompt=prompt,
                response_schema=DraftsOutput,
                system_instruction=system_instruction
            )
            return res.variants
        except Exception:
            # Deterministic profile-based fallback variants matching the frontend specification
            hi = f"Dear {hr_name}" if hr_name and hr_name != "Hiring Team" else "Hello"
            return [
                DraftVariant(
                    label="Direct",
                    subject=f"Application for {role} – {my_name}",
                    body=f"<p>{hi},</p><p>I'm applying for {role} at {company}. My experience with {top_skills} fits your requirements. Resume attached.</p><p>Regards,<br>{my_name}</p>"
                ),
                DraftVariant(
                    label="Formal" if tone == "formal" else "Warm",
                    subject=f"{role} at {company} – interested",
                    body=f"<p>{hi},</p><p>I came across the {role} role at {company} and was excited by it. I've worked with {top_skills} and would love to contribute.</p><p>Could we speak this week? Best,<br>{my_name}</p>"
                ),
                DraftVariant(
                    label="Short",
                    subject=f"{role} – {my_name}",
                    body=f"<p>{hi}, I'd like to be considered for {role} ({top_skills}). Resume attached. Thanks, {my_name}</p>"
                )
            ]
