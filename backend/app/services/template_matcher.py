"""Template matching and variable substitution service for Apply Studio.

Finds matching role-based email templates from user's saved templates or global templates.
If a matching template exists, populates variables ({{role}}, {{company}}, {{my_name}}, etc.).
If no matching template is found, seamlessly falls back to AI generation.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.models.profile import Profile
from app.models.template import Template
from app.models.user import User
from app.repositories.domain import TemplateRepo

log = get_logger("template_matcher")

# Stopwords to filter out when tokenizing role titles
ROLE_STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "for", "at", "to", "of", "with",
    "job", "role", "position", "opportunity", "hiring", "wanted", "looking",
    "application", "apply", "urgent", "required", "opening", "openings",
    "candidate", "mail", "email", "template", "outreach", "cold", "pitch"
}

# Role synonym & acronym dictionary for intelligent matching
ROLE_ALIASES = {
    "bde": ["business development executive", "business development", "sales executive", "bd executive"],
    "bda": ["business development associate", "business development"],
    "sde": ["software development engineer", "software engineer", "software developer"],
    "swe": ["software engineer", "software developer"],
    "frontend": ["front end", "fe", "ui developer", "react developer", "vue developer", "angular"],
    "backend": ["back end", "be", "api developer", "python developer", "node developer", "java developer"],
    "fullstack": ["full stack", "full-stack", "mern", "mean"],
    "pm": ["product manager", "project manager", "program manager"],
    "qa": ["quality assurance", "software tester", "sdet", "test engineer"],
    "hr": ["human resources", "talent acquisition", "recruiter", "talent partner"],
    "da": ["data analyst", "business analyst", "data analytics"],
    "ds": ["data scientist", "machine learning", "ai engineer"],
    "designer": ["ui designer", "ux designer", "product designer", "graphic designer"],
    "devops": ["site reliability engineer", "sre", "cloud engineer", "infrastructure engineer"],
    "sales": ["account executive", "inside sales", "sales development", "sdr"]
}


class TemplateMatcher:
    """Matches candidate job roles against user's saved email templates."""

    @staticmethod
    def _clean_tokens(text: str) -> set:
        """Extract clean alphanumeric lowercase tokens, filtering common stopwords."""
        if not text:
            return set()
        clean = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = clean.split()
        return {t for t in tokens if len(t) > 1 and t not in ROLE_STOPWORDS}

    @classmethod
    def _score_template_match(cls, role_title: str, template: Template) -> float:
        """Calculate confidence score (0.0 - 1.0) for template relevance to role_title."""
        if not role_title or not template:
            return 0.0

        clean_role = re.sub(r"[^\w\s]", " ", role_title.lower()).strip()
        tpl_name = re.sub(r"[^\w\s]", " ", (template.name or "").lower()).strip()
        tpl_subj = re.sub(r"[^\w\s]", " ", (template.subject or "").lower()).strip()

        # 1. Exact or direct substring match in template name (e.g. "BDE" in "BDE Application")
        if clean_role and tpl_name:
            if clean_role in tpl_name or tpl_name in clean_role:
                # Custom user template scores higher than global template
                return 1.0 if not template.global_template else 0.9

        role_tokens = cls._clean_tokens(role_title)
        tpl_name_tokens = cls._clean_tokens(template.name)
        tpl_subj_tokens = cls._clean_tokens(template.subject)
        combined_tpl_tokens = tpl_name_tokens.union(tpl_subj_tokens)

        # 2. Check acronym / alias expansions
        expanded_role_terms = set(role_tokens)
        for term in list(role_tokens):
            if term in ROLE_ALIASES:
                for alias in ROLE_ALIASES[term]:
                    expanded_role_terms.update(cls._clean_tokens(alias))
            for key, aliases in ROLE_ALIASES.items():
                if any(clean_term in clean_role for clean_term in aliases):
                    expanded_role_terms.add(key)
                    expanded_role_terms.update(cls._clean_tokens(key))

        if not role_tokens or not combined_tpl_tokens:
            return 0.0

        # 3. Intersect tokens
        intersect = expanded_role_terms.intersection(combined_tpl_tokens)
        if not intersect:
            return 0.0

        # Calculate overlap ratio against base role tokens
        overlap_ratio = len(intersect) / max(len(role_tokens), 1)

        # Base score
        score = 0.5 + (0.4 * min(overlap_ratio, 1.0))

        # Preference bonus for tenant-created custom templates
        if not template.global_template:
            score += 0.1

        return min(score, 0.98)

    @classmethod
    async def find_best_template_for_role(
        cls,
        tenant_id: str,
        role_title: str,
        preferred_template_id: Optional[str] = None
    ) -> Tuple[Optional[Template], float]:
        """Find the best matching template for a given role title.

        Returns (Template, score) or (None, 0.0) if no template passes threshold.
        """
        repo = TemplateRepo(tenant_id)
        templates = await repo.list_for_tenant_with_globals()
        if not templates:
            return None, 0.0

        # If user explicitly specified a template ID, use it directly
        if preferred_template_id:
            for tpl in templates:
                if str(tpl.id) == str(preferred_template_id):
                    return tpl, 1.0

        best_tpl = None
        best_score = 0.0

        for tpl in templates:
            score = cls._score_template_match(role_title, tpl)
            if score > best_score:
                best_score = score
                best_tpl = tpl

        # Minimum confidence threshold (0.55 = clear relevance)
        if best_tpl and best_score >= 0.55:
            return best_tpl, round(best_score, 2)

        return None, 0.0

    @staticmethod
    def render_template_text(template_str: str, variables: Dict[str, Any]) -> str:
        """Substitutes dynamic variables into template text.

        Handles {{var}}, {{ var }}, {var}, { var } with case-insensitivity.
        """
        if not template_str:
            return ""

        rendered = template_str
        for key, raw_val in variables.items():
            val = str(raw_val) if raw_val is not None else ""
            # Regex pattern matches {{key}}, {{ key }}, {key}, { key }
            pattern = re.compile(rf"\{{\{{\s*{re.escape(key)}\s*\}}\}}|\{{\s*{re.escape(key)}\s*\}}", re.IGNORECASE)
            rendered = pattern.sub(val, rendered)

        # Clean up any leftover empty placeholders like {{foo}}
        rendered = re.sub(r"\{\{[^}]+\}\}", "", rendered)
        return rendered

    @classmethod
    async def compose_email(
        cls,
        tenant_id: str,
        job_title: str,
        company_name: str,
        hr_name: Optional[str],
        hr_email: Optional[str],
        matching_skills: Optional[List[str]] = None,
        match_score: Optional[int] = None,
        tone: str = "formal",
        preferred_template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Core application email composer.

        1. Searches user's saved email templates for matching role.
        2. If found -> populates template variables.
        3. If not found -> generates personalized application email via AI.
        """
        # Fetch profile for candidate info
        profile = await Profile.find_one(Profile.tenant_id == tenant_id)
        candidate_name = profile.name if profile and profile.name else "Candidate"
        candidate_email = profile.email if profile and profile.email else ""
        candidate_phone = profile.phone if profile and profile.phone else ""

        title = job_title or "Open Role"
        company = company_name or "Hiring Team"
        hr = hr_name or "Hiring Manager"
        skills_str = ", ".join(matching_skills[:5]) if matching_skills else "modern professional skills"
        score_val = f"{match_score}%" if match_score is not None else "85%"

        # Template substitution dictionary
        variables = {
            # Role
            "role": title,
            "jobTitle": title,
            "job_title": title,
            "position": title,
            "role_name": title,
            # Company
            "company": company,
            "companyName": company,
            "company_name": company,
            # Recruiter / HR
            "hr_name": hr,
            "hrName": hr,
            "hr_email": hr_email or "",
            "recruiter_name": hr,
            "recruiter": hr,
            # Candidate
            "my_name": candidate_name,
            "candidateName": candidate_name,
            "candidate_name": candidate_name,
            "name": candidate_name,
            "candidateEmail": candidate_email,
            "email": candidate_email,
            "candidatePhone": candidate_phone,
            "phone": candidate_phone,
            # Skills
            "skills": skills_str,
            "matchingSkills": skills_str,
            "matching_skills": skills_str,
            "key_skills": skills_str,
            # Match Score
            "matchScore": score_val,
            "score": score_val,
        }

        # Step 1: Attempt template match
        matched_tpl, match_score_metric = await cls.find_best_template_for_role(
            tenant_id=tenant_id,
            role_title=title,
            preferred_template_id=preferred_template_id
        )

        if matched_tpl:
            log.info(
                f"Matched template '{matched_tpl.name}' (id={matched_tpl.id}) for role '{title}' with score {match_score_metric}"
            )
            subj = cls.render_template_text(matched_tpl.subject, variables)
            body = cls.render_template_text(matched_tpl.body, variables)

            # Ensure body has basic HTML tags if plain text
            if "<p>" not in body and "<br>" not in body:
                body = "".join(f"<p>{p.strip()}</p>" for p in body.split("\n\n") if p.strip())

            return {
                "template_matched": True,
                "template_id": str(matched_tpl.id),
                "template_name": matched_tpl.name,
                "generation_source": "template",
                "match_confidence": match_score_metric,
                "to_email": hr_email or "",
                "subject": subj or f"Application for {title} - {candidate_name}",
                "body_html": body
            }

        # Step 2: No template matched -> AI Email Drafter fallback
        log.info(f"No saved template matched for role '{title}'. Falling back to AI draft.")

        # Build tone-adjusted cold application email
        if tone == "friendly":
            subj = f"Excited about the {title} role at {company} – {candidate_name}"
            body = f"""<p>Hi {hr},</p>
<p>I hope this email finds you well! I recently came across the <strong>{title}</strong> opening at <strong>{company}</strong> and was very excited to apply.</p>
<p>With hands-on experience in <strong>{skills_str}</strong>, I'm confident I can make an immediate, positive impact on your team. I have attached my updated resume for your review.</p>
<p>I'd love the opportunity to chat briefly about how my skill set aligns with what you're building at {company}.</p>
<p>Warm regards,<br><strong>{candidate_name}</strong></p>"""
        elif tone == "concise":
            subj = f"{title} Application – {candidate_name}"
            body = f"""<p>Dear {hr},</p>
<p>I am writing to apply for the <strong>{title}</strong> position at <strong>{company}</strong>. My core expertise in <strong>{skills_str}</strong> aligns directly with your requirements.</p>
<p>Please find my resume attached. I would appreciate the opportunity for a brief introductory conversation.</p>
<p>Thank you,<br><strong>{candidate_name}</strong></p>"""
        else:
            # Default "formal" tone
            subj = f"Application for {title} - {candidate_name}"
            body = f"""<p>Dear {hr},</p>
<p>I am writing to express my strong interest in the <strong>{title}</strong> position at <strong>{company}</strong>.</p>
<p>Given the requirements outlined for the role and my background in <strong>{skills_str}</strong>, I believe I can bring valuable contributions to your organization. Please find my updated resume attached for your consideration.</p>
<p>I would welcome the opportunity to discuss my qualifications with you in greater detail. Thank you for your time and review.</p>
<p>Sincerely,<br><strong>{candidate_name}</strong></p>"""

        return {
            "template_matched": False,
            "template_id": None,
            "template_name": None,
            "generation_source": "ai",
            "match_confidence": 0.0,
            "to_email": hr_email or "",
            "subject": subj,
            "body_html": body
        }
