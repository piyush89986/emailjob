"""JobMail FastAPI production entrypoint."""
import asyncio
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from beanie import init_beanie

# Fix Motor compatibility with Beanie 2.0 / PyMongo 4.9+ metadata append
if not hasattr(AsyncIOMotorClient, "append_metadata"):
    AsyncIOMotorClient.append_metadata = lambda self, *args, **kwargs: None

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import get_logger, request_id_var, setup_logging
from app.models import ALL_DOCUMENT_MODELS
from app.models.user import User
from app.scripts.seed import seed_global_templates

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.accounts import router as accounts_router, oauth_callback
from app.api.v1.emails import router as emails_router
from app.api.v1.threads import router as threads_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.applications import router as applications_router
from app.api.v1.templates import router as templates_router
from app.api.v1.settings import router as settings_router
from app.api.v1.ai import router as ai_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.account import router as account_router
from app.api.v1.events import router as events_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.role_resumes import router as role_resumes_router
from app.api.v1.apply_studio import router as apply_studio_router
from app.api.v1.workflows import router as workflows_router
from app.api.v1.hr_inbox import router as hr_inbox_router

settings = get_settings()
setup_logging()
log = get_logger("main")


async def init_db_with_retries(mongo_client, db_name: str, max_retries: int = 3):
    """Initialize Beanie ODM with retries to handle cloud DB latency."""
    if settings.app_env == "test":
        return True
    for attempt in range(1, max_retries + 1):
        try:
            log.info("initializing_beanie", attempt=attempt, db=db_name)
            await init_beanie(database=mongo_client[db_name], document_models=ALL_DOCUMENT_MODELS)
            await seed_global_templates()
            log.info("database_and_templates_initialized")
            return True
        except Exception as e:
            log.warning("beanie_init_attempt_failed", attempt=attempt, error=str(e))
            if attempt < max_retries:
                await asyncio.sleep(1)
    log.error("beanie_failed_all_retries")
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    timeout_ms = 500 if settings.app_env == "test" else 30000
    app.state.mongo = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=timeout_ms)
    app.state.redis = Redis.from_url(settings.redis_url)

    await init_db_with_retries(app.state.mongo, settings.mongo_db)

    log.info("startup", env=settings.app_env)
    yield

    app.state.mongo.close()
    try:
        await app.state.redis.aclose()
    except Exception:
        pass


app = FastAPI(
    title="JobMail API",
    version="1.0.0",
    description="Multi-tenant job-application email SaaS backend API",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers
register_error_handlers(app)


# Auto-heal DB Connection Middleware
@app.middleware("http")
async def ensure_db_mw(request: Request, call_next):
    """Ensure Beanie models are initialized before processing request."""
    if settings.app_env != "test":
        try:
            User.get_pymongo_collection()
        except Exception:
            try:
                log.info("auto_healing_beanie_on_request")
                await init_beanie(database=request.app.state.mongo[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
                await seed_global_templates()
            except Exception as e:
                log.error("auto_heal_failed", error=str(e))
    return await call_next(request)


# Request ID & Logging Middleware
@app.middleware("http")
async def request_id_mw(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex
    request_id_var.set(rid)
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


# Security Headers Middleware
@app.middleware("http")
async def security_headers_mw(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Health Check
@app.get("/health", tags=["Health"])
async def health(request: Request):
    """Liveness and dependency check."""
    status = {"api": "ok"}
    if settings.app_env != "test":
        try:
            await asyncio.wait_for(request.app.state.mongo.admin.command("ping"), timeout=2.0)
            status["mongo"] = "ok"
        except Exception as e:
            status["mongo"] = f"down: {str(e)}"
        try:
            await asyncio.wait_for(request.app.state.redis.ping(), timeout=2.0)
            status["redis"] = "ok"
        except Exception as e:
            status["redis"] = f"down: {str(e)}"
    else:
        status["mongo"] = "ok"
        status["redis"] = "ok"

    # Check Beanie status & auto-heal if needed
    try:
        col = User.get_pymongo_collection()
        status["beanie"] = "ok"
    except Exception as e:
        try:
            await init_beanie(database=request.app.state.mongo[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
            await seed_global_templates()
            status["beanie"] = "healed"
        except Exception as init_err:
            status["beanie"] = f"error: {type(init_err).__name__}: {str(init_err)}"

    mongo_target = "localhost" if "localhost" in settings.mongo_uri else (
        settings.mongo_uri.split("@")[-1].split("/")[0] if "@" in settings.mongo_uri else "remote"
    )
    status["mongo_target"] = mongo_target
    status["db_name"] = settings.mongo_db
    status["env"] = settings.app_env
    return status


# Mount Routers
app.include_router(auth_router)
app.include_router(accounts_router)

# Alias for alternate Google OAuth redirect URI
@app.get("/api/auth/google/callback", tags=["Email Accounts"])
async def google_callback_alias(code: str, state: str):
    return await oauth_callback(provider="gmail", code=code, state=state)
app.include_router(emails_router)
app.include_router(threads_router)
app.include_router(contacts_router)
app.include_router(applications_router)
app.include_router(templates_router)
app.include_router(settings_router)
app.include_router(ai_router)
app.include_router(dashboard_router)
app.include_router(account_router)
app.include_router(events_router)
app.include_router(webhooks_router)
app.include_router(role_resumes_router)
app.include_router(role_resumes_router, prefix="/api")
app.include_router(apply_studio_router)
app.include_router(apply_studio_router, prefix="/api")
app.include_router(workflows_router)
app.include_router(workflows_router, prefix="/api")
app.include_router(hr_inbox_router)
app.include_router(hr_inbox_router, prefix="/api")
