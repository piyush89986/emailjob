"""OpenAI client provider implementation with structured output."""
import json
from typing import Type, TypeVar
import httpx
from pydantic import BaseModel
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.services.ai.base import LLMClient

log = get_logger("openai_client")
settings = get_settings()
T = TypeVar("T", bound=BaseModel)


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str = ""):
        self.api_key = api_key or settings.openai_api_key

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: str = "",
        max_tokens: int = 1500,
        temperature: float = 0.2
    ) -> T:
        if not self.api_key:
            raise AppError("OpenAI API key not configured", status_code=503)

        schema_json = json.dumps(response_schema.model_json_schema())
        system_msg = f"{system_instruction}\nYou must respond strictly with valid JSON conforming to this schema:\n{schema_json}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            if resp.status_code != 200:
                log.error("openai_api_error", status=resp.status_code, body=resp.text)
                raise AppError(f"OpenAI error: {resp.text}", status_code=502)

            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"]
            parsed_json = json.loads(raw_text)
            return response_schema.model_validate(parsed_json)
