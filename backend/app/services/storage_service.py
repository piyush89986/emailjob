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
    async def get_attachment_data(tenant_id: str, attachment_id: str, user_id: Optional[str] = None) -> Optional[Tuple[str, str, bytes]]:
        if not attachment_id:
            return None

        # 1. Check in Attachment collection (by tenant-scoped repo or global id)
        repo = AttachmentRepo(tenant_id)
        att = await repo.get_by_id(attachment_id)
        if not att:
            att = await Attachment.find_one(Attachment.id == attachment_id)
        if att and att.data_base64:
            try:
                raw_bytes = base64.b64decode(att.data_base64)
                if len(raw_bytes) > 0:
                    return att.filename, att.content_type, raw_bytes
            except Exception:
                pass

        # 2. Check in RoleResume collection (by id or attachment_id)
        from app.models.role_resume import RoleResume
        resume = await RoleResume.find_one(RoleResume.id == attachment_id)
        if not resume:
            resume = await RoleResume.find_one(RoleResume.attachment_id == attachment_id)
        if not resume and user_id:
            resume = (
                await RoleResume.find_one(RoleResume.user_id == user_id, RoleResume.is_default == True)
                or await RoleResume.find_one(RoleResume.user_id == user_id)
            )
        if not resume and tenant_id:
            # Fallback within tenant: check default or any uploaded role resume
            resume = (
                await RoleResume.find_one(RoleResume.tenant_id == tenant_id, RoleResume.is_default == True)
                or await RoleResume.find_one(RoleResume.tenant_id == tenant_id)
            )

        if resume:
            # A) Direct base64 data on RoleResume model (fastest & most reliable)
            if resume.data_base64:
                try:
                    raw_bytes = base64.b64decode(resume.data_base64)
                    if len(raw_bytes) > 0:
                        return resume.filename, resume.content_type or "application/pdf", raw_bytes
                except Exception:
                    pass

            # B) Linked Attachment in MongoDB
            if resume.attachment_id:
                sub_att = await repo.get_by_id(resume.attachment_id) or await Attachment.find_one(Attachment.id == resume.attachment_id)
                if sub_att and sub_att.data_base64:
                    try:
                        raw_bytes = base64.b64decode(sub_att.data_base64)
                        if len(raw_bytes) > 0:
                            # Cache on resume for instant future retrieval
                            resume.data_base64 = sub_att.data_base64
                            await resume.save()
                            return resume.filename, resume.content_type or "application/pdf", raw_bytes
                    except Exception:
                        pass

            # C) Fetch remote bytes from Cloudinary/URL (MUST use follow_redirects=True for CDN edge nodes)
            if resume.url and resume.url.startswith("http"):
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                        resp = await client.get(resume.url)
                        if resp.status_code == 200 and len(resp.content) > 0:
                            raw_data = resp.content
                            resume.data_base64 = base64.b64encode(raw_data).decode("utf-8")
                            await resume.save()
                            return resume.filename, resume.content_type or "application/pdf", raw_data
                except Exception as e:
                    pass

        # 3. Dynamic Profile fallback: If no PDF attachment could be found anywhere,
        # generate a clean candidate resume PDF on the fly from their Profile!
        try:
            from app.models.profile import Profile
            from app.models.resume import ResumeVersion
            from app.services.ai.resume_export_service import ResumeExportService

            profile = await Profile.find_one(Profile.tenant_id == tenant_id)
            if profile and (profile.name or profile.skills or profile.experience):
                cand_name = (profile.name or "Candidate").strip()
                dummy_v = ResumeVersion(
                    tenant_id=tenant_id,
                    label="Auto Generated",
                    text=f"{cand_name}\n{profile.headline}\nSkills: {', '.join(profile.skills)}"
                )
                pdf_bytes = ResumeExportService.export_pdf(profile, dummy_v)
                if pdf_bytes and len(pdf_bytes) > 0:
                    safe_cand = cand_name.replace(" ", "_")
                    filename = f"{safe_cand}_Resume.pdf"
                    return filename, "application/pdf", pdf_bytes
        except Exception:
            pass

        return None
