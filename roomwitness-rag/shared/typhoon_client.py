from langchain_openai import ChatOpenAI
from shared.config import TYPHOON_API_KEY, TYPHOON_BASE_URL, TYPHOON_MODEL


def get_typhoon_llm(temperature: float = 0.1) -> ChatOpenAI:
    """
    Returns a LangChain-compatible ChatOpenAI instance pointed at Typhoon v2.

    Typhoon v2 exposes an OpenAI-compatible REST API — we only swap base_url and api_key.

    Args:
        temperature: Sampling temperature.
            0.1  — Agent 02 and 03 (reasoning tasks, some variation allowed)
            0.05 — Agent 04 (document generation, must be deterministic)

    TODO: Verify TYPHOON_BASE_URL with SCB10X docs after registering at
          https://typhoon.apps.opentyphoon.ai
    """
    return ChatOpenAI(
        api_key=TYPHOON_API_KEY,
        base_url=TYPHOON_BASE_URL,
        model=TYPHOON_MODEL,
        temperature=temperature,
    )
