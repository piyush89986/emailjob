"""Real-time SSE event publishing and subscription using Redis Pub/Sub."""
import asyncio
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
            socket_connect_timeout=5.0,
            socket_keepalive=True,
            health_check_interval=30
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
    """Async generator yielding SSE formatted strings for a tenant with resilient keepalives."""
    channel = _channel_name(tenant_id)
    r = get_redis_client()
    pubsub = r.pubsub()

    try:
        await pubsub.subscribe(channel)
    except Exception as e:
        log.warning("redis_pubsub_subscribe_error", tenant_id=tenant_id, error=str(e))
        # Yield keepalive ping if Redis is temporarily unavailable so SSE does not crash ASGI
        yield ": ping\n\n"
        while True:
            await asyncio.sleep(15)
            yield ": ping\n\n"
        return

    try:
        # Initial keepalive
        yield ": ping\n\n"

        while True:
            try:
                # get_message with timeout allows sending periodic pings to keep the connection alive
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message and message.get("type") == "message":
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
                else:
                    # Keepalive ping to prevent proxy/browser timeout
                    yield ": ping\n\n"
            except (TimeoutError, asyncio.TimeoutError):
                yield ": ping\n\n"
            except Exception as stream_err:
                log.warning("sse_stream_notice", tenant_id=tenant_id, error=str(stream_err))
                yield ": ping\n\n"
                await asyncio.sleep(2)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
        except Exception:
            pass

