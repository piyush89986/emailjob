"""Dashboard statistics and follow-up suggestions API router."""
from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import (
    get_contact_repo,
    get_message_repo,
    get_settings_repo,
    get_thread_repo,
)
from app.api.v1.threads import derive_thread_state
from app.repositories.domain import (
    ContactRepo,
    MessageRepo,
    SettingsRepo,
    ThreadRepo,
)
from app.schemas.domain import (
    DashboardFollowupsResponse,
    DashboardStatsResponse,
    FollowupItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo),
    contact_repo: ContactRepo = Depends(get_contact_repo)
):
    """Get weekly sent count, reply rate, waiting threads, and interview stats."""
    sent_week = await msg_repo.count_sent_this_week()
    all_threads = await thread_repo.find_all()

    replied_count = 0
    waiting_count = 0
    for t in all_threads:
        messages = await msg_repo.find_by_thread_id(t.id)
        state = derive_thread_state(messages)
        if state == "replied":
            replied_count += 1
        elif state == "waiting":
            waiting_count += 1

    total_threads = len(all_threads)
    reply_rate_str = f"{round((100 * replied_count) / total_threads)}%" if total_threads > 0 else "0%"
    interview_count = await contact_repo.count({"status": "Interview"})

    return DashboardStatsResponse(
        sent_this_week=sent_week,
        reply_rate=reply_rate_str,
        awaiting_reply=waiting_count,
        interviews=interview_count
    )


@router.get("/followups", response_model=DashboardFollowupsResponse)
async def get_followup_suggestions(
    thread_repo: ThreadRepo = Depends(get_thread_repo),
    msg_repo: MessageRepo = Depends(get_message_repo),
    contact_repo: ContactRepo = Depends(get_contact_repo),
    settings_repo: SettingsRepo = Depends(get_settings_repo)
):
    """Suggest follow-ups for waiting threads older than 5 days. Suggestions only, never auto-sends."""
    all_threads = await thread_repo.find_all()
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=5)

    followups: List[FollowupItem] = []
    waiting_count = 0

    for t in all_threads:
        messages = await msg_repo.find_by_thread_id(t.id)
        state = derive_thread_state(messages)
        if state == "waiting":
            waiting_count += 1
            last_msg = messages[-1] if messages else None
            # Normalize message timestamp to timezone aware
            msg_at = last_msg.at if last_msg else t.updated_at
            if msg_at.tzinfo is None:
                msg_at = msg_at.replace(tzinfo=timezone.utc)
            if msg_at < threshold:
                contact = await contact_repo.get_by_id(t.contact_id)
                days_waiting = (now - msg_at).days
                followups.append(
                    FollowupItem(
                        id=t.id,
                        subject=t.subject,
                        contact_name=contact.name if contact else "Contact",
                        contact_id=t.contact_id,
                        days_waiting=days_waiting
                    )
                )

    return DashboardFollowupsResponse(
        followups=followups,
        waiting_count=waiting_count
    )
