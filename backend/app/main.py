"""JobMail FastAPI production entrypoint."""
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from redis.asyncio import Redis
from beanie import init_beanie

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import get_logger, request_id_var, setup_logging
from app.models import ALL_DOCUMENT_MODELS
from app.scripts.seed import seed_global_templates

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.accounts import router as accounts_router
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

settings = get_settings()
setup_logging()
log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.mongo = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
    app.state.redis = Redis.from_url(settings.redis_url)

    try:
        await init_beanie(database=app.state.mongo[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
        await seed_global_templates()
        log.info("database_and_templates_initialized")
    except Exception as e:
        log.warning("beanie_startup_warning", error=str(e))

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Error handlers
register_error_handlers(app)


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
    try:
        await request.app.state.mongo.admin.command("ping")
        status["mongo"] = "ok"
    except Exception:
        status["mongo"] = "down"
    try:
        await request.app.state.redis.ping()
        status["redis"] = "ok"
    except Exception:
        status["redis"] = "down"
    return status


# Mount Routers
app.include_router(auth_router)
app.include_router(accounts_router)
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
