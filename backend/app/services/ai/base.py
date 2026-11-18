"""Abstract base interface for LLM client providers."""
from abc import ABC, abstractmethod
from typing import Any, Dict, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMClient(ABC):
    """Unified LLM client interface for OpenAI and Gemini."""

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: str = "",
        max_tokens: int = 1500,
        temperature: float = 0.2
    ) -> T:
        """Generate structured Pydantic object."""
        pass
