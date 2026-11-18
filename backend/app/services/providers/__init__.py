"""Email providers factory."""
import json
from app.core.security import decrypt_secret
from app.models.account import EmailAccount
from app.services.providers.base import EmailProvider
from app.services.providers.gmail_provider import GmailProvider
from app.services.providers.graph_provider import GraphProvider
from app.services.providers.imap_smtp_provider import ImapSmtpProvider


def get_email_provider(account: EmailAccount) -> EmailProvider:
    """Instantiate appropriate provider from EmailAccount decrypted credentials."""
    raw_creds = decrypt_secret(account.encrypted_creds)
    try:
        creds = json.loads(raw_creds)
    except Exception:
        creds = {}

    if account.provider == "gmail":
        return GmailProvider(creds)
    elif account.provider == "outlook":
        return GraphProvider(creds)
    elif account.provider == "imap":
        return ImapSmtpProvider(creds)
    else:
        raise ValueError(f"Unknown email provider: {account.provider}")


__all__ = [
    "EmailProvider",
    "GmailProvider",
    "GraphProvider",
    "ImapSmtpProvider",
    "get_email_provider",
]
