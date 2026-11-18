"""Real-time Server-Sent Events (SSE) router."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.core.events import event_generator
from app.core.security import decode_token
from app.models.user import User

router = APIRouter(tags=["Events"])


@router.get("/events")
async def sse_events_stream(
    token: str = Query(None),
    user: User = Depends(get_current_user)
):
    """Subscribe to real-time events for tenant (reply.received, unread.count, account.needs_reauth, delivery.updated)."""
    return StreamingResponse(
        event_generator(user.tenant_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
