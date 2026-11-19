"""Cloudinary file upload service with safe fallback."""
import uuid
from typing import Optional, Dict, Any
import cloudinary
import cloudinary.uploader
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("cloudinary_service")


class CloudinaryService:
    @staticmethod
    def is_configured() -> bool:
        settings = get_settings()
        if settings.cloudinary_url:
            return True
        return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)

    @staticmethod
    def init():
        settings = get_settings()
        if settings.cloudinary_url:
            cloudinary.config(cloudinary_url=settings.cloudinary_url)
        elif settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret:
            cloudinary.config(
                cloud_name=settings.cloudinary_cloud_name,
                api_key=settings.cloudinary_api_key,
                api_secret=settings.cloudinary_api_secret,
                secure=True
            )

    @classmethod
    def upload_resume(cls, file_bytes: bytes, filename: str, tenant_id: str, role: str) -> Optional[Dict[str, Any]]:
        """Upload resume to Cloudinary if configured. Returns dict with url and public_id, or None."""
        if not cls.is_configured():
            return None

        try:
            cls.init()
            safe_filename = "".join(c for c in filename if c.isalnum() or c in ("-", "_", ".")).rsplit(".", 1)[0]
            clean_role = "".join(c for c in role if c.isalnum() or c in ("-", "_"))
            public_id = f"resume_{clean_role}_{safe_filename}_{uuid.uuid4().hex[:6]}"

            result = cloudinary.uploader.upload(
                file_bytes,
                resource_type="auto",
                folder=f"jobmail/{tenant_id}/resumes",
                public_id=public_id,
                use_filename=True,
                unique_filename=True
            )
            return {
                "url": result.get("secure_url") or result.get("url"),
                "public_id": result.get("public_id"),
                "bytes": result.get("bytes", len(file_bytes)),
                "format": result.get("format", filename.split(".")[-1] if "." in filename else "pdf")
            }
        except Exception as e:
            log.error("cloudinary_upload_failed", error=str(e), filename=filename)
            return None

    @classmethod
    def delete_file(cls, public_id: str) -> bool:
        if not cls.is_configured() or not public_id:
            return False
        try:
            cls.init()
            cloudinary.uploader.destroy(public_id)
            return True
        except Exception as e:
            log.warning("cloudinary_delete_failed", public_id=public_id, error=str(e))
            return False
