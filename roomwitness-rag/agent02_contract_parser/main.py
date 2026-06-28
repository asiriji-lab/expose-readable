import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from langchain_openai import ChatOpenAI

from agent02_contract_parser.extractor import download_from_s3, extract_lease_text
from agent02_contract_parser.models import (
    Agent02Input,
    Agent02Output,
    ContractSummary,
    LiabilityItem,
    UnfairClause,
)
from agent02_contract_parser.parser import parse_contract
from shared.typhoon_client import get_typhoon_llm

logger = logging.getLogger(__name__)

# Module-level LLM reference populated at startup
_llm: ChatOpenAI | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Typhoon v2 LLM once at startup."""
    global _llm
    # TODO: Ensure TYPHOON_API_KEY is set in .env before starting
    _llm = get_typhoon_llm(temperature=0.1)
    logger.info("Agent 02 — Typhoon v2 LLM initialised")
    yield
    _llm = None


app = FastAPI(
    title="RoomWitness Agent 02 — Contract Parser",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "agent": "02"}


@app.post("/api/v1/agent02", response_model=Agent02Output)
async def run_agent02(payload: Agent02Input) -> Agent02Output:
    """
    Parse a lease contract PDF and produce a structured liability map.

    Flow:
        1. Download PDF from S3 (or local path in demo mode).
        2. Extract text via PyMuPDF; fall back to Tesseract OCR if sparse.
        3. Parse with Typhoon v2 via LangChain chain.
        4. Return structured Agent02Output.

    Args:
        payload: Agent02Input containing case_id, S3 URL, and landlord claims.

    Returns:
        Agent02Output with liability_map, contract_summary, unfair_clauses,
        ocr_used flag, and extraction_confidence.
    """
    if _llm is None:
        raise HTTPException(status_code=503, detail="LLM not initialised")

    # Step 1: Fetch PDF
    try:
        local_path = download_from_s3(payload.lease_contract_url)
    except Exception as exc:
        logger.exception("Failed to download lease PDF")
        raise HTTPException(status_code=502, detail=f"PDF download failed: {exc}") from exc

    # Step 2: Extract text
    try:
        lease_text, ocr_used, confidence = extract_lease_text(local_path)
    except Exception as exc:
        logger.exception("Text extraction failed")
        raise HTTPException(status_code=422, detail=f"Text extraction failed: {exc}") from exc

    # Step 3: Parse with Typhoon v2
    claims_dicts = [c.model_dump() for c in payload.landlord_claims]
    try:
        parsed = parse_contract(lease_text, claims_dicts, _llm)
    except Exception as exc:
        logger.exception("Contract parsing failed")
        raise HTTPException(status_code=500, detail=f"Contract parsing failed: {exc}") from exc

    # Step 4: Assemble output
    liability_map = [LiabilityItem(**item) for item in parsed.get("liability_map", [])]
    contract_summary = ContractSummary(**parsed["contract_summary"])
    unfair_clauses = [UnfairClause(**c) for c in parsed.get("unfair_clauses", [])]

    return Agent02Output(
        case_id=payload.case_id,
        liability_map=liability_map,
        contract_summary=contract_summary,
        unfair_clauses=unfair_clauses,
        ocr_used=ocr_used,
        extraction_confidence=confidence,
    )
