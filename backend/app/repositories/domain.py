"""Domain repositories providing tenant-isolated database access."""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from pymongo import ASCENDING, DESCENDING
from app.models.tenant import Tenant
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.account import EmailAccount
from app.models.contact import Contact
from app.models.thread import Thread
from app.models.message import Message
from app.models.template import Template
from app.models.application import Application
from app.models.profile import Profile
from app.models.settings import TenantSettings
from app.models.resume import ResumeVersion
from app.models.role_resume import RoleResume
from app.models.attachment import Attachment
from app.models.audit_log import AuditLog
from app.repositories.base import TenantRepository


class TenantRepo:
    """Non-tenant repository strictly for tenant lifecycle."""

    @staticmethod
    async def get_by_id(tenant_id: str) -> Optional[Tenant]:
        return await Tenant.get(tenant_id)

    @staticmethod
    async def create(name: str, plan: str = "starter") -> Tenant:
        tenant = Tenant(name=name, plan=plan)
        await tenant.insert()
        return tenant

    @staticmethod
    async def delete(tenant_id: str) -> bool:
        tenant = await Tenant.get(tenant_id)
        if tenant:
            await tenant.delete()
            return True
        return False


class UserRepo(TenantRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> Optional[User]:
        clean = email.lower().strip()
        try:
            return await self.find_one(User.email == clean)
        except AttributeError:
            return await self.find_one({"email": clean})

    @staticmethod
    async def find_by_email_global(email: str) -> Optional[User]:
        """Global lookup used during authentication before tenant context is known."""
        clean = email.lower().strip()
        try:
            return await User.find_one(User.email == clean)
        except AttributeError:
            return await User.find_one({"email": clean})


class RefreshTokenRepo(TenantRepository[RefreshToken]):
    model = RefreshToken

    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        try:
            return await self.find_one(RefreshToken.token_hash == token_hash)
        except AttributeError:
            return await self.find_one({"token_hash": token_hash})

    @staticmethod
    async def get_by_hash_global(token_hash: str) -> Optional[RefreshToken]:
        """Lookup during token refresh."""
        try:
            return await RefreshToken.find_one(RefreshToken.token_hash == token_hash)
        except AttributeError:
            return await RefreshToken.find_one({"token_hash": token_hash})

    async def revoke_user_tokens(self, user_id: str) -> None:
        await RefreshToken.find(
            RefreshToken.tenant_id == self.tenant_id,
            RefreshToken.user_id == user_id
        ).update({"$set": {"revoked": True}})


class AccountRepo(TenantRepository[EmailAccount]):
    model = EmailAccount

    async def get_default(self) -> Optional[EmailAccount]:
        return await self.find_one(EmailAccount.is_default == True, EmailAccount.status == "connected")

    async def find_by_address(self, address: str) -> Optional[EmailAccount]:
        return await self.find_one(EmailAccount.address == address.lower().strip())

    async def set_default(self, account_id: str) -> Optional[EmailAccount]:
        # Unset default on all accounts
        await EmailAccount.find(EmailAccount.tenant_id == self.tenant_id).update({"$set": {"is_default": False}})
        # Set default on targeted account
        return await self.update(account_id, is_default=True)


class ContactRepo(TenantRepository[Contact]):
    model = Contact

    async def find_by_email(self, email: str) -> Optional[Contact]:
        return await self.find_one(Contact.email == email.lower().strip())

    async def get_or_create(self, email: str, name: str = "", company: str = "") -> Contact:
        clean_email = email.lower().strip()
        contact = await self.find_by_email(clean_email)
        if not contact:
            if not name:
                name = clean_email.split("@")[0]
            if not company and "@" in clean_email:
                company = clean_email.split("@")[1].split(".")[0].capitalize()
            contact = await self.create(
                name=name,
                email=clean_email,
                company=company,
                status="Contacted"
            )
        return contact

    async def get_replied_sorted(self, limit: int = 20) -> List[Contact]:
        return await self.find_all(
            Contact.last_replied_at != None,
            sort=[("last_replied_at", DESCENDING)],
            limit=limit
        )


class ThreadRepo(TenantRepository[Thread]):
    model = Thread

    async def find_by_provider_thread_id(self, p_tid: str) -> Optional[Thread]:
        return await self.find_one(Thread.provider_thread_id == p_tid)

    async def find_by_contact_id(self, contact_id: str) -> List[Thread]:
        return await self.find_all(Thread.contact_id == contact_id, sort=[("updated_at", DESCENDING)])

    async def search_threads(self, query: str) -> List[Thread]:
        """Search threads by subject matching query."""
        if not query:
            return await self.find_all(sort=[("updated_at", DESCENDING)])
        # Case-insensitive regex match on subject
        return await self.find_all(
            {"subject": {"$regex": query, "$options": "i"}},
            sort=[("updated_at", DESCENDING)]
        )


class MessageRepo(TenantRepository[Message]):
    model = Message

    async def find_by_thread_id(self, thread_id: str) -> List[Message]:
        return await self.find_all(Message.thread_id == thread_id, sort=[("at", ASCENDING)])

    async def find_by_provider_message_id(self, email_account_id: str, p_mid: str) -> Optional[Message]:
        return await Message.find_one(
            Message.email_account_id == email_account_id,
            Message.provider_message_id == p_mid
        )

    async def find_by_rfc_message_id(self, rfc_id: str) -> Optional[Message]:
        return await self.find_one(Message.rfc_message_id == rfc_id)

    async def find_by_in_reply_to_or_references(self, refs: List[str]) -> Optional[Message]:
        for ref in refs:
            if not ref:
                continue
            m = await self.find_one(Message.rfc_message_id == ref)
            if m:
                return m
        return None

    async def count_sent_today(self) -> int:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        return await self.count(
            Message.dir == "out",
            Message.at >= since
        )

    async def count_sent_this_week(self) -> int:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        return await self.count(
            Message.dir == "out",
            Message.at >= since
        )


class TemplateRepo(TenantRepository[Template]):
    model = Template

    async def list_for_tenant_with_globals(self) -> List[Template]:
        # Return both tenant-specific templates and global templates
        tenant_tpls = await self.find_all()
        global_tpls = await Template.find(Template.global_template == True).to_list()
        # Merge without duplicates
        seen = set()
        merged = []
        for t in tenant_tpls + global_tpls:
            if t.id not in seen:
                seen.add(t.id)
                merged.append(t)
        return merged

    async def clone_template(self, template_id: str) -> Optional[Template]:
        source = await Template.get(template_id)
        if not source:
            return None
        clone = await self.create(
            name=f"{source.name} (Copy)",
            subject=source.subject,
            body=source.body,
            global_template=False
        )
        return clone


class ApplicationRepo(TenantRepository[Application]):
    model = Application

    async def find_by_contact_id(self, contact_id: str) -> Optional[Application]:
        return await self.find_one(Application.contact_id == contact_id)

    async def append_timeline(self, app_id: str, label: str) -> Optional[Application]:
        app = await self.get_by_id(app_id)
        if not app:
            return None
        entry = {"at": datetime.now(timezone.utc).isoformat(), "label": label}
        app.timeline.append(entry)
        app.updated_at = datetime.now(timezone.utc)
        await app.save()
        return app


class ProfileRepo(TenantRepository[Profile]):
    model = Profile

    async def get_or_create(self) -> Profile:
        profile = await self.find_one()
        if not profile:
            profile = await self.create()
        return profile


class SettingsRepo(TenantRepository[TenantSettings]):
    model = TenantSettings

    async def get_or_create(self) -> TenantSettings:
        s = await self.find_one()
        if not s:
            s = await self.create()
        return s

    async def add_dnc(self, email_or_domain: str) -> TenantSettings:
        s = await self.get_or_create()
        clean = email_or_domain.lower().strip()
        if clean not in [x.lower() for x in s.dnc]:
            s.dnc.append(clean)
            s.updated_at = datetime.now(timezone.utc)
            await s.save()
        return s

    async def remove_dnc(self, email_or_domain: str) -> TenantSettings:
        s = await self.get_or_create()
        clean = email_or_domain.lower().strip()
        s.dnc = [x for x in s.dnc if x.lower() != clean]
        s.updated_at = datetime.now(timezone.utc)
        await s.save()
        return s


class ResumeRepo(TenantRepository[ResumeVersion]):
    model = ResumeVersion

    async def list_versions(self) -> List[ResumeVersion]:
        return await self.find_all(sort=[("at", DESCENDING)])


class RoleResumeRepo(TenantRepository[RoleResume]):
    model = RoleResume

    async def list_by_tenant(self) -> List[RoleResume]:
        return await self.find_all(sort=[("created_at", DESCENDING)])

    async def find_by_role(self, role: str) -> List[RoleResume]:
        return await self.find_all(RoleResume.role == role, sort=[("created_at", DESCENDING)])

    async def clear_default_for_role(self, role: str):
        resumes = await self.find_by_role(role)
        for r in resumes:
            if r.is_default:
                await self.update(r.id, is_default=False)


class AttachmentRepo(TenantRepository[Attachment]):
    model = Attachment


class AuditRepo(TenantRepository[AuditLog]):
    model = AuditLog

    async def log_action(
        self,
        action: str,
        user_id: Optional[str] = None,
        target_type: str = "",
        target_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        return await self.create(
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
            ip_address=ip_address
        )
