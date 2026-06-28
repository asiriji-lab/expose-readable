import logging

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from agent03_legal_reasoning.prompts import (
    FORCED_VERDICT_INSTRUCTION,
    REASONER_PROMPT,
)

logger = logging.getLogger(__name__)


def apply_hard_rules(
    cv_verdict: str | None,
    cv_confidence: float,
    contract_liable: bool,
    movein_report_signed: bool,
) -> str | None:
    """
    Apply deterministic rules before calling Typhoon v2.

    Hard rules take precedence over LLM reasoning. Returns a forced verdict
    string when a rule fires, or None to let the LLM reason freely.

    cv_verdict is None when damage_map is empty (Agent 01 not run), in which
    case this function always returns None.

    Args:
        cv_verdict: CV verdict label from Agent 01, or None.
        cv_confidence: Confidence score from Agent 01 [0.0, 1.0].
        contract_liable: Whether Agent 02 found tenant liable in contract.
        movein_report_signed: Whether a signed move-in inspection report exists.

    Returns:
        Forced verdict string or None.
    """
    if cv_verdict == "PRE_EXISTING":
        return "UNLAWFUL"
    if cv_verdict == "UNCHANGED":
        return "UNLAWFUL"
    if cv_verdict == "NORMAL_WEAR":
        # OCPB 2568 explicitly voids any wear-and-tear liability clause
        return "UNLAWFUL"
    if cv_verdict == "NEW_DAMAGE" and not movein_report_signed:
        # Damage is new but baseline condition cannot be proved
        return "DISPUTED"
    if cv_verdict is not None and cv_confidence < 0.60:
        # Insufficient visual confidence — do not let hard rule determine outcome
        return "DISPUTED"
    if cv_verdict == "unverifiable_by_cv":
        # No visual data available — LLM reasons from contract and law alone
        return None
    return None


def build_reasoner_chain(llm: ChatOpenAI):
    """
    Assemble the LangChain chain for per-claim legal reasoning.

    Chain: REASONER_PROMPT | llm | JsonOutputParser

    Args:
        llm: A ChatOpenAI instance (Typhoon v2).

    Returns:
        A runnable LangChain chain.
    """
    return REASONER_PROMPT | llm | JsonOutputParser()


def reason_claim(
    item: str,
    description: str,
    amount_thb: float,
    cv_verdict: str | None,
    cv_confidence: float,
    contract_liable: bool,
    movein_report_signed: bool,
    formatted_chunks: str,
    forced_verdict: str | None,
    llm: ChatOpenAI,
) -> dict:
    """
    Produce a legal verdict for a single landlord claim.

    If forced_verdict is set, Typhoon only writes reasoning and citations —
    the verdict value is locked. Otherwise Typhoon determines the verdict too.

    Args:
        item: Name of the claimed damage item.
        description: Landlord's description of damage.
        amount_thb: Amount claimed in Thai Baht.
        cv_verdict: CV verdict from Agent 01 (or None).
        cv_confidence: CV confidence score.
        contract_liable: Whether tenant is liable per contract (from Agent 02).
        movein_report_signed: Whether signed move-in report exists.
        formatted_chunks: Formatted law chunks from retriever.
        forced_verdict: Pre-determined verdict or None for LLM to decide.
        llm: A ChatOpenAI instance (Typhoon v2).

    Returns:
        Dict matching the ClaimVerdict schema (without claim_id/item/amount_thb —
        those are added by the caller).
    """
    if forced_verdict:
        forced_instruction = FORCED_VERDICT_INSTRUCTION.format(verdict=forced_verdict)
    else:
        forced_instruction = ""

    chain = build_reasoner_chain(llm)
    result = chain.invoke({
        "item": item,
        "description": description,
        "amount_thb": amount_thb,
        "cv_verdict": cv_verdict or "ไม่มีข้อมูลภาพ (Agent 01 not run)",
        "cv_confidence": f"{cv_confidence:.0%}",
        "contract_liable": "ใช่" if contract_liable else "ไม่ใช่",
        "movein_report_signed": "ใช่" if movein_report_signed else "ไม่ใช่",
        "forced_verdict_instruction": forced_instruction,
        "retrieved_chunks": formatted_chunks,
    })

    # If forced_verdict is set, override whatever verdict the LLM wrote
    if forced_verdict:
        result["verdict"] = forced_verdict

    return result
