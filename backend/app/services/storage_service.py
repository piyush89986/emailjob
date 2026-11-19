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
        if not attachment_id:
            return None
        repo = AttachmentRepo(tenant_id)
        att = await repo.get_by_id(attachment_id)
        if att and att.data_base64:
            raw_bytes = base64.b64decode(att.data_base64)
            return att.filename, att.content_type, raw_bytes

        # Fallback: check if attachment_id is a RoleResume id or points to a RoleResume
        from app.models.role_resume import RoleResume
        resume = await RoleResume.find_one(RoleResume.id == attachment_id, RoleResume.tenant_id == tenant_id)
        if not resume:
            resume = await RoleResume.find_one(RoleResume.attachment_id == attachment_id, RoleResume.tenant_id == tenant_id)

        if resume:
            # Check if resume already links to a valid Attachment
            if resume.attachment_id and resume.attachment_id != attachment_id:
                sub_att = await repo.get_by_id(resume.attachment_id)
                if sub_att and sub_att.data_base64:
                    return sub_att.filename, sub_att.content_type, base64.b64decode(sub_att.data_base64)

            # If resume has a URL, fetch remote bytes and cache in AttachmentRepo
            if resume.url:
                try:
                    raw_data = None
                    if resume.url.startswith("http"):
                        import httpx
                        async with httpx.AsyncClient(timeout=15.0) as client:
                            resp = await client.get(resume.url)
                            if resp.status_code == 200:
                                raw_data = resp.content
                    elif "/role-resumes/" in resume.url:
                        parts = resume.url.split("/")
                        if len(parts) >= 3:
                            sub_id = parts[2]
                            sub_att = await repo.get_by_id(sub_id)
                            if sub_att and sub_att.data_base64:
                                return sub_att.filename, sub_att.content_type, base64.b64decode(sub_att.data_base64)

                    if raw_data:
                        new_att = await repo.create(
                            filename=resume.filename,
                            content_type=resume.content_type or "application/pdf",
                            size_bytes=len(raw_data),
                            data_base64=base64.b64encode(raw_data).decode("utf-8")
                        )
                        resume.attachment_id = new_att.id
                        await resume.save()
                        return resume.filename, resume.content_type or "application/pdf", raw_data
                except Exception:
                    pass

        return None
