from pydantic import BaseModel, ConfigDict


class LandlordClaim(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    claim_id: str
    item: str
    amount_thb: float
    description: str


class LiabilityItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    item: str
    tenant_liable: bool
    contract_clause: str | None
    clause_found: bool
    pre_existing_disclosed: bool
    notes: str


class ContractSummary(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    deposit_amount_thb: float
    deposit_months: int
    lease_start: str
    lease_end: str
    notice_period_days: int
    monthly_rent_thb: float


class UnfairClause(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    clause_text: str
    reason_void: str


class Agent02Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    lease_contract_url: str    # s3://bucket/case_id/lease.pdf  (or local path for demo)
    landlord_claims: list[LandlordClaim]


class Agent02Output(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    liability_map: list[LiabilityItem]
    contract_summary: ContractSummary
    unfair_clauses: list[UnfairClause]
    ocr_used: bool
    extraction_confidence: float
