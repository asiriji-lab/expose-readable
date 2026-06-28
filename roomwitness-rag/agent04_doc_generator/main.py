import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from langchain_openai import ChatOpenAI

from agent04_doc_generator.generator import generate_document
from agent04_doc_generator.models import Agent04Input, Agent04Output, DocumentResult
from agent04_doc_generator.renderer import render_to_pdf
from agent04_doc_generator.templates.ocpb_complaint import OCPB_STRUCTURE
from agent04_doc_generator.templates.demand_letter import DEMAND_STRUCTURE
from agent04_doc_generator.templates.evidence_summary import EVIDENCE_STRUCTURE
from agent04_doc_generator.uploader import upload_to_s3
from shared.typhoon_client import get_typhoon_llm

logger = logging.getLogger(__name__)

_STRUCTURES = {
    "ocpb_complaint": OCPB_STRUCTURE,
    "demand_letter": DEMAND_STRUCTURE,
    "evidence_summary": EVIDENCE_STRUCTURE,
}

_llm: ChatOpenAI | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Typhoon v2 LLM once at startup (temperature=0.05 for deterministic docs)."""
    global _llm
    # TODO: Ensure TYPHOON_API_KEY is set in .env before starting.
    _llm = get_typhoon_llm(temperature=0.05)
    logger.info("Agent 04 — Typhoon v2 LLM initialised (temperature=0.05)")
    yield
    _llm = None


app = FastAPI(
    title="RoomWitness Agent 04 — Document Generator",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "agent": "04"}


@app.post("/api/v1/agent04", response_model=Agent04Output)
async def run_agent04(payload: Agent04Input) -> Agent04Output:
    """
    Generate Thai legal documents from Agent 03 verdict package.

    No legal reasoning is performed here — all verdicts and citations come from
    Agent 03 and are passed through unchanged.

    Flow for each document in documents_to_generate:
        1. Build case_data context dict from payload.
        2. generate_document() — fill sections with Typhoon v2, validate, retry if needed.
        3. render_to_pdf() — produce PDF bytes with Sarabun Thai font.
        4. upload_to_s3() — store PDF and return presigned download URL.

    Args:
        payload: Agent04Input from Agent 03 output plus tenant/landlord/lease info.

    Returns:
        Agent04Output with DocumentResult for each generated document.
    """
    if _llm is None:
        raise HTTPException(status_code=503, detail="LLM not initialised")

    start_time = time.perf_counter()

    # Build shared context dict passed to every section fill
    case_data = {
        "case_id": payload.case_id,
        "tenant": payload.tenant.model_dump(),
        "landlord": payload.landlord.model_dump(),
        "lease": payload.lease.model_dump(),
        "verdicts": payload.verdicts,
        "total_unlawful_thb": payload.total_unlawful_thb,
        "evidence_photos": [p.model_dump() for p in payload.evidence_photos],
        "case_summary_th": payload.case_summary_th,
        "case_summary_en": payload.case_summary_en,
        # Convenience flattened fields used by instruction templates
        "tenant_name_th": payload.tenant.name_th,
        "property_address": payload.lease.property_address,
        "start_date": payload.lease.start_date,
        "end_date": payload.lease.end_date,
        "deposit_thb": payload.lease.deposit_thb,
    }

    documents: dict[str, DocumentResult] = {}

    for doc_type in payload.documents_to_generate:
        structure = _STRUCTURES.get(doc_type)
        if structure is None:
            logger.warning("Unknown document type requested: %s — skipping", doc_type)
            continue

        logger.info("Generating document: %s", doc_type)
        try:
            filled = generate_document(doc_type, case_data, structure, _llm)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Document generation failed for '{doc_type}': {exc}",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error generating %s", doc_type)
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error generating '{doc_type}': {exc}",
            ) from exc

        pdf_bytes, page_count = render_to_pdf(filled, doc_type, payload.case_id)

        try:
            doc_result = upload_to_s3(pdf_bytes, payload.case_id, doc_type, page_count)
        except Exception as exc:
            logger.exception("S3 upload failed for %s", doc_type)
            raise HTTPException(
                status_code=502,
                detail=f"S3 upload failed for '{doc_type}': {exc}",
            ) from exc

        documents[doc_type] = doc_result

    elapsed = time.perf_counter() - start_time

    return Agent04Output(
        case_id=payload.case_id,
        documents=documents,
        generation_time_seconds=round(elapsed, 2),
        total_unlawful_amount_thb=payload.total_unlawful_thb,
    )
