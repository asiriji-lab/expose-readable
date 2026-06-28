# RoomWitness — Frontend ↔ Backend API Contract

This is the contract the `roomwitness-app` (Expo/React Native) client depends on. The TypeScript
types in `src/lib/types.ts` are the **authoritative response shapes** — keep server output in sync
with them. The reference implementation is `roomwitness-rag/portal/app.py` (Flask, port 5001).

## Config & CORS

- **Base URL**: client reads `EXPO_PUBLIC_API_BASE` (see `.env.example`). No trailing slash.
- **CORS**: the **web** build sends cross-origin requests, so the server must allow the app origin
  (`pip install flask-cors`; `CORS(app)`). Native iOS/Android builds do **not** need CORS.
- **Auth**: none (hackathon scope).
- **Mock mode**: when `EXPO_PUBLIC_USE_MOCK !== 'false'` the client never calls the network and uses
  `src/lib/fixtures.ts`. Set it to `false` to integrate.

## Error envelope

Every route returns `{ "error": string }` with a non-2xx status on failure (`src/lib/types.ts`
`ApiError`). The client throws the `error` string. Known statuses: `400` (bad input), `422`
(unprocessable, e.g. OCR found no text), `500` (server error).

---

## `POST /full-analysis` — primary endpoint (in use)

`multipart/form-data`. Runs CV → evidence → legal per claim. Implemented today.

**Fields** (from `src/lib/api.ts`):

| field | type | required | notes |
|---|---|---|---|
| `claims` | JSON string of `{item, description, amount_thb}[]` | ✅ | ≥1 or `400` |
| `move_in_image` | file | optional | single |
| `move_out_image` | file | optional | single |
| `screenshots` | file (repeated) | optional | chat screenshots |
| `contract_clause` | string | optional | sent even if empty |
| `manual_landlord_promises` | string | optional | sent even if empty |
| `manual_tenant_promises` | string | optional | sent even if empty |

**Response** = `FullAnalysis` (`src/lib/types.ts`):

```jsonc
{
  "claims": [
    {
      "claim": { "item": "...", "description": "...", "amount_thb": 5000 },
      "cv":    { "move_in_condition": "...", "move_out_condition": "...", "wear_and_tear": true,
                 "likely_tenant_caused": false, "low_visibility": false,
                 "supports_landlord_claim": "YES|NO|PARTIAL", "confidence": 0.82 },
      "legal": { "classification": "LAWFUL|DISPUTED|UNLAWFUL", "confidence": 0.88,
                 "dimensions": { "pre_existence": "...", "wear_and_tear": "...",
                                 "proportionality": "...", "contractual_clarity": "..." },
                 "legal_basis": [ { "section": "CCC §563", "source": "CCC|OCPB",
                                    "excerpt": "...", "favors": "TENANT|LANDLORD" } ],
                 "summary_th": "..." }
    }
  ],
  "cv_summary": { "total_claims": 3, "supported_claims": 1, "disputed_claims": 1,
                  "partial_claims": 1, "total_disputed_amount": 8000 },          // or null
  "evidence_summary": { "landlord_promises": [], "tenant_promises": [],
                        "deposit_mentions": [], "platforms": [] },               // or null
  "images_used": { "move_in": "move_in.jpg", "move_out": "move_out.jpg" }
}
```

### ⚠️ Contract rules the backend MUST honor

1. **Per-claim `cv` may be absent.** When no photos are provided, return `"cv": null`
   (**preferred**). The reference impl currently returns `{}` (`portal/app.py:286,303`) — the client
   tolerates both, but `null` is the contract. The client renders extra/unknown `cv` fields harmlessly,
   but every field listed above must be present when `cv` is non-null.
2. The server may return **more** fields than listed (e.g. `change_description`, `dispute_amount`,
   `retrieved_sections`, `notes`); the client ignores extras. Do not **remove** any listed field.
3. **Recoverable-฿ is computed client-side** (`src/app/results.tsx` sums non-`LAWFUL` claims and labels
   it an estimate). The backend does **not** compute a recoverable total for this endpoint.
4. **Latency / sync-vs-async (OPEN DECISION).** The pipeline is ~3-5 min; the client currently does one
   blocking request with a 5-minute timeout (`src/lib/api.ts`). If real latency risks mobile timeouts,
   switch to an async job (`202` + job id) + poll/`GET status` — coordinate before integration.

---

## `POST /generate-documents` — Agent 04 (PROPOSED, not yet exposed)

The logic exists (`roomwitness-rag/agent04_doc_generator/`) but **no portal route** serves it. The
client calls this path (`src/lib/api.ts` `generateDocuments`) and falls back to mock until it exists.
Body is `application/json`.

**Request** = `Agent04Input` (`agent04_doc_generator/models.py`):

```jsonc
{
  "case_id": "RW-...",
  "routing": "OCPB|CIVIL|BOTH",
  "documents_to_generate": ["ocpb_complaint", "deposit_demand", "evidence_summary"],
  "tenant":   { "name_th": "", "name_en": "", "id_number": "", "address": "", "phone": "" },
  "landlord": { "name_th": "", "address": "", "unit_count": 0 },
  "lease":    { "property_address": "", "start_date": "", "end_date": "",
                "deposit_thb": 0, "monthly_rent_thb": 0 },
  "verdicts": [ /* Agent 03 verdicts; client sends FullAnalysis.claims */ ],
  "total_unlawful_thb": 5000,
  "evidence_photos": [ { "item": "", "movein_url": "", "moveout_url": "", "caption_th": "" } ],
  "case_summary_th": "",
  "case_summary_en": ""
}
```

**Response** = `Agent04Output`:

```jsonc
{
  "case_id": "RW-...",
  "documents": {
    "ocpb_complaint":   { "s3_url": "...", "download_url": "https://...", "generated_at": "ISO8601", "page_count": 3 },
    "deposit_demand":   { "s3_url": "...", "download_url": "https://...", "generated_at": "ISO8601", "page_count": 2 },
    "evidence_summary": { "s3_url": "...", "download_url": "https://...", "generated_at": "ISO8601", "page_count": 4 }
  },
  "generation_time_seconds": 6.2,
  "total_unlawful_amount_thb": 5000
}
```

The client renders each `documents[key]` as a card and opens `download_url` in a browser, so
`download_url` must be a publicly fetchable URL.

### Status & remaining work

- ✅ The client now collects tenant/landlord/lease PII + routing on the **Details screen**
  (`src/app/details.tsx`, step 4) and assembles the request in `src/app/documents.tsx` `buildDocsForm`.
- ⬜ **Backend must add the `/generate-documents` route** wrapping `agent04_doc_generator`.
- ⬜ `evidence_photos[]` is sent **empty** — the client only has local image URIs / server-side
  filenames, not public URLs. Backend should populate photo URLs from its own storage (e.g. the S3
  uploads it already produces), or define how the client should pass them.
- ⬜ `case_summary_th` / `case_summary_en` are sent empty; backend can synthesize from `verdicts`.

---

## `GET /health`

```jsonc
{ "status": "ok", "corpus_loaded": true }
```

## Available but currently unused by the app

The app does not call these, but they exist and are useful (keep them):

- `POST /extract-contract` — `contract_file` (PDF/image) → `{ "text": "..." }` (PDF via pdfplumber,
  images via Tesseract `tha+eng`). Could replace manual contract-clause paste.
- `POST /extract-evidence` — screenshots + manual promises → evidence object.
- `POST /assess-damage` — move-in/out images + `claims` → CV-only assessment.
- `POST /analyze` — single claim, legal-only.
