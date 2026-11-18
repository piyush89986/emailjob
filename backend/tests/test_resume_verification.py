"""Tests for resume tailoring claim verification against master profile."""
import pytest
from app.models.profile import Profile
from app.services.ai.resume_tailorer import ResumeTailorer


def test_resume_claim_verification():
    """Prove that invented companies, unsupported bullets, or hallucinated metrics are flagged."""
    profile = Profile(
        tenant_id="test_t",
        name="Alex Doe",
        skills=["React", "Python", "FastAPI"],
        experience=[
            {
                "id": "exp_1",
                "company": "Acme Corp",
                "role": "Developer",
                "period": "2021-2023",
                "bullets": [
                    "Built FastAPI microservices handling 10k requests/sec",
                    "Maintained React frontend with Tailwind CSS"
                ]
            }
        ],
        projects=[]
    )

    # 1. Candidate tries to inject an invented company ("Google")
    invented_company_exp = [
        {
            "id": "exp_1",
            "company": "Google",  # Hallucinated company!
            "role": "Staff Engineer",
            "period": "2021-2023",
            "bullets": ["Maintained React frontend with Tailwind CSS"]
        }
    ]
    _, _, verified, unsupported = ResumeTailorer.verify_claims(profile, invented_company_exp, [])
    assert len(unsupported) > 0
    assert any("invented company" in u.lower() for u in unsupported)

    # 2. Candidate injects an exaggerated metric ("999% revenue boost")
    invented_metric_exp = [
        {
            "id": "exp_1",
            "company": "Acme Corp",
            "role": "Developer",
            "period": "2021-2023",
            "bullets": ["Boosted company revenue by 999% overnight"]  # Hallucinated metric!
        }
    ]
    _, _, verified, unsupported = ResumeTailorer.verify_claims(profile, invented_metric_exp, [])
    assert len(unsupported) > 0
    assert any("metric" in u.lower() or "unsupported" in u.lower() for u in unsupported)

    # 3. Legitimate master profile bullet passes verification
    valid_exp = [
        {
            "id": "exp_1",
            "company": "Acme Corp",
            "role": "Developer",
            "period": "2021-2023",
            "bullets": ["Built FastAPI microservices handling 10k requests/sec"]
        }
    ]
    verified_exp, _, verified, unsupported = ResumeTailorer.verify_claims(profile, valid_exp, [])
    assert len(unsupported) == 0
    assert verified == 1
    assert len(verified_exp[0]["bullets"]) == 1
