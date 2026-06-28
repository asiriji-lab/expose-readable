import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from agent03_legal_reasoning.models import (
    Agent03Input,
    Agent03Output,
    ClaimVerdict,
    CVResult,
)
from agent03_legal_reasoning.prompts import SUMMARY_PROMPT
from agent03_legal_reasoning.reasoner import apply_hard_rules, reason_claim
from agent03_legal_reasoning.retriever import (
    build_rag_query,
    format_chunks_for_prompt,
    get_chroma_client,
    get_collection,
    retrieve_chunks,
)
from agent03_legal_reasoning.router import determine_routing
from shared.typhoon_client import get_typhoon_llm

logger = logging.getLogger(__name__)

_llm: ChatOpenAI | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise Typhoon v2 LLM and ChromaDB client once at startup."""
    global _llm
    # TODO: Ensure TYPHOON_API_KEY is set in .env before starting.
    # TODO: Run seed_corpus.py once before starting this agent:
    #       python agent03_legal_reasoning/seed_corpus.py
    _llm = get_typhoon_llm(temperature=0.1)
    # Eagerly initialise ChromaDB to surface missing collection early
    try:
        client = get_chroma_client()
        get_collection(client)
        logger.info("Agent 03 — ChromaDB collection 'thai_rental_law' ready")
    except Exception as exc:
        logger.warning("ChromaDB init warning: %s", exc)
    logger.info("Agent 03 — Typhoon v2 LLM initialised")
    yield
    _llm = None


app = FastAPI(
    title="RoomWitness Agent 03 — Legal Reasoning",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Liveness probe."""
    return {"status": "ok", "agent": "03"}


@app.post("/api/v1/agent03", response_model=Agent03Output)
async def run_agent03(payload: Agent03Input) -> Agent03Output:
    """
    Apply hard rules + RAG-augmented Typhoon v2 reasoning to each landlord claim.

    Flow per claim:
        1. Match claim_id to CVResult in damage_map (None if not found / Agent 01 not run).
        2. Match claim item to liability_map entry from Agent 02.
        3. apply_hard_rules() → forced_verdict or None.
        4. build_rag_query() → retrieve_chunks() → format_chunks_for_prompt().
        5. reason_claim() → ClaimVerdict.

    Then:
        - Sum total_claimed_thb and total_unlawful_thb.
        - Determine routing.
        - Generate case summary with one final Typhoon call.

    Args:
        payload: Agent03Input with damage_map, liability_map, contract info, and routing hints.

    Returns:
        Agent03Output with verdicts, routing, totals, and case summaries.
    """
    if _llm is None:
        raise HTTPException(status_code=503, detail="LLM not initialised")

    # Build lookup maps
    cv_by_id: dict[str, CVResult] = {cv.claim_id: cv for cv in payload.damage_map}
    liability_by_item: dict[str, dict] = {
        entry.get("item", "").lower(): entry
        for entry in payload.liability_map
    }

    verdicts: list[ClaimVerdict] = []
    total_claimed = 0.0
    total_unlawful = 0.0

    # We need the original claims. They come embedded in liability_map or damage_map.
    # Reconstruct minimal claim list from liability_map entries combined with damage_map.
    # The canonical claim list is the liability_map from Agent 02 (one entry per claim).
    for entry in payload.liability_map:
        claim_id = entry.get("claim_id", entry.get("item", "unknown"))
        item = entry.get("item", "")
        amount_thb = float(entry.get("amount_thb", 0.0))
        description = entry.get("description", entry.get("notes", ""))
        contract_liable = bool(entry.get("tenant_liable", False))

        total_claimed += amount_thb

        # Agent 01 result (None if not run or claim not matched)
        cv: CVResult | None = cv_by_id.get(claim_id)
        cv_verdict = cv.verdict if cv else None
        cv_confidence = cv.confidence if cv else 0.0
        # Mark as unverifiable if Agent 01 reported that status
        if cv and cv.status == "unverifiable_by_cv":
            cv_verdict = "unverifiable_by_cv"
            cv_confidence = 0.0

        forced_verdict = apply_hard_rules(
            cv_verdict=cv_verdict,
            cv_confidence=cv_confidence,
            contract_liable=contract_liable,
            movein_report_signed=payload.movein_report_signed,
        )

        # RAG retrieval
        query = build_rag_query(item, description, cv_verdict)
        try:
            chunks = retrieve_chunks(query, top_k=3)
        except Exception as exc:
            logger.warning("ChromaDB retrieval failed for '%s': %s", item, exc)
            chunks = []
        formatted = format_chunks_for_prompt(chunks)

        raw = reason_claim(
            item=item,
            description=description,
            amount_thb=amount_thb,
            cv_verdict=cv_verdict,
            cv_confidence=cv_confidence,
            contract_liable=contract_liable,
            movein_report_signed=payload.movein_report_signed,
            formatted_chunks=formatted,
            forced_verdict=forced_verdict,
            llm=_llm,
        )

        verdict_label = raw.get("verdict", "DISPUTED")
        cv = ClaimVerdict(
            claim_id=claim_id,
            item=item,
            amount_thb=amount_thb,
            verdict=verdict_label,
            reasoning_th=raw.get("reasoning_th", ""),
            reasoning_en=raw.get("reasoning_en", ""),
            citations=raw.get("citations", []),
            recommended_action_th=raw.get("recommended_action_th", ""),
            claim_validity_pct=int(raw.get("claim_validity_pct", 0)),
        )
        verdicts.append(cv)

        if verdict_label == "UNLAWFUL":
            total_unlawful += amount_thb

    routing_result = determine_routing(payload.landlord_unit_count)

    # Final summary call
    summary_chain = SUMMARY_PROMPT | _llm | JsonOutputParser()
    try:
        summary = summary_chain.invoke({
            "verdicts_json": json.dumps(
                [v.model_dump() for v in verdicts], ensure_ascii=False
            ),
            "total_claimed_thb": total_claimed,
            "total_unlawful_thb": total_unlawful,
            "routing": routing_result["route"],
        })
    except Exception as exc:
        logger.warning("Summary generation failed: %s", exc)
        summary = {"case_summary_th": "", "case_summary_en": ""}

    return Agent03Output(
        case_id=payload.case_id,
        routing=routing_result["route"],
        documents_to_generate=routing_result["documents_to_generate"],
        total_claimed_thb=total_claimed,
        total_unlawful_thb=total_unlawful,
        verdicts=verdicts,
        case_summary_th=summary.get("case_summary_th", ""),
        case_summary_en=summary.get("case_summary_en", ""),
    )
