"""Email sending and attachment API router."""
from typing import List
from fastapi import APIRouter, Depends, File, UploadFile
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.domain import MsgResponse, SendEmailRequest
from app.services.sending_service import SendingService
from app.services.storage_service import StorageService

router = APIRouter(prefix="/emails", tags=["Emails"])


@router.post("/send", response_model=MsgResponse)
async def send_email(
    body: SendEmailRequest,
    user: User = Depends(get_current_user)
):
    """Enqueue outbound email with DNC validation and daily cap check."""
    msg = await SendingService.enqueue_email_send(
        tenant_id=user.tenant_id,
        user_id=user.id,
        to_address_str=body.to,
        subject=body.subject,
        body_html=body.get_body(),
        attachment_ids=body.attachment_ids,
        thread_id=body.thread_id
    )
    return MsgResponse(
        id=msg.id,
        dir=msg.dir,  # type: ignore
        from_addr=msg.from_addr,
        body=msg.body,
        at=msg.at.isoformat(),
        kind=msg.kind,  # type: ignore
        delivery=msg.delivery  # type: ignore
    )


@router.post("/{message_id}/retry", response_model=MsgResponse)
async def retry_email(
    message_id: str,
    user: User = Depends(get_current_user)
):
    """Retry sending a previously failed message."""
    msg = await SendingService.retry_send(message_id, user.tenant_id)
    return MsgResponse(
        id=msg.id,
        dir=msg.dir,  # type: ignore
        from_addr=msg.from_addr,
        body=msg.body,
        at=msg.at.isoformat(),
        kind=msg.kind,  # type: ignore
        delivery=msg.delivery  # type: ignore
    )


@router.post("/attachments")
async def upload_attachment(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload attachment for email sending."""
    content = await file.read()
    att = await StorageService.save_attachment(
        tenant_id=user.tenant_id,
        filename=file.filename or "attachment.pdf",
        content_type=file.content_type or "application/octet-stream",
        data=content
    )
    return {
        "id": att.id,
        "filename": att.filename,
        "contentType": att.content_type,
        "sizeBytes": att.size_bytes
    }
