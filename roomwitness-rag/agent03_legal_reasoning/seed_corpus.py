"""
Standalone script to ingest Thai rental law chunks into ChromaDB.

Run once before starting Agent 03:
    python agent03_legal_reasoning/seed_corpus.py

Requirements:
    pip install chromadb
    (uses ChromaDB's built-in DefaultEmbeddingFunction — no PyTorch needed)
"""

import json
import sys
from pathlib import Path

# Allow running from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

# TODO: Ensure CHROMA_PERSIST_DIR in .env matches where Agent 03 will look.
#       Default is ./chroma_db (relative to the repo root).
try:
    from shared.config import CHROMA_PERSIST_DIR
except ImportError:
    CHROMA_PERSIST_DIR = "./chroma_db"

_COLLECTION_NAME = "thai_rental_law"

CORPUS_DIR = Path(__file__).parent / "legal_corpus"
CORPUS_FILES = [
    CORPUS_DIR / "ocpb_2568.json",
    CORPUS_DIR / "ccc_537_571.json",
]


def main() -> None:
    """Load all corpus JSON files and upsert chunks into ChromaDB."""
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    ef = DefaultEmbeddingFunction()
    collection = client.get_or_create_collection(
        name=_COLLECTION_NAME,
        embedding_function=ef,
    )

    total = 0
    for corpus_file in CORPUS_FILES:
        if not corpus_file.exists():
            print(f"WARNING: Corpus file not found — {corpus_file}")
            continue

        chunks: list[dict] = json.loads(corpus_file.read_text(encoding="utf-8"))
        for chunk in chunks:
            chunk_id = chunk["chunk_id"]
            # Embed combined English + Thai text for bilingual retrieval
            document = chunk.get("text_en", "") + " " + chunk.get("text_th", "")
            # Store all non-text fields as metadata (ChromaDB metadata must be flat)
            metadata = {
                k: v
                for k, v in chunk.items()
                if k not in ("text_en", "text_th")
            }
            metadata["text_th"] = chunk.get("text_th", "")
            metadata["text_en"] = chunk.get("text_en", "")

            try:
                collection.add(
                    documents=[document],
                    metadatas=[metadata],
                    ids=[chunk_id],
                )
                print(f"Seeded chunk: {chunk_id}")
                total += 1
            except Exception as exc:
                # Duplicate ID — chunk already in collection, skip silently
                if "already exists" in str(exc).lower() or "duplicate" in str(exc).lower():
                    print(f"Skipped (already exists): {chunk_id}")
                else:
                    print(f"ERROR seeding {chunk_id}: {exc}")

    print(f"\nDone. {total} chunks loaded into ChromaDB.")


if __name__ == "__main__":
    main()
