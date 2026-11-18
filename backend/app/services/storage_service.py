"""Attachment storage interface supporting in-memory, base64 and GridFS storage."""
import base64
from typing import Optional, Tuple
from app.models.attachment import Attachment
from app.repositories.domain import AttachmentRepo


class StorageService:
    @staticmethod
    async def save_attachment(
        tenant_id: str,
        filename: str,
        content_type: str,
        data: bytes
    ) -> Attachment:
        repo = AttachmentRepo(tenant_id)
        encoded = base64.b64encode(data).decode("utf-8")
        att = await repo.create(
            filename=filename,
            content_type=content_type,
            size_bytes=len(data),
            data_base64=encoded
        )
        return att

    @staticmethod
    async def get_attachment_data(tenant_id: str, attachment_id: str) -> Optional[Tuple[str, str, bytes]]:
        repo = AttachmentRepo(tenant_id)
        att = await repo.get_by_id(attachment_id)
        if not att or not att.data_base64:
            return None
        raw_bytes = base64.b64decode(att.data_base64)
        return att.filename, att.content_type, raw_bytes
