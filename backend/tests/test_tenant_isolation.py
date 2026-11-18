"""Comprehensive test proving strict multi-tenant isolation across all repositories and routes."""
import pytest
from app.repositories.domain import (
    AccountRepo,
    ApplicationRepo,
    ContactRepo,
    MessageRepo,
    TemplateRepo,
    ThreadRepo,
)


@pytest.mark.asyncio
async def test_repository_tenant_isolation(tenant_a, tenant_b):
    """Prove tenant A repository cannot read, update, or delete tenant B records."""
    repo_a = ContactRepo("tenant_a")
    repo_b = ContactRepo("tenant_b")

    # 1. Tenant B creates a contact
    contact_b = await repo_b.create(
        name="Private Recruiter",
        email="recruiter@secretcorp.com",
        company="SecretCorp",
        status="Contacted"
    )

    # 2. Tenant A attempts to read Tenant B's contact by ID -> Must return None
    fetched_by_a = await repo_a.get_by_id(contact_b.id)
    assert fetched_by_a is None, "Security Violation: Tenant A was able to read Tenant B's contact!"

    # 3. Tenant A attempts to find in list -> Must not contain Tenant B's contact
    contacts_a = await repo_a.find_all()
    assert not any(c.id == contact_b.id for c in contacts_a)

    # 4. Tenant A attempts to update Tenant B's contact -> Must return None and remain untouched
    update_result = await repo_a.update(contact_b.id, name="Hacked Name")
    assert update_result is None
    contact_b_fresh = await repo_b.get_by_id(contact_b.id)
    assert contact_b_fresh.name == "Private Recruiter", "Security Violation: Tenant A modified Tenant B's contact!"

    # 5. Tenant A attempts to delete Tenant B's contact -> Must return False and not delete
    delete_result = await repo_a.delete(contact_b.id)
    assert delete_result is False
    contact_b_still_exists = await repo_b.get_by_id(contact_b.id)
    assert contact_b_still_exists is not None, "Security Violation: Tenant A deleted Tenant B's contact!"


@pytest.mark.asyncio
async def test_threads_and_messages_tenant_isolation(tenant_a, tenant_b):
    """Prove thread and message repositories strictly isolate data between tenants."""
    t_repo_a = ThreadRepo("tenant_a")
    t_repo_b = ThreadRepo("tenant_b")
    m_repo_a = MessageRepo("tenant_a")
    m_repo_b = MessageRepo("tenant_b")

    thread_b = await t_repo_b.create(subject="Confidential Interview", contact_id="c_b1")
    msg_b = await m_repo_b.create(
        thread_id=thread_b.id,
        dir="in",
        from_addr="recruiter@beta.com",
        subject="Offer Letter",
        body="Secret salary: $250k"
    )

    # Tenant A cannot read Thread B
    assert await t_repo_a.get_by_id(thread_b.id) is None
    # Tenant A cannot read Message B
    assert await m_repo_a.get_by_id(msg_b.id) is None
    # Tenant A searching messages gets nothing from Tenant B
    assert len(await m_repo_a.find_by_thread_id(thread_b.id)) == 0


@pytest.mark.asyncio
async def test_api_tenant_isolation(async_client, tenant_a, tenant_b, auth_headers_a, auth_headers_b):
    """Prove API endpoints reject cross-tenant data access."""
    # Tenant B creates a contact via API
    resp_b = await async_client.post(
        "/contacts",
        json={"name": "Bob B", "email": "bob@beta.org", "company": "BetaOrg", "status": "Contacted"},
        headers=auth_headers_b
    )
    assert resp_b.status_code == 200
    contact_id = resp_b.json()["id"]

    # Tenant A lists contacts -> must not include Tenant B's contact
    resp_a_list = await async_client.get("/contacts", headers=auth_headers_a)
    assert resp_a_list.status_code == 200
    ids_seen_by_a = [c["id"] for c in resp_a_list.json()]
    assert contact_id not in ids_seen_by_a

    # Tenant A tries to patch Tenant B's contact status -> must return 404
    resp_a_patch = await async_client.patch(
        f"/contacts/{contact_id}/status",
        json={"status": "Interview"},
        headers=auth_headers_a
    )
    assert resp_a_patch.status_code == 404

    # Tenant A tries to delete Tenant B's contact -> must return 404
    resp_a_del = await async_client.delete(f"/contacts/{contact_id}", headers=auth_headers_a)
    assert resp_a_del.status_code == 404
