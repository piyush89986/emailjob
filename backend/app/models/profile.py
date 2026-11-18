"""Master profile model storing developer experience, skills, and projects."""
from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid
from beanie import Document
from pymongo import IndexModel, ASCENDING
from pydantic import Field


class Profile(Document):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    tenant_id: str
    name: str = "Alex Doe"
    email: str = "alex@gmail.com"
    headline: str = "Full-stack developer"
    skills: List[str] = Field(default_factory=lambda: [
        "React", "TypeScript", "Python", "FastAPI", "MongoDB", "Docker", "Git", "Tailwind"
    ])
    experience: List[Dict[str, Any]] = Field(default_factory=lambda: [
        {
            "id": "e1",
            "company": "Beta Labs",
            "role": "Software Engineer",
            "period": "2023–Present",
            "bullets": [
                "Built React dashboards used by 3 teams",
                "Developed FastAPI services backed by MongoDB",
                "Containerised services with Docker",
                "Wrote onboarding documentation"
            ]
        },
        {
            "id": "e2",
            "company": "Gamma Studio",
            "role": "Intern",
            "period": "2022",
            "bullets": [
                "Built UI components with Tailwind",
                "Fixed bugs in a TypeScript codebase"
            ]
        }
    ])
    projects: List[Dict[str, Any]] = Field(default_factory=lambda: [
        {
            "id": "p1",
            "company": "JobTracker",
            "role": "Side project",
            "period": "2022",
            "bullets": [
                "Python script that tracks job postings",
                "React front-end for browsing saved jobs"
            ]
        }
    ])
    education: str = "B.Tech Computer Science, 2023"
    links: str = "github.com/alexdoe"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "profiles"
        indexes = [
            IndexModel([("tenant_id", ASCENDING)], unique=True),
        ]
