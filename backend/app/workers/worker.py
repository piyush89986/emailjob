"""ARQ worker for background email sending, polling sync, and watch renewals."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from arq.connections import RedisSettings
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.models import ALL_DOCUMENT_MODELS
from app.models.account import EmailAccount
from app.services.sending_service import SendingService
from app.services.sync_service import SyncService
from app.services.providers.gmail_provider import GmailProvider
from app.services.providers import get_email_provider

setup_logging()
log = get_logger("worker")
settings = get_settings()


async def send_email_task(ctx, message_id: str, tenant_id: str) -> None:
    """ARQ job executing outbound email send."""
    log.info("worker_send_email_started", message_id=message_id, tenant_id=tenant_id)
    await SendingService.process_send_job(message_id, tenant_id)


async def sync_all_accounts_job(ctx) -> None:
    """Periodic cron job polling connected mailboxes."""
    accounts = await EmailAccount.find(EmailAccount.status == "connected").to_list()
    log.info("sync_all_accounts_cron", count=len(accounts))
    for acc in accounts:
        try:
            await SyncService.sync_account(acc)
        except Exception as e:
            log.warning("cron_sync_account_failed", account_id=acc.id, error=str(e))


async def renew_watches_job(ctx) -> None:
    """Daily cron job renewing Gmail watches and Graph subscriptions."""
    log.info("renew_watches_cron_started")
    accounts = await EmailAccount.find(EmailAccount.provider == "gmail", EmailAccount.status == "connected").to_list()
    for acc in accounts:
        try:
            provider = get_email_provider(acc)
            if isinstance(provider, GmailProvider) and settings.gmail_pubsub_topic:
                await provider.register_watch(settings.gmail_pubsub_topic)
        except Exception as e:
            log.warning("renew_watch_failed", account_id=acc.id, error=str(e))


async def startup(ctx):
    """Worker startup hook: initialize Beanie ODM."""
    log.info("worker_startup")
    ctx["mongo_client"] = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(database=ctx["mongo_client"][settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)


async def shutdown(ctx):
    """Worker shutdown hook: close DB connection."""
    log.info("worker_shutdown")
    ctx["mongo_client"].close()


class WorkerSettings:
    functions = [send_email_task]
    cron_jobs = [
        # Poll every 2 minutes
        # renew watches once daily
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    poll_delay = 0.5
