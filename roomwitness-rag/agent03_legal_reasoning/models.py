from typing import Literal
from pydantic import BaseModel, ConfigDict

Verdict = Literal["LAWFUL", "DISPUTED", "UNLAWFUL"]
Routing = Literal["OCPB", "CIVIL", "BOTH"]


class CVResult(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    claim_id: str
    verdict: str | None = None        # PRE_EXISTING | UNCHANGED | NORMAL_WEAR | NEW_DAMAGE | None
    confidence: float = 0.0
    move_in_condition: str = ""
    move_out_condition: str = ""
    status: str = "ok"                # "ok" or "unverifiable_by_cv"


class Agent03Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    damage_map: list[CVResult]        # from Agent 01 — pass empty list if Agent 01 not run
    liability_map: list               # from Agent 02
    contract_summary: dict            # from Agent 02
    landlord_unit_count: int          # 0 = unknown
    movein_report_signed: bool


class ClaimVerdict(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    claim_id: str
    item: str
    amount_thb: float
    verdict: Verdict
    reasoning_th: str
    reasoning_en: str
    citations: list[str]
    recommended_action_th: str
    claim_validity_pct: int


class Agent03Output(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    routing: Routing
    documents_to_generate: list[str]
    total_claimed_thb: float
    total_unlawful_thb: float
    verdicts: list[ClaimVerdict]
    case_summary_th: str
    case_summary_en: str
