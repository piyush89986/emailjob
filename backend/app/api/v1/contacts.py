"""Contacts management API router."""
from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import get_contact_repo
from app.core.errors import NotFoundError
from app.repositories.domain import ContactRepo
from app.schemas.domain import (
    ContactCreateRequest,
    ContactResponse,
    ContactStatusUpdate,
)

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=List[ContactResponse])
async def list_contacts(repo: ContactRepo = Depends(get_contact_repo)):
    """List all contacts for current tenant."""
    contacts = await repo.find_all(sort=[("created_at", -1)])
    return [
        ContactResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            company=c.company,
            status=c.status,  # type: ignore
            last_replied_at=c.last_replied_at.isoformat() if c.last_replied_at else None,
            created_at=c.created_at.isoformat()
        )
        for c in contacts
    ]


@router.post("", response_model=ContactResponse)
async def create_contact(
    body: ContactCreateRequest,
    repo: ContactRepo = Depends(get_contact_repo)
):
    """Create a new contact."""
    contact = await repo.create(
        name=body.name,
        email=body.email.lower().strip(),
        company=body.company,
        status=body.status
    )
    return ContactResponse(
        id=contact.id,
        name=contact.name,
        email=contact.email,
        company=contact.company,
        status=contact.status,  # type: ignore
        last_replied_at=None,
        created_at=contact.created_at.isoformat()
    )


@router.patch("/{contact_id}/status", response_model=ContactResponse)
async def update_contact_status(
    contact_id: str,
    body: ContactStatusUpdate,
    repo: ContactRepo = Depends(get_contact_repo)
):
    """Update contact pipeline stage status."""
    contact = await repo.update(contact_id, status=body.status)
    if not contact:
        raise NotFoundError("Contact not found")
    return ContactResponse(
        id=contact.id,
        name=contact.name,
        email=contact.email,
        company=contact.company,
        status=contact.status,  # type: ignore
        last_replied_at=contact.last_replied_at.isoformat() if contact.last_replied_at else None,
        created_at=contact.created_at.isoformat()
    )


@router.get("/replied", response_model=List[ContactResponse])
async def list_replied_contacts(repo: ContactRepo = Depends(get_contact_repo)):
    """List contacts who replied, sorted by last_replied_at descending."""
    contacts = await repo.get_replied_sorted()
    return [
        ContactResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            company=c.company,
            status=c.status,  # type: ignore
            last_replied_at=c.last_replied_at.isoformat() if c.last_replied_at else None,
            created_at=c.created_at.isoformat()
        )
        for c in contacts
    ]


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    repo: ContactRepo = Depends(get_contact_repo)
):
    """Delete contact."""
    deleted = await repo.delete(contact_id)
    if not deleted:
        raise NotFoundError("Contact not found")
    return {"status": "ok", "deleted": True}
