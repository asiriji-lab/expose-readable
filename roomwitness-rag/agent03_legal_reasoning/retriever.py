import logging

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

from shared.config import CHROMA_PERSIST_DIR

logger = logging.getLogger(__name__)

_COLLECTION_NAME = "thai_rental_law"


def get_chroma_client() -> chromadb.PersistentClient:
    """
    Return a ChromaDB PersistentClient that stores vectors in CHROMA_PERSIST_DIR.

    Uses ChromaDB's DefaultEmbeddingFunction (onnxruntime, no PyTorch required).
    TODO: On first run, execute seed_corpus.py to populate the collection:
          python agent03_legal_reasoning/seed_corpus.py
    """
    return chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)


def get_collection(client: chromadb.PersistentClient) -> chromadb.Collection:
    """
    Get (or create) the 'thai_rental_law' ChromaDB collection.

    Args:
        client: An initialised ChromaDB PersistentClient.

    Returns:
        ChromaDB Collection ready for querying.
    """
    ef = DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=_COLLECTION_NAME,
        embedding_function=ef,
    )


def build_rag_query(item: str, description: str, cv_verdict: str | None) -> str:
    """
    Construct a retrieval query from claim fields.

    Combines item name, landlord description, and CV verdict label into a
    Thai-law-oriented query string for semantic search.

    Args:
        item: Name of the damaged item (e.g. 'kitchen cabinet').
        description: Landlord's description of the damage.
        cv_verdict: CV verdict label or None if Agent 01 was not run.

    Returns:
        English-biased query string for better embedding recall.
    """
    cv_part = cv_verdict if cv_verdict else "damage claim"
    return f"{item} {description} {cv_part} tenant liability Thailand rental deposit"


def retrieve_chunks(query: str, top_k: int = 3) -> list[dict]:
    """
    Query ChromaDB for the most relevant Thai law chunks.

    Args:
        query: Retrieval query string.
        top_k: Number of chunks to return.

    Returns:
        List of dicts, each with keys:
            chunk_id, text_th, text_en, law_name_th, clause, legal_implication.
    """
    client = get_chroma_client()
    collection = get_collection(client)

    results = collection.query(query_texts=[query], n_results=top_k)

    chunks: list[dict] = []
    if not results["ids"] or not results["ids"][0]:
        return chunks

    for i, doc_id in enumerate(results["ids"][0]):
        meta = results["metadatas"][0][i] if results["metadatas"] else {}
        document = results["documents"][0][i] if results["documents"] else ""
        chunks.append({
            "chunk_id": doc_id,
            "text_th": meta.get("text_th", ""),
            "text_en": meta.get("text_en", document),
            "law_name_th": meta.get("law_name_th", ""),
            "clause": meta.get("clause", ""),
            "legal_implication": meta.get("legal_implication", ""),
        })
    return chunks


def format_chunks_for_prompt(chunks: list[dict]) -> str:
    """
    Format retrieved law chunks as a numbered list for Typhoon prompt injection.

    Args:
        chunks: List of chunk dicts from retrieve_chunks().

    Returns:
        Numbered Thai/English law excerpt string.
    """
    if not chunks:
        return "ไม่พบบทบัญญัติที่เกี่ยวข้อง (No relevant law provisions found)"

    lines: list[str] = []
    for i, chunk in enumerate(chunks, 1):
        law = chunk.get("law_name_th", "")
        clause = chunk.get("clause", "")
        text_th = chunk.get("text_th", "")
        text_en = chunk.get("text_en", "")
        lines.append(
            f"{i}. {law} — {clause}\n"
            f"   TH: {text_th}\n"
            f"   EN: {text_en}"
        )
    return "\n".join(lines)
