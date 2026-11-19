"""Inbox threads API router."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.api.deps import get_message_repo, get_thread_repo
from app.core.errors import NotFoundError
from app.models.message import Message
from app.models.thread import Thread
from app.repositories.domain import MessageRepo, ThreadRepo
from app.schemas.domain import MsgResponse, ThreadResponse

router = APIRouter(prefix="/threads", tags=["Inbox"])


AUTOMATED_SENDERS = (
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "notifications@", "notification@", "alert@", "alerts@",
    "billing@", "updates@", "slice.bank", "support@", "jobalert",
    "jobhai", "internshala", "indeed", "linkedin", "naukri",
    "newsletter", "marketing", "mailer-daemon", "postmaster", "vercel.com"
)


def derive_thread_state(messages: List[Message]) -> str:
    """Derive thread status matching frontend threadState(): 'replied' | 'waiting' | 'bounced'."""
    if any(m.kind == "bounce" for m in messages):
        return "bounced"
    if any(
        m.dir == "in"
        and m.kind == "normal"
        and not any(s in (m.from_addr or "").lower() for s in AUTOMATED_SENDERS)
        for m in messages
    ):
        return "replied"
    return "waiting"


@router.get("", response_model=List[ThreadResponse])
async def list_threads(
    filter: str = Query("all", pattern="^(all|replied|waiting|bounced)$"),
    q: Optional[str] = None,
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo)
):
    """List inbox threads with filter and search."""
    if q:
        threads = await thread_repo.search_threads(q.strip())
    else:
        threads = await thread_repo.find_all(sort=[("updated_at", -1)])

    results: List[ThreadResponse] = []
    for t in threads:
        messages = await msg_repo.find_by_thread_id(t.id)
        state = derive_thread_state(messages)

        if filter != "all" and state != filter:
            continue

        msg_responses = [
            MsgResponse(
                id=m.id,
                dir=m.dir,  # type: ignore
                from_addr=m.from_addr,
                body=m.body,
                at=m.at.isoformat(),
                kind=m.kind,  # type: ignore
                delivery=m.delivery  # type: ignore
            )
            for m in messages
        ]

        results.append(
            ThreadResponse(
                id=t.id,
                subject=t.subject,
                contact_id=t.contact_id,
                unread=t.unread,
                messages=msg_responses
            )
        )
    return results


@router.get("/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: str,
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo)
):
    """Get single thread by ID with full messages."""
    t = await thread_repo.get_by_id(thread_id)
    if not t:
        raise NotFoundError("Thread not found")

    messages = await msg_repo.find_by_thread_id(t.id)
    msg_responses = [
        MsgResponse(
            id=m.id,
            dir=m.dir,  # type: ignore
            from_addr=m.from_addr,
            body=m.body,
            at=m.at.isoformat(),
            kind=m.kind,  # type: ignore
            delivery=m.delivery  # type: ignore
        )
        for m in messages
    ]
    return ThreadResponse(
        id=t.id,
        subject=t.subject,
        contact_id=t.contact_id,
        unread=t.unread,
        messages=msg_responses
    )


@router.post("/{thread_id}/read")
async def mark_thread_read(
    thread_id: str,
    thread_repo: ThreadRepo = Depends(get_thread_repo)
):
    """Mark thread as read."""
    await thread_repo.update(thread_id, unread=False)
    return {"status": "ok", "unread": False}
