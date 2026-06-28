# RoomWitness — AI Pipeline for Thai Rental Deposit Disputes

RoomWitness helps Bangkok renters dispute unfair security deposit deductions.
It takes move-in/out photos, a lease contract, and the landlord's damage claim,
then produces three ready-to-file Thai legal documents via a 4-agent AI pipeline.

## Pipeline Overview

```
[Photos + Screenshots]        [Lease PDF]
         │                         │
         ▼                         ▼
   Agent 01 (CV)           Agent 02 (Parser)
   Groq Llama-4-Scout      Typhoon v2 + OCR
   damage_map[]            liability_map[]
         │                         │
         └──────────┬──────────────┘
                    ▼
           Agent 03 (Legal Brain)
           Hard rules + RAG + Typhoon v2
           verdicts[] + routing
                    │
                    ▼
           Agent 04 (Doc Generator)
           Typhoon v2 + ReportLab
           3 Thai PDFs → S3
```

| Agent | Role | Port | LLM |
|-------|------|------|-----|
| **Agent 01** | CV — compare move-in vs move-out photos + read chat screenshots | 8001 | Groq Llama-4-Scout |
| **Agent 02** | Contract Parser — extract lease terms, liability map, void clauses | 8002 | Typhoon v2 |
| **Agent 03** | Legal Reasoning — hard rules + RAG + per-claim verdicts + routing | 8003 | Typhoon v2 |
| **Agent 04** | Document Generator — render 3 Thai legal PDFs, upload to S3 | 8004 | Typhoon v2 |

## Team

- **KP** — Lead
- **Beam** — Frontend
- **Tuey** — Tech Lead

## Repository Structure

```
roomwitness-rag/
├── agent01_cv/                   # Vision agent — Groq Llama-4-Scout
│   ├── cv.py                     # Photo comparison logic
│   ├── evidence.py               # Conversation screenshot extraction (LINE/WhatsApp)
│   ├── models.py                 # CVResult schema + translate_to_cv_result()
│   ├── main.py                   # POST /api/v1/agent01
│   └── requirements.txt
├── agent02_contract_parser/      # Lease contract PDF parser — Typhoon v2
├── agent03_legal_reasoning/      # Legal brain — RAG + hard rules + Typhoon v2
│   └── legal_corpus/             # OCPB 2568 + CCC §537-571 JSON chunks
├── agent04_doc_generator/        # PDF renderer — ReportLab + Typhoon v2
│   ├── templates/                # Document structure definitions
│   └── fonts/                    # Place Sarabun .ttf files here
├── shared/                       # Shared utilities
│   ├── config.py                 # All env vars
│   ├── typhoon_client.py         # Typhoon v2 LangChain wrapper
│   └── s3_client.py              # S3 upload/download helpers
├── legacy/                       # Pre-hackathon Groq prototype (not deployed)
├── chroma_db/                    # ChromaDB vector store (auto-created by seed_corpus.py)
├── .env.example                  # Copy to .env and fill in credentials
└── README.md
```

## Prerequisites

- Python 3.11+
- Tesseract OCR with Thai language pack (required by Agent 02):
  - Ubuntu/Debian: `sudo apt-get install tesseract-ocr tesseract-ocr-tha`
  - macOS: `brew install tesseract tesseract-lang`
  - Windows: https://github.com/UB-Mannheim/tesseract/wiki
- AWS S3 bucket (`roomwitness-cases` by default)
- Groq API key (free) — register at https://console.groq.com
- Typhoon v2 API key — register at https://typhoon.apps.opentyphoon.ai (**do this now**)

## Setup

```bash
# 1. Copy environment file and fill in credentials
cp .env.example .env
# Required: GROQ_API_KEY, TYPHOON_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# 2. Install dependencies for each agent
pip install -r agent01_cv/requirements.txt
pip install -r agent02_contract_parser/requirements.txt
pip install -r agent03_legal_reasoning/requirements.txt
pip install -r agent04_doc_generator/requirements.txt
```

## Seed RAG Corpus (run ONCE before starting Agent 03)

```bash
python agent03_legal_reasoning/seed_corpus.py
```

Loads OCPB 2568 and Civil Code §537-571 into ChromaDB. Run again only if you update `legal_corpus/*.json`.

## Thai Font Setup for Agent 04 (REQUIRED before generating PDFs)

1. Download Sarabun from https://fonts.google.com/specimen/Sarabun
2. Place these two files in `agent04_doc_generator/fonts/`:
   - `Sarabun-Regular.ttf`
   - `Sarabun-Bold.ttf`

Without them, ReportLab falls back to Helvetica — Thai characters will not render.

## Run All Agents

Open four terminals from the `roomwitness-rag/` directory:

```bash
uvicorn agent01_cv.main:app --port 8001 --reload
uvicorn agent02_contract_parser.main:app --port 8002 --reload
uvicorn agent03_legal_reasoning.main:app --port 8003 --reload
uvicorn agent04_doc_generator.main:app --port 8004 --reload
```

## API Endpoints

| Method | Path | Agent | Description |
|--------|------|-------|-------------|
| POST | `/api/v1/agent01` | 01 | CV photo comparison + chat screenshot extraction → damage_map |
| POST | `/api/v1/agent02` | 02 | Parse lease PDF → liability_map + contract_summary |
| POST | `/api/v1/agent03` | 03 | Legal reasoning → verdicts + routing + case summary |
| POST | `/api/v1/agent04` | 04 | Generate Thai legal PDFs → S3 presigned URLs |
| GET  | `/health`         | all | `{"status":"ok","agent":"XX"}` |

Interactive API docs available at `http://localhost:800X/docs` for each agent.

## Demo Mode (no AWS for Agent 01 + 02)

Pass local file paths instead of `s3://` URLs for images and the lease PDF:

```json
{ "movein_image_url": "/path/to/movein.jpg", "moveout_image_url": "/path/to/moveout.jpg" }
{ "lease_contract_url": "/path/to/lease.pdf" }
```

Agent 04 still requires AWS credentials to upload output PDFs to S3.

## Data Flow (call order)

```
POST /api/v1/agent01  →  damage_map[]
POST /api/v1/agent02  →  liability_map[], contract_summary{}
POST /api/v1/agent03  (receives damage_map + liability_map)  →  verdicts[], routing
POST /api/v1/agent04  (receives verdicts + routing)  →  PDF download URLs
```

Agent 01 is optional — pass `damage_map: []` to Agent 03 to skip CV and let Typhoon reason from contract + law alone.

---

## Legacy prototype

`legacy/` contains the pre-hackathon Groq + Flask prototype (`rag_agent.py`, `build_corpus.py`, `portal/`, `scraper/`). Not deployed.
