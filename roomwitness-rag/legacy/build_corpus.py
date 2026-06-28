# Orchestrates scraping, chunking, and embedding for the RoomWitness legal corpus

import os
import re
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

RAW_DIR = Path("corpus/raw")
CHUNKS_DIR = Path("corpus/chunks")
CHUNKS_FILE = CHUNKS_DIR / "all_chunks.json"
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
EMBED_MODEL = os.getenv("EMBED_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
COLLECTION_NAME = "thai_rental_law"


# ─── Topic mapping for CCC sections ────────────────────────────────────────────

def get_ccc_topic(section_num: int) -> str:
    if 537 <= section_num <= 538:
        return "rental_definition"
    if 539 <= section_num <= 541:
        return "landlord_obligations"
    if 542 <= section_num <= 548:
        return "tenant_obligations"
    if 549 <= section_num <= 553:
        return "damage_liability"
    if 554 <= section_num <= 558:
        return "wear_and_tear"
    if 559 <= section_num <= 564:
        return "deposit_return"
    if 565 <= section_num <= 571:
        return "termination"
    return "general"


# ─── Step 1: Run scrapers ───────────────────────────────────────────────────────

def run_scrapers():
    print("=" * 60)
    print("STEP 1: Scraping legal sources")
    print("=" * 60)
    import subprocess

    print("\n[CCC] Running scraper/scrape_ccc.py …")
    subprocess.run([sys.executable, "scraper/scrape_ccc.py"])

    print("\n[OCPB] Running scraper/scrape_ocpb.py …")
    subprocess.run([sys.executable, "scraper/scrape_ocpb.py"])


# ─── Step 2: Chunking ──────────────────────────────────────────────────────────

def chunk_ccc() -> list[dict]:
    chunks = []
    for path in sorted(RAW_DIR.glob("ccc_*.txt")):
        m = re.search(r"ccc_(\d+)\.txt", path.name)
        if not m:
            continue
        num = int(m.group(1))
        raw = path.read_text(encoding="utf-8").strip()
        text = raw if raw.startswith(f"มาตรา {num}") else f"มาตรา {num} — {raw}"
        chunks.append({
            "id": f"ccc_{num}",
            "text": text,
            "metadata": {
                "source": "CCC",
                "section": str(num),
                "topic": get_ccc_topic(num),
                "language": "th",
            },
        })
    return chunks


def chunk_ocpb() -> list[dict]:
    txt_path = RAW_DIR / "ocpb_2025.txt"
    if not txt_path.exists():
        print("[WARN] corpus/raw/ocpb_2025.txt not found — skipping OCPB chunks.")
        return []
    raw = txt_path.read_text(encoding="utf-8").strip()
    parts = re.split(r"(?=ข้อ\s+[๐-๙\d]+)", raw)
    counter: dict[str, int] = {}
    chunks = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        m = re.match(r"ข้อ\s+([๐-๙\d]+)", part)
        if not m:
            continue
        num = m.group(1)
        # Make IDs unique across the document so all clauses (including
        # contract-template appendix) are stored and retrievable
        counter[num] = counter.get(num, 0) + 1
        suffix = "" if counter[num] == 1 else f"_{counter[num]}"
        chunk_id = f"ocpb_{num}{suffix}"
        text = part if part.startswith(f"ข้อ {num}") else f"ข้อ {num} — {part}"
        chunks.append({
            "id": chunk_id,
            "text": text,
            "metadata": {
                "source": "OCPB",
                "section": num,
                "topic": "unlawful_clause",
                "language": "th",
            },
        })
    return chunks


def build_chunks() -> list[dict]:
    print("\n" + "=" * 60)
    print("STEP 2: Chunking")
    print("=" * 60)
    CHUNKS_DIR.mkdir(parents=True, exist_ok=True)
    ccc_chunks = chunk_ccc()
    ocpb_chunks = chunk_ocpb()
    all_chunks = ccc_chunks + ocpb_chunks
    CHUNKS_FILE.write_text(
        json.dumps(all_chunks, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"CCC chunks:  {len(ccc_chunks)}")
    print(f"OCPB chunks: {len(ocpb_chunks)}")
    print(f"Total:       {len(all_chunks)} → {CHUNKS_FILE}")
    return all_chunks


# ─── Step 3: Embed with sentence-transformers, store in ChromaDB ───────────────

def embed_and_store(chunks: list[dict]):
    print("\n" + "=" * 60)
    print("STEP 3: Embedding (sentence-transformers) + ChromaDB")
    print("=" * 60)

    from sentence_transformers import SentenceTransformer
    import chromadb
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

    print(f"Loading embedding model: {EMBED_MODEL}")
    ef = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
    model = SentenceTransformer(EMBED_MODEL)

    chroma = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = chroma.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
    )

    if collection.count() > 0:
        print(f"Corpus already loaded ({collection.count()} docs). Skipping.")
        run_test_query(collection, model)
        return

    BATCH = 50
    total = len(chunks)
    stored = 0

    for batch_start in range(0, total, BATCH):
        batch = chunks[batch_start: batch_start + BATCH]
        texts = [c["text"] for c in batch]
        ids = [c["id"] for c in batch]
        metadatas = [c["metadata"] for c in batch]
        embeddings = model.encode(texts, show_progress_bar=False).tolist()

        collection.add(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        stored += len(batch)
        if stored % 10 == 0 or stored == total:
            print(f"  Progress: {stored}/{total} chunks stored")

    print(f"\nTotal documents stored: {collection.count()}")
    run_test_query(collection, model)


def run_test_query(collection, model):
    query = "ผู้เช่าต้องรับผิดชอบความเสียหาย"
    print(f"\nTest query: '{query}'")
    q_emb = model.encode([query]).tolist()
    results = collection.query(query_embeddings=q_emb, n_results=3)
    print(f"Top 3 retrieved chunk IDs: {results['ids'][0]}")


# ─── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_scrapers()

    if CHUNKS_FILE.exists():
        print(f"\nChunks file found. Re-chunk from raw files? [y/N] ", end="")
        choice = input().strip().lower()
        if choice == "y":
            chunks = build_chunks()
        else:
            chunks = json.loads(CHUNKS_FILE.read_text(encoding="utf-8"))
            print(f"Loaded {len(chunks)} existing chunks.")
    else:
        chunks = build_chunks()

    if not chunks:
        print("[ERROR] No chunks produced. Check corpus/raw/ for scraped files.")
        sys.exit(1)

    embed_and_store(chunks)
    print("\nBuild complete.")
