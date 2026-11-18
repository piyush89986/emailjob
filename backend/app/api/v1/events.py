"""Real-time Server-Sent Events (SSE) router."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.errors import UnauthorizedError
from app.core.events import event_generator
from app.core.security import decode_token

router = APIRouter(tags=["Events"])
security = HTTPBearer(auto_error=False)


@router.get("/events")
async def sse_events_stream(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """Subscribe to real-time events for tenant (supports both query param token and header)."""
    jwt_str = token or (credentials.credentials if credentials else None)
    if not jwt_str:
        raise UnauthorizedError("Missing authentication token")

    try:
        payload = decode_token(jwt_str)
    except Exception:
        raise UnauthorizedError("Invalid or expired token")

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise UnauthorizedError("Invalid token claims")

    return StreamingResponse(
        event_generator(tenant_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
