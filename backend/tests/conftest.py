"""Pytest fixtures for JobMail test suite."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from mongomock_motor import AsyncMongoMockClient
from beanie import init_beanie
from app.core.config import get_settings
from app.core.security import create_access_token
from app.models import ALL_DOCUMENT_MODELS
from app.models.tenant import Tenant
from app.models.user import User
from app.models.settings import TenantSettings
from app.models.profile import Profile
from app.scripts.seed import seed_global_templates
from app.main import app

settings = get_settings()
settings.app_env = "test"


@pytest_asyncio.fixture(autouse=True)
async def init_test_db():
    """Initialize clean in-memory database before every test."""
    client = AsyncMongoMockClient()
    db = client["jobmail_test"]
    await init_beanie(database=db, document_models=ALL_DOCUMENT_MODELS)
    await seed_global_templates()
    yield
    client.close()


@pytest_asyncio.fixture
async def tenant_a():
    t = Tenant(id="tenant_a", name="Tenant Alpha")
    await t.insert()
    u = User(
        id="user_a",
        tenant_id="tenant_a",
        email="owner_a@alpha.com",
        hashed_password="hash",
        full_name="Owner A",
        role="owner"
    )
    await u.insert()
    s = TenantSettings(tenant_id="tenant_a", daily_cap=10, dnc=["blocked@competitor.com"])
    await s.insert()
    p = Profile(
        tenant_id="tenant_a",
        name="Owner A",
        email="owner_a@alpha.com",
        skills=["Python", "FastAPI", "React", "Docker"],
        experience=[
            {
                "id": "exp_a1",
                "company": "Alpha Tech",
                "role": "Lead Engineer",
                "period": "2022-2024",
                "bullets": ["Scaled backend to 10k users", "Built FastAPI microservices"]
            }
        ],
        projects=[
            {
                "id": "proj_a1",
                "company": "JobMailer",
                "role": "Creator",
                "period": "2023",
                "bullets": ["Automated email workflows"]
            }
        ]
    )
    await p.insert()
    return {"tenant": t, "user": u, "settings": s, "profile": p}


@pytest_asyncio.fixture
async def tenant_b():
    t = Tenant(id="tenant_b", name="Tenant Beta")
    await t.insert()
    u = User(
        id="user_b",
        tenant_id="tenant_b",
        email="owner_b@beta.com",
        hashed_password="hash",
        full_name="Owner B",
        role="owner"
    )
    await u.insert()
    s = TenantSettings(tenant_id="tenant_b", daily_cap=5, dnc=["blocked@spam.com"])
    await s.insert()
    p = Profile(
        tenant_id="tenant_b",
        name="Owner B",
        email="owner_b@beta.com",
        skills=["Go", "Kubernetes"],
        experience=[],
        projects=[]
    )
    await p.insert()
    return {"tenant": t, "user": u, "settings": s, "profile": p}


@pytest.fixture
def auth_headers_a(tenant_a):
    token = create_access_token({
        "sub": "user_a",
        "tenant_id": "tenant_a",
        "email": "owner_a@alpha.com",
        "role": "owner"
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_b(tenant_b):
    token = create_access_token({
        "sub": "user_b",
        "tenant_id": "tenant_b",
        "email": "owner_b@beta.com",
        "role": "owner"
    })
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
