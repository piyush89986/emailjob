"""Real-time SSE event publishing and subscription using Redis Pub/Sub."""
import json
from typing import AsyncGenerator, Dict, Any, Optional
from redis.asyncio import Redis
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("events")
settings = get_settings()

_redis_client: Optional[Redis] = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=3.0,
            socket_timeout=3.0
        )
    return _redis_client


def _channel_name(tenant_id: str) -> str:
    return f"events:{tenant_id}"


async def publish_event(tenant_id: str, event_type: str, data: Dict[str, Any]) -> None:
    """Publish a real-time event to the tenant channel."""
    try:
        r = get_redis_client()
        payload = json.dumps({"event": event_type, "data": data})
        await r.publish(_channel_name(tenant_id), payload)
        log.info("event_published", tenant_id=tenant_id, event_type=event_type)
    except Exception as e:
        log.warning("event_publish_failed", tenant_id=tenant_id, event_type=event_type, error=str(e))


async def event_generator(tenant_id: str) -> AsyncGenerator[str, None]:
    """Async generator yielding SSE formatted strings for a tenant."""
    r = get_redis_client()
    pubsub = r.pubsub()
    channel = _channel_name(tenant_id)
    await pubsub.subscribe(channel)
    try:
        # Send initial keepalive
        yield f": ping\n\n"
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                try:
                    parsed = json.loads(data)
                    event_type = parsed.get("event", "message")
                    event_data = json.dumps(parsed.get("data", {}))
                    yield f"event: {event_type}\ndata: {event_data}\n\n"
                except Exception:
                    yield f"data: {data}\n\n"
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
