"""Tests for LLM fallback and per-tenant monthly quota enforcement."""
from unittest.mock import AsyncMock, patch
import pytest
from pydantic import BaseModel
from app.core.errors import QuotaExceededError
from app.repositories.domain import SettingsRepo
from app.services.ai.llm_router import LLMRouter


class SampleOutput(BaseModel):
    message: str


@pytest.mark.asyncio
async def test_monthly_ai_quota_limit_429(tenant_a):
    """Test that exceeding monthly AI quota raises 429 QuotaExceededError."""
    settings_repo = SettingsRepo("tenant_a")
    prefs = await settings_repo.get_or_create()
    prefs.monthly_ai_limit = 5.0
    prefs.current_month_ai_usage = 5.50  # Over limit!
    await prefs.save()

    with pytest.raises(QuotaExceededError):
        await LLMRouter.generate_with_fallback(
            tenant_id="tenant_a",
            prompt="Hello",
            response_schema=SampleOutput
        )


@pytest.mark.asyncio
async def test_llm_automatic_fallback(tenant_a):
    """Test automatic fallback from primary provider to secondary on error."""
    settings_repo = SettingsRepo("tenant_a")
    prefs = await settings_repo.get_or_create()
    prefs.provider = "openai"
    prefs.fallback = True
    prefs.monthly_ai_limit = 20.0
    prefs.current_month_ai_usage = 0.0
    await prefs.save()

    # Mock primary to fail, secondary to succeed
    with patch("app.services.ai.llm_router.OpenAIClient.generate_structured", side_effect=Exception("OpenAI API Down")), \
         patch("app.services.ai.llm_router.GeminiClient.generate_structured", return_value=SampleOutput(message="Hello from Gemini!")):

        res = await LLMRouter.generate_with_fallback(
            tenant_id="tenant_a",
            prompt="Test prompt",
            response_schema=SampleOutput
        )
        assert res.message == "Hello from Gemini!"
