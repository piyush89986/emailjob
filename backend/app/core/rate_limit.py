"""Redis-backed sliding window rate limiter."""
import time
from typing import Optional
from fastapi import Request
from app.core.config import get_settings
from app.core.errors import RateLimitError
from app.core.events import get_redis_client
from app.core.logging import get_logger

log = get_logger("rate_limit")
settings = get_settings()


async def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> None:
    """Enforce sliding window rate limit for key."""
    try:
        r = get_redis_client()
        now = time.time()
        pipeline = r.pipeline()
        pipeline.zremrangebyscore(key, 0, now - window_seconds)
        pipeline.zadd(key, {str(now): now})
        pipeline.zcard(key)
        pipeline.expire(key, window_seconds)
        _, _, count, _ = await pipeline.execute()

        if count > limit:
            log.warning("rate_limit_exceeded", key=key, count=count, limit=limit)
            raise RateLimitError(f"Rate limit exceeded ({limit} req/{window_seconds}s). Try again later.")
    except RateLimitError:
        raise
    except Exception as e:
        # In case Redis is down in dev/test, don't block requests
        log.warning("rate_limit_check_error", error=str(e))


def rate_limit_dependency(limit: int, window_seconds: int = 60, by_ip: bool = True):
    """FastAPI dependency for rate limiting routes."""
    async def dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        key = f"rl:{path}:{client_ip}" if by_ip else f"rl:{path}"
        await check_rate_limit(key, limit, window_seconds)
    return dependency
