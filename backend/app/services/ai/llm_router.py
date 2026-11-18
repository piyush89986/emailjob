"""LLM Router managing provider fallback, retries, cost tracking, and monthly quotas."""
import asyncio
from datetime import datetime, timezone
from typing import Any, Type, TypeVar
from pydantic import BaseModel
from app.core.config import get_settings
from app.core.errors import AppError, QuotaExceededError
from app.core.logging import get_logger
from app.repositories.domain import SettingsRepo
from app.services.ai.base import LLMClient
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.openai_client import OpenAIClient

log = get_logger("llm_router")
settings = get_settings()
T = TypeVar("T", bound=BaseModel)


class LLMRouter:
    @staticmethod
    async def generate_with_fallback(
        tenant_id: str,
        prompt: str,
        response_schema: Type[T],
        system_instruction: str = "",
        max_tokens: int = 1500,
        temperature: float = 0.2
    ) -> T:
        """Call primary LLM provider with retry and fallback to secondary, checking monthly quota."""
        settings_repo = SettingsRepo(tenant_id)
        prefs = await settings_repo.get_or_create()

        # Check monthly quota
        now = datetime.now(timezone.utc)
        reset_at = prefs.ai_usage_reset_at
        if reset_at.tzinfo is None:
            reset_at = reset_at.replace(tzinfo=timezone.utc)
        # Reset monthly quota if 30 days passed
        if (now - reset_at).days >= 30:
            prefs.current_month_ai_usage = 0.0
            prefs.ai_usage_reset_at = now
            await prefs.save()

        if prefs.current_month_ai_usage >= prefs.monthly_ai_limit:
            log.warning("monthly_ai_limit_exceeded", tenant_id=tenant_id, usage=prefs.current_month_ai_usage)
            raise QuotaExceededError(f"Monthly AI usage limit of ${prefs.monthly_ai_limit:.2f} exceeded.")

        primary_name = prefs.provider or "openai"
        secondary_name = "gemini" if primary_name == "openai" else "openai"

        primary_client = OpenAIClient() if primary_name == "openai" else GeminiClient()
        secondary_client = GeminiClient() if primary_name == "openai" else OpenAIClient()

        # Attempt primary provider with 1 retry
        last_error = None
        for attempt in range(2):
            try:
                res = await primary_client.generate_structured(
                    prompt=prompt,
                    response_schema=response_schema,
                    system_instruction=system_instruction,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                await LLMRouter._record_cost(prefs, estimated_cost=0.002)
                return res
            except Exception as e:
                last_error = e
                log.warning("llm_primary_attempt_failed", provider=primary_name, attempt=attempt, error=str(e))
                await asyncio.sleep(0.5 * (attempt + 1))

        # Primary failed. Fallback to secondary if enabled
        if prefs.fallback:
            log.info("falling_back_to_secondary_llm", secondary=secondary_name)
            try:
                res = await secondary_client.generate_structured(
                    prompt=prompt,
                    response_schema=response_schema,
                    system_instruction=system_instruction,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                await LLMRouter._record_cost(prefs, estimated_cost=0.002)
                return res
            except Exception as e:
                log.error("llm_fallback_failed", secondary=secondary_name, error=str(e))
                raise AppError(f"Both LLM providers failed. Primary: {last_error}, Fallback: {e}", status_code=502)

        raise AppError(f"LLM generation failed: {last_error}", status_code=502)

    @staticmethod
    async def _record_cost(prefs: Any, estimated_cost: float = 0.002) -> None:
        try:
            prefs.current_month_ai_usage += estimated_cost
            prefs.updated_at = datetime.now(timezone.utc)
            await prefs.save()
        except Exception as e:
            log.warning("failed_recording_ai_cost", error=str(e))
