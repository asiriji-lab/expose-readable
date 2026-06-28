from typing import Literal
from pydantic import BaseModel, ConfigDict

CVVerdict = Literal["PRE_EXISTING", "UNCHANGED", "NORMAL_WEAR", "NEW_DAMAGE"]


class ClaimPhoto(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    claim_id: str
    item: str
    description: str
    amount_thb: float
    movein_image_url: str    # s3:// or local path
    moveout_image_url: str   # s3:// or local path


class ConversationScreenshot(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    image_url: str           # s3:// or local path


class Agent01Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    claim_photos: list[ClaimPhoto]
    conversation_screenshots: list[ConversationScreenshot] = []
    manual_landlord_promises: str = ""
    manual_tenant_promises: str = ""


class CVResult(BaseModel):
    """Schema consumed by Agent 03 — must match agent03_legal_reasoning/models.py exactly."""
    model_config = ConfigDict(str_strip_whitespace=True)

    claim_id: str
    verdict: CVVerdict | None = None    # None = LLM decides in Agent 03
    confidence: float = 0.0
    move_in_condition: str = ""
    move_out_condition: str = ""
    status: str = "ok"                  # "ok" or "unverifiable_by_cv"


class EvidenceResult(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    screenshots_processed: int
    screenshots_unreadable: int
    platforms_detected: list[str]
    all_landlord_promises: list[str]
    all_tenant_promises: list[str]
    all_deposit_mentions: list[str]
    total_messages_extracted: int
    evidence_text: str                  # plain text injected into Agent 03 context


class Agent01Output(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    damage_map: list[CVResult]          # passed directly to Agent 03 as damage_map
    evidence: EvidenceResult | None     # optional conversation evidence
    model_used: str


def translate_to_cv_result(claim_id: str, raw: dict) -> CVResult:
    """
    Bridge between Groq Llama-4-Scout assessment output and Agent 03's CVResult schema.

    Groq output fields used:
        change_detected: bool
        wear_and_tear: bool
        likely_tenant_caused: bool | None
        supports_landlord_claim: "YES" | "NO" | "PARTIAL"
        confidence: float
        move_in_condition: str
        move_out_condition: str

    Mapping to CVVerdict:
        change_detected=False                                   → UNCHANGED
        wear_and_tear=True                                      → NORMAL_WEAR
        likely_tenant_caused=False AND change_detected=True     → PRE_EXISTING
        likely_tenant_caused=True  AND change_detected=True     → NEW_DAMAGE
        confidence < 0.30                                       → status=unverifiable_by_cv, verdict=None
        anything else (PARTIAL, null likely_tenant_caused)      → verdict=None (Agent 03 LLM decides)
    """
    confidence = float(raw.get("confidence", 0.0))
    change_detected = raw.get("change_detected")
    wear_and_tear = raw.get("wear_and_tear")
    likely_tenant_caused = raw.get("likely_tenant_caused")

    # Low confidence — cannot make a reliable determination
    if confidence < 0.30:
        return CVResult(
            claim_id=claim_id,
            verdict=None,
            confidence=confidence,
            move_in_condition=raw.get("move_in_condition", ""),
            move_out_condition=raw.get("move_out_condition", ""),
            status="unverifiable_by_cv",
        )

    verdict: CVVerdict | None = None

    if change_detected is False:
        verdict = "UNCHANGED"
    elif wear_and_tear is True:
        verdict = "NORMAL_WEAR"
    elif change_detected is True and likely_tenant_caused is False:
        verdict = "PRE_EXISTING"
    elif change_detected is True and likely_tenant_caused is True:
        verdict = "NEW_DAMAGE"
    # PARTIAL / null likely_tenant_caused / assessment failure → verdict=None (LLM decides)

    return CVResult(
        claim_id=claim_id,
        verdict=verdict,
        confidence=confidence,
        move_in_condition=raw.get("move_in_condition", ""),
        move_out_condition=raw.get("move_out_condition", ""),
        status="ok",
    )
