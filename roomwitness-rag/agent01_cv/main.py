import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from groq import Groq

from agent01_cv.cv import assess_claim, prepare_image, MODEL
from agent01_cv.evidence import run_evidence_analysis
from agent01_cv.models import (
    Agent01Input,
    Agent01Output,
    CVResult,
    EvidenceResult,
    translate_to_cv_result,
)
from shared.s3_client import download_to_temp

logger = logging.getLogger(__name__)

_groq: Groq | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Groq client once at startup."""
    global _groq
    # TODO: Ensure GROQ_API_KEY is set in .env
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — Agent 01 will fail on all requests")
    _groq = Groq(api_key=api_key)
    logger.info("Agent 01 — Groq client initialised (model: %s)", MODEL)
    yield
    _groq = None


app = FastAPI(
    title="RoomWitness Agent 01 — CV Damage Assessment",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "agent": "01"}


@app.post("/api/v1/agent01", response_model=Agent01Output)
async def run_agent01(payload: Agent01Input) -> Agent01Output:
    """
    Compare move-in vs move-out photos per claim and return a damage_map for Agent 03.

    Flow per claim:
        1. Download move-in and move-out images from S3 (or local path in demo mode).
        2. assess_claim() — Groq Llama-4-Scout visual comparison.
        3. translate_to_cv_result() — bridge Groq output to Agent 03 CVResult schema.

    Optionally, if conversation_screenshots are provided:
        4. run_evidence_analysis() — extract promises and deposit mentions from chat screenshots.

    The returned damage_map is passed directly to Agent 03 as the damage_map field.
    Pass an empty list to Agent 03 if you want to skip Agent 01 entirely.

    Args:
        payload: Agent01Input with claim_photos and optional conversation_screenshots.

    Returns:
        Agent01Output with damage_map (CVResult list) and optional evidence summary.
    """
    if _groq is None:
        raise HTTPException(status_code=503, detail="Groq client not initialised")

    damage_map: list[CVResult] = []

    for claim_photo in payload.claim_photos:
        # Download images (S3 or local demo path)
        try:
            movein_path = download_to_temp(claim_photo.movein_image_url)
            moveout_path = download_to_temp(claim_photo.moveout_image_url)
        except Exception as exc:
            logger.warning("Image download failed for claim %s: %s", claim_photo.claim_id, exc)
            damage_map.append(CVResult(
                claim_id=claim_photo.claim_id,
                verdict=None,
                confidence=0.0,
                move_in_condition="image download failed",
                move_out_condition="image download failed",
                status="unverifiable_by_cv",
            ))
            continue

        try:
            movein_b64 = prepare_image(movein_path)
            moveout_b64 = prepare_image(moveout_path)
        except Exception as exc:
            logger.warning("Image encoding failed for claim %s: %s", claim_photo.claim_id, exc)
            damage_map.append(CVResult(
                claim_id=claim_photo.claim_id,
                verdict=None,
                confidence=0.0,
                status="unverifiable_by_cv",
            ))
            continue

        raw = assess_claim(
            move_in_b64=movein_b64,
            move_out_b64=moveout_b64,
            claim_item=claim_photo.item,
            claim_description=claim_photo.description,
            claim_amount=claim_photo.amount_thb,
            client=_groq,
        )
        damage_map.append(translate_to_cv_result(claim_photo.claim_id, raw))

    # Optional: analyse conversation screenshots
    evidence: EvidenceResult | None = None
    screenshot_paths: list[str] = []
    if payload.conversation_screenshots:
        for sc in payload.conversation_screenshots:
            try:
                screenshot_paths.append(download_to_temp(sc.image_url))
            except Exception as exc:
                logger.warning("Screenshot download failed: %s", exc)

    if screenshot_paths or payload.manual_landlord_promises or payload.manual_tenant_promises:
        raw_evidence = run_evidence_analysis(
            screenshot_paths=screenshot_paths,
            manual_landlord_promises=payload.manual_landlord_promises,
            manual_tenant_promises=payload.manual_tenant_promises,
            client=_groq,
        )
        evidence = EvidenceResult(
            screenshots_processed=raw_evidence["screenshots_processed"],
            screenshots_unreadable=raw_evidence["screenshots_unreadable"],
            platforms_detected=raw_evidence["platforms_detected"],
            all_landlord_promises=raw_evidence["all_landlord_promises"],
            all_tenant_promises=raw_evidence["all_tenant_promises"],
            all_deposit_mentions=raw_evidence["all_deposit_mentions"],
            total_messages_extracted=raw_evidence["total_messages_extracted"],
            evidence_text=raw_evidence["evidence_text"],
        )

    return Agent01Output(
        case_id=payload.case_id,
        damage_map=damage_map,
        evidence=evidence,
        model_used=MODEL,
    )
