"""Resume tailoring and deterministic verification against master profile."""
import re
from typing import Any, Dict, List, Set, Tuple
from app.models.profile import Profile
from app.repositories.domain import ProfileRepo
from app.schemas.domain import TailorResumeResponse

KNOWN_SKILLS = [
    "python", "fastapi", "react", "typescript", "javascript", "node", "mongodb",
    "sql", "postgres", "docker", "kubernetes", "aws", "gcp", "redis", "graphql",
    "rest", "git", "tailwind", "next.js", "java", "django", "flask", "machine learning",
    "llm", "ci/cd"
]


def extract_keywords_from_jd(jd: str) -> List[str]:
    """Extract recognized skills from job description text."""
    lower_jd = jd.lower()
    return [s.title() for s in KNOWN_SKILLS if re.search(rf"\b{re.escape(s)}\b", lower_jd)]


def extract_numbers_and_metrics(text: str) -> Set[str]:
    """Extract metrics, percentages, and numbers from text."""
    matches = re.findall(r"\b\d+(?:\.\d+)?(?:%|\+|k|m|b|x)?\b", text.lower())
    return set(matches)


class ResumeTailorer:
    @staticmethod
    def calculate_ats_match(jd: str, candidate_skills: List[str]) -> Tuple[int, List[str], List[str]]:
        """Deterministic keyword ATS scoring in code."""
        jd_skills = extract_keywords_from_jd(jd)
        candidate_skills_lower = {s.lower() for s in candidate_skills}

        matched = [s for s in jd_skills if s.lower() in candidate_skills_lower]
        missing = [s for s in jd_skills if s.lower() not in candidate_skills_lower]

        score = round((100 * len(matched)) / len(jd_skills)) if jd_skills else 0
        return score, matched, missing

    @staticmethod
    async def tailor_and_verify(tenant_id: str, jd: str) -> TailorResumeResponse:
        """Select, reorder, and verify resume items strictly against the master profile."""
        profile_repo = ProfileRepo(tenant_id)
        profile = await profile_repo.get_or_create()

        ats_score, matched, missing = ResumeTailorer.calculate_ats_match(jd, profile.skills)
        want_skills = [s.lower() for s in matched]

        def bullet_score(bullet: str) -> int:
            b_lower = bullet.lower()
            return sum(1 for k in want_skills if k in b_lower)

        # 1. Select and prioritize experience
        tailored_exp: List[Dict[str, Any]] = []
        for exp in profile.experience:
            sorted_bullets = sorted(exp.get("bullets", []), key=bullet_score, reverse=True)
            tailored_exp.append({
                "id": exp.get("id"),
                "company": exp.get("company"),
                "role": exp.get("role"),
                "period": exp.get("period"),
                "bullets": sorted_bullets[:3],
                "_score": sum(bullet_score(b) for b in sorted_bullets)
            })
        tailored_exp.sort(key=lambda x: x["_score"], reverse=True)

        # 2. Select and prioritize projects
        tailored_proj: List[Dict[str, Any]] = []
        for proj in profile.projects:
            sorted_bullets = sorted(proj.get("bullets", []), key=bullet_score, reverse=True)
            tailored_proj.append({
                "id": proj.get("id"),
                "company": proj.get("company"),
                "role": proj.get("role"),
                "period": proj.get("period"),
                "bullets": sorted_bullets[:3],
                "_score": sum(bullet_score(b) for b in sorted_bullets)
            })
        tailored_proj.sort(key=lambda x: x["_score"], reverse=True)

        # 3. Sort skills prioritizing matched keywords
        sorted_skills = sorted(
            profile.skills,
            key=lambda s: (s.lower() in want_skills, s),
            reverse=True
        )

        # 4. Strict Verification Step
        verified_exp, verified_proj, verified_count, unsupported = ResumeTailorer.verify_claims(
            profile=profile,
            experience=tailored_exp,
            projects=tailored_proj
        )

        return TailorResumeResponse(
            experience=verified_exp,
            projects=verified_proj,
            skills=sorted_skills,
            ats=ats_score,
            matched=matched,
            missing=missing,
            verified=verified_count,
            unsupported=unsupported
        )

    @staticmethod
    def verify_claims(
        profile: Profile,
        experience: List[Dict[str, Any]],
        projects: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int, List[str]]:
        """Verify that every bullet, employer, and claim strictly exists in master profile."""
        master_exp_map = {e.get("id"): e for e in profile.experience}
        master_proj_map = {p.get("id"): p for p in profile.projects}

        master_companies = {e.get("company", "").strip().lower() for e in profile.experience + profile.projects if e.get("company")}
        master_bullets = {b.strip().lower() for e in profile.experience + profile.projects for b in e.get("bullets", [])}
        master_metrics = {m for b in master_bullets for m in extract_numbers_and_metrics(b)}

        verified_count = 0
        unsupported: List[str] = []

        verified_experience = []
        for exp in experience:
            exp_id = exp.get("id")
            master_item = master_exp_map.get(exp_id)
            if not master_item:
                unsupported.append(f"Unknown experience ID: {exp_id}")
                continue

            # Verify company
            if exp.get("company", "").strip().lower() not in master_companies:
                unsupported.append(f"Invented company: {exp.get('company')}")
                continue

            clean_bullets = []
            for bullet in exp.get("bullets", []):
                b_clean = bullet.strip().lower()
                # Check if bullet exists or introduces unverified metric
                if b_clean not in master_bullets:
                    # Check if invented metrics exist
                    bullet_metrics = extract_numbers_and_metrics(b_clean)
                    invented_metrics = bullet_metrics - master_metrics
                    if invented_metrics:
                        unsupported.append(f"Invented metric {list(invented_metrics)} in bullet: {bullet}")
                    else:
                        unsupported.append(f"Unsupported bullet claim: {bullet}")
                else:
                    clean_bullets.append(bullet)
                    verified_count += 1

            verified_experience.append({
                "id": exp.get("id"),
                "company": exp.get("company"),
                "role": exp.get("role"),
                "period": exp.get("period"),
                "bullets": clean_bullets
            })

        verified_projects = []
        for proj in projects:
            proj_id = proj.get("id")
            master_item = master_proj_map.get(proj_id)
            if not master_item:
                unsupported.append(f"Unknown project ID: {proj_id}")
                continue

            clean_bullets = []
            for bullet in proj.get("bullets", []):
                b_clean = bullet.strip().lower()
                if b_clean not in master_bullets:
                    bullet_metrics = extract_numbers_and_metrics(b_clean)
                    invented_metrics = bullet_metrics - master_metrics
                    if invented_metrics:
                        unsupported.append(f"Invented metric {list(invented_metrics)} in bullet: {bullet}")
                    else:
                        unsupported.append(f"Unsupported project claim: {bullet}")
                else:
                    clean_bullets.append(bullet)
                    verified_count += 1

            verified_projects.append({
                "id": proj.get("id"),
                "company": proj.get("company"),
                "role": proj.get("role"),
                "period": proj.get("period"),
                "bullets": clean_bullets
            })

        return verified_experience, verified_projects, verified_count, unsupported
