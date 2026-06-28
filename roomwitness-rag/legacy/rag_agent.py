# RAG classification agent for Thai rental deposit disputes — uses Groq LLM + local embeddings

import os
import json

import chromadb
from groq import Groq
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
EMBED_MODEL = os.getenv("EMBED_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
COLLECTION_NAME = "thai_rental_law"

_groq_client: Groq | None = None
_embed_model: SentenceTransformer | None = None
_collection = None


def _get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


def _get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL)
    return _embed_model


def _get_collection():
    global _collection
    if _collection is None:
        chroma = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = chroma.get_or_create_collection(name=COLLECTION_NAME)
    return _collection


# ─── 1. Query rewriting ─────────────────────────────────────────────────────────

def rewrite_query(claim_text: str) -> str:
    """Rewrite a rental dispute claim as Thai legal search keywords."""
    client = _get_groq()
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "Rewrite this rental dispute claim as 3-5 Thai legal "
                    "search keywords for retrieving relevant law sections. "
                    "Return only the keywords, no explanation."
                ),
            },
            {"role": "user", "content": claim_text},
        ],
        temperature=0,
        max_tokens=100,
    )
    return resp.choices[0].message.content.strip()


# ─── 2. Retrieval ───────────────────────────────────────────────────────────────

def retrieve_law(query: str, topic_filter: str = None) -> list[dict]:
    """Embed query locally and return top 4 matching chunks from ChromaDB."""
    model = _get_embed_model()
    collection = _get_collection()

    q_emb = model.encode([query]).tolist()
    where = {"topic": topic_filter} if topic_filter else None

    results = collection.query(
        query_embeddings=q_emb,
        n_results=4,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for i in range(len(results["ids"][0])):
        chunks.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return chunks


# ─── 3. Classification ──────────────────────────────────────────────────────────

_FALLBACK_RESULT = {
    "classification": "DISPUTED",
    "confidence": 0.0,
    "dispute_amount": None,
    "error": "classification_failed",
    "dimensions": {},
    "legal_basis": [],
    "summary_th": "ไม่สามารถวิเคราะห์ได้ กรุณาตรวจสอบอีกครั้ง",
    "retrieved_sections": [],
}

_SCHEMA = """{
  "classification": "LAWFUL" or "DISPUTED" or "UNLAWFUL",
  "confidence": float 0.0-1.0,
  "dispute_amount": float (0.0 if LAWFUL, partial or full amount otherwise),
  "dimensions": {
    "pre_existence": str,
    "wear_and_tear": str,
    "proportionality": str,
    "contractual_clarity": str
  },
  "legal_basis": [
    {
      "section": str,
      "source": "CCC" or "OCPB",
      "excerpt": str (max 100 chars from the retrieved text),
      "favors": "TENANT" or "LANDLORD"
    }
  ],
  "summary_th": str (one sentence in Thai for the tenant),
  "retrieved_sections": [str]
}"""


def _build_user_prompt(claim, cv, contract, law_block) -> str:
    return f"""Classify this landlord deposit deduction claim.

RETRIEVED LAW (cite section numbers from here only):
{law_block}

CLAIM ITEM: {claim['item']}
CLAIM DESCRIPTION: {claim['description']}
AMOUNT: {claim['amount_thb']} THB

CV EVIDENCE:
- Move-in condition: {cv['move_in_condition']}
- Move-out condition: {cv['move_out_condition']}
- Change detected: {cv['change_detected']}
- Likely tenant caused: {cv['likely_tenant_caused']}
- Confidence: {cv['confidence']}
- Notes: {cv['notes']}

CONTRACT CLAUSE: {contract}

Analyze across four dimensions:
1. Pre-existence: was damage there before move-in?
2. Wear and tear: normal aging or tenant damage?
3. Proportionality: is the amount reasonable?
4. Contractual clarity: does the contract clearly assign this liability to the tenant?

Return this exact JSON structure:
{_SCHEMA}"""


def _call_classifier(messages: list[dict]) -> dict | None:
    client = _get_groq()
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0,
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def classify_claim(claim: dict, cv_evidence: dict, contract_clause: str) -> dict:
    """
    Full RAG pipeline: rewrite → retrieve → classify with Groq LLM.

    claim: {item, description, amount_thb}
    cv_evidence: {item_matched, move_in_condition, move_out_condition,
                  change_detected, likely_tenant_caused, confidence, notes}
    contract_clause: str
    """
    rewritten = rewrite_query(claim["description"])

    chunks = retrieve_law(rewritten)

    law_block = "\n\n".join(
        f"[{c['metadata']['source']} มาตรา/ข้อ {c['metadata']['section']}]\n{c['text']}"
        for c in chunks
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a Thai consumer protection legal analyst "
                "specializing in rental deposit disputes. "
                "Classify claims using ONLY the provided legal references. "
                "Never use legal knowledge outside what is given. "
                "Respond only in valid JSON. No prose. No markdown."
            ),
        },
        {
            "role": "user",
            "content": _build_user_prompt(claim, cv_evidence, contract_clause, law_block),
        },
    ]

    result = _call_classifier(messages)

    if result is None:
        messages.append({"role": "user", "content": "Return only valid JSON, no other text."})
        result = _call_classifier(messages)

    if result is None:
        fallback = dict(_FALLBACK_RESULT)
        fallback["dispute_amount"] = claim["amount_thb"]
        return fallback

    if not result.get("retrieved_sections"):
        result["retrieved_sections"] = [c["id"] for c in chunks]

    return result


# ─── 4. Pipeline ────────────────────────────────────────────────────────────────

def run_pipeline(claims, cv_outputs, contract_clauses) -> list[dict]:
    results = []
    for i, claim in enumerate(claims):
        cv = cv_outputs[i] if i < len(cv_outputs) else {}
        clause = contract_clauses[i] if i < len(contract_clauses) else ""
        results.append(classify_claim(claim, cv, clause))
    return results


# ─── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_claim = {
        "item": "bedroom wall paint",
        "description": "ความเสียหายของสีผนังห้องนอนที่เกิดจากผู้เช่า",
        "amount_thb": 5000.0,
    }
    test_cv = {
        "item_matched": True,
        "move_in_condition": "สะอาด ไม่มีรอยเปื้อน",
        "move_out_condition": "มีรอยขีดข่วนเล็กน้อยบริเวณล่างของผนัง",
        "change_detected": True,
        "likely_tenant_caused": False,
        "confidence": 0.72,
        "notes": "รอยเป็นการเสื่อมสภาพตามปกติจากการใช้งาน",
    }
    test_contract = (
        "ผู้เช่าต้องรับผิดชอบค่าซ่อมแซมความเสียหาย "
        "ที่เกิดจากความประมาทเลินเล่อของผู้เช่าเท่านั้น"
    )

    result = classify_claim(test_claim, test_cv, test_contract)
    print(json.dumps(result, ensure_ascii=False, indent=2))
