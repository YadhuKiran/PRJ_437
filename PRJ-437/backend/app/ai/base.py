"""AI provider abstraction. AI_PROVIDER=mock (offline) or llm (LLM API)."""
from abc import ABC, abstractmethod
from .validator import validate_ai_output


class BaseAIProvider(ABC):
    @abstractmethod
    def analyze(self, text: str):
        raise NotImplementedError


def get_provider() -> BaseAIProvider:
    from .config import AI_PROVIDER

    if AI_PROVIDER == "llm":
        from .llm_provider import LLMProvider

        return LLMProvider()
    from .mock_provider import MockProvider

    return MockProvider()
