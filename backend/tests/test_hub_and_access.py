"""Tests for Community Hub, Feedback Suggestions, and Platform Access Requests."""
import pytest
from app.models.access_request import AccessRequest
from app.models.feedback import Feedback
from app.models.hub import HubPost, HubChatMessage


@pytest.mark.asyncio
async def test_access_request_flow(async_client):
    """Test platform access request public submission, duplicate handling, and admin approval."""
    # 1. Public submission from login page
    req_resp = await async_client.post("/access/request", json={"email": "newbie@candidate.io"})
    assert req_resp.status_code == 200
    req_data = req_resp.json()
    assert req_data["success"] is True
    request_id = req_data["request_id"]

    # 2. Duplicate submission shows friendly already submitted message
    dup_resp = await async_client.post("/access/request", json={"email": "newbie@candidate.io"})
    assert dup_resp.status_code == 200
    assert "already submitted" in dup_resp.json()["message"]

    # 3. Create admin user
    signup_resp = await async_client.post(
        "/auth/signup",
        json={"name": "Admin Boss", "email": "admin@bjob.io", "password": "adminpassword123"}
    )
    assert signup_resp.status_code == 200
    token = signup_resp.json().get("accessToken") or signup_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 4. List pending requests for admin sticky banner
    pending_resp = await async_client.get("/access/pending", headers=headers)
    assert pending_resp.status_code == 200
    items = pending_resp.json()
    assert any(i["email"] == "newbie@candidate.io" for i in items)

    # 5. Approve access request
    approve_resp = await async_client.post(f"/access/{request_id}/approve", headers=headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "approved"

    # 6. Verify it is no longer pending
    pending_after = await async_client.get("/access/pending", headers=headers)
    assert not any(i["id"] == request_id for i in pending_after.json())


@pytest.mark.asyncio
async def test_hub_posts_and_interactions(async_client):
    """Test Hub post creation, like toggle, comment addition, and 1-click apply prep."""
    # User signup
    signup_resp = await async_client.post(
        "/auth/signup",
        json={"name": "Piyush S", "email": "piyush.hub@test.io", "password": "securepassword123"}
    )
    token = signup_resp.json().get("accessToken") or signup_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a Hub job post
    post_resp = await async_client.post(
        "/hub/posts",
        headers=headers,
        json={
            "title": "Senior Frontend Developer",
            "company": "TechNova",
            "hr_email": "careers@technova.io",
            "location": "Remote",
            "skills": ["React", "TypeScript", "Tailwind CSS"],
            "jd": "We are seeking a senior frontend developer to lead our UI team."
        }
    )
    assert post_resp.status_code == 200
    post_data = post_resp.json()
    post_id = post_data["id"]
    assert post_data["title"] == "Senior Frontend Developer"
    assert post_data["company"] == "TechNova"

    # 2. Like post
    like_resp1 = await async_client.post(f"/hub/posts/{post_id}/like", headers=headers)
    assert like_resp1.status_code == 200
    assert like_resp1.json()["liked"] is True
    assert like_resp1.json()["like_count"] == 1

    # Unlike
    like_resp2 = await async_client.post(f"/hub/posts/{post_id}/like", headers=headers)
    assert like_resp2.status_code == 200
    assert like_resp2.json()["liked"] is False
    assert like_resp2.json()["like_count"] == 0

    # 3. Add comment
    comment_resp = await async_client.post(
        f"/hub/posts/{post_id}/comments",
        headers=headers,
        json={"text": "Is this opening open for international candidates?"}
    )
    assert comment_resp.status_code == 200
    assert comment_resp.json()["text"] == "Is this opening open for international candidates?"

    # 4. Prepare 1-click application
    prep_resp = await async_client.post(f"/hub/posts/{post_id}/apply-prep", headers=headers)
    assert prep_resp.status_code == 200
    prep_data = prep_resp.json()
    assert prep_data["title"] == "Senior Frontend Developer"
    assert prep_data["hr_email"] == "careers@technova.io"
    assert "email_draft" in prep_data


@pytest.mark.asyncio
async def test_hub_chat_and_feedback(async_client):
    """Test real-time community chat messages and product feedback suggestions."""
    signup_resp = await async_client.post(
        "/auth/signup",
        json={"name": "Dev Member", "email": "dev.member@test.io", "password": "securepassword123"}
    )
    token = signup_resp.json().get("accessToken") or signup_resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Send chat message
    chat_resp = await async_client.post(
        "/hub/chat",
        headers=headers,
        json={"text": "Hey everyone! Anyone interviewed at Stripe recently?"}
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert "interviewed at Stripe" in chat_data["text"]

    # List chat
    list_chat = await async_client.get("/hub/chat", headers=headers)
    assert list_chat.status_code == 200
    assert any(m["id"] == chat_data["id"] for m in list_chat.json())

    # 2. Submit product improvement suggestion
    feedback_resp = await async_client.post(
        "/feedback",
        headers=headers,
        json={
            "category": "UI/UX",
            "title": "Add keyboard shortcuts for Quick Apply",
            "description": "Pressing Cmd+Enter in Hub should open the 1-click apply confirmation modal.",
            "impact": "High Impact"
        }
    )
    assert feedback_resp.status_code == 200
    fb_data = feedback_resp.json()
    fb_id = fb_data["id"]
    assert fb_data["title"] == "Add keyboard shortcuts for Quick Apply"

    # 3. Vote on feedback (toggles vote)
    vote_resp1 = await async_client.post(f"/feedback/{fb_id}/vote", headers=headers)
    assert vote_resp1.status_code == 200
    assert vote_resp1.json()["voted"] is False
    assert vote_resp1.json()["vote_count"] == 0

    vote_resp2 = await async_client.post(f"/feedback/{fb_id}/vote", headers=headers)
    assert vote_resp2.status_code == 200
    assert vote_resp2.json()["voted"] is True
    assert vote_resp2.json()["vote_count"] == 1
