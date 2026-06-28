from typing import Literal
from pydantic import BaseModel, ConfigDict


class TenantInfo(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name_th: str
    name_en: str
    id_number: str
    address: str
    phone: str


class LandlordInfo(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name_th: str
    address: str
    unit_count: int


class LeaseInfo(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    property_address: str
    start_date: str
    end_date: str
    deposit_thb: float
    monthly_rent_thb: float


class EvidencePhoto(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    item: str
    movein_url: str
    moveout_url: str
    caption_th: str


class DocumentResult(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    s3_url: str
    download_url: str
    generated_at: str
    page_count: int


class Agent04Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    routing: Literal["OCPB", "CIVIL", "BOTH"]
    documents_to_generate: list[str]
    tenant: TenantInfo
    landlord: LandlordInfo
    lease: LeaseInfo
    verdicts: list               # ClaimVerdict list from Agent 03
    total_unlawful_thb: float
    evidence_photos: list[EvidencePhoto]
    case_summary_th: str
    case_summary_en: str


class Agent04Output(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    case_id: str
    documents: dict[str, DocumentResult]
    generation_time_seconds: float
    total_unlawful_amount_thb: float
