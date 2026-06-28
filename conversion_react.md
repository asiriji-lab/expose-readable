# RoomWitness — Pencil Design → Expo Mobile App (Build Spec)

> **For the implementer (Sonnet / Claude Code).** Build a runnable mobile app MVP from the
> existing Pencil design and Flask backend. Read this whole file before scaffolding. Do **not**
> invent data fields — the response contract below is the single source of truth.

## Goal

A native **Expo / React Native** app, demo-able in **Expo Go on a phone**, that walks a Bangkok
renter through **Upload → Analyzing → Results** and shows a **Documents** placeholder.

- **Data: mock-first.** Build against a mock that matches `/full-analysis` exactly, behind one
  `analyze()` client with a `USE_MOCK` flag. Flipping to the live Flask API must be a one-line
  change (no component edits). The live LLM pipeline is slow — the demo runs on mock.
- **Scope: happy-path.** Fully build **Upload** and **Results**. **Analyzing** is a short animated
  transition. **Documents** is a stub (3 placeholder cards). No Agent-04 doc generation, no auth,
  no file storage.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (managed), latest SDK, **TypeScript** |
| Navigation | **Expo Router** (file-based, `app/`) |
| Styling | **NativeWind v4** (Tailwind for RN); tokens in `tailwind.config.js` |
| Fonts | `@expo-google-fonts`: **Bai Jamjuree** (display), **Noto Sans Thai** (Thai), **IBM Plex Mono** (mono), **Inter** (body) |
| Images | `expo-image-picker` |
| State | **Zustand** (claims array + last result; survives navigation) |
| Icons | `lucide-react-native` |

Create the app in a **new folder** (e.g. `roomwitness-app/`) at the repo root — do **not** touch
`roomwitness-rag/` or `roomwitness-vlm/`.

## Backend contract (mock must mirror this exactly)

`POST /full-analysis` — multipart form. Request fields (copied from the working reference UI
`roomwitness-rag/portal/templates/index.html` lines 360-371):

- `claims` — JSON string of `[{ item, description, amount_thb }]`. **Required, ≥1** (backend
  returns HTTP 400 if empty — enforce this in the UI).
- Optional: `move_in_image`, `move_out_image` (one each), `screenshots` (multiple),
  `contract_clause`, `manual_landlord_promises`, `manual_tenant_promises`.

Response (`roomwitness-rag/portal/app.py:307`, documented in `RoomWitness/CLAUDE.md:61-93`):

```jsonc
{
  "claims": [
    {
      "claim": { "item": "...", "description": "...", "amount_thb": 5000 },
      "cv":    {
        "move_in_condition": "...", "move_out_condition": "...",
        "wear_and_tear": true, "likely_tenant_caused": false, "low_visibility": false,
        "supports_landlord_claim": "YES|NO|PARTIAL", "confidence": 0.0
      },
      "legal": {
        "classification": "LAWFUL|DISPUTED|UNLAWFUL", "confidence": 0.0,
        "dimensions": {
          "pre_existence": "...", "wear_and_tear": "...",
          "proportionality": "...", "contractual_clarity": "..."
        },
        "legal_basis": [
          { "section": "CCC §540", "source": "CCC|OCPB", "excerpt": "...", "favors": "TENANT|LANDLORD" }
        ],
        "summary_th": "คำอธิบายภาษาไทยหนึ่งบรรทัด"
      }
    }
  ],
  "cv_summary": {
    "total_claims": 3, "supported_claims": 1, "disputed_claims": 1,
    "partial_claims": 1, "total_disputed_amount": 8000
  },
  "evidence_summary": {
    "landlord_promises": ["..."], "tenant_promises": ["..."],
    "deposit_mentions": ["..."], "platforms": ["LINE"]
  },
  "images_used": { "move_in": "...", "move_out": "..." }
}
```

**Two verdicts per claim:** `cv.supports_landlord_claim` (photo evidence) **and**
`legal.classification` (law). Show both.

**The recoverable-฿ total is NOT computed by the backend.** Compute it client-side as the sum of
`amount_thb` for claims classified `UNLAWFUL` + `DISPUTED`, and label it an estimate
("ประมาณการ / estimate") — never present it as a backend figure.

## Design tokens → `tailwind.config.js`

```js
colors: {
  primary: '#0062FF', 'primary-soft': '#E6F0FF', 'primary-dark': '#0047B3',
  lawful: '#16A34A', 'lawful-soft': '#DCFCE7',
  disputed: '#D97706', 'disputed-soft': '#FEF3C7',
  unlawful: '#DC2626', 'unlawful-soft': '#FEE2E2',
  'surface-navy': '#0B1F3A',
},
borderRadius: { sm: '8px', md: '12px', lg: '16px' },
fontFamily: {
  display: ['BaiJamjuree_600SemiBold'], thai: ['NotoSansThai_400Regular'],
  mono: ['IBMPlexMono_500Medium'], body: ['Inter_400Regular'],
}
```

Classification → color: `LAWFUL`→green (`lawful`), `DISPUTED`→amber (`disputed`),
`UNLAWFUL`→red (`unlawful`). Use the `-soft` variant for badge/chip backgrounds.

## File structure to create

```
roomwitness-app/
  app/
    _layout.tsx        // load fonts, NativeWind, Stack
    index.tsx          // Upload (full build)
    analyzing.tsx      // animated transition (stub)
    results.tsx        // Results (full build)
    documents.tsx      // placeholder
  components/
    ClassificationBadge.tsx
    ClaimCard.tsx
    ImagePickerTile.tsx
    PrimaryButton.tsx
    NavHeader.tsx
  lib/
    api.ts             // analyze() + USE_MOCK + API_BASE
    fixtures.ts        // mock /full-analysis response (3 claims)
    store.ts           // Zustand: claims, result
    types.ts           // TS types for the contract above
  tailwind.config.js
```

## Build steps

1. **Scaffold** — `npx create-expo-app@latest roomwitness-app` (TypeScript + Expo Router).
   Install NativeWind v4 (follow its Expo setup: `babel.config.js`, `metro.config.js`,
   `global.css`), Zustand, `expo-image-picker`, `lucide-react-native`, the four Google font
   packages. Put tokens in `tailwind.config.js`. Load fonts in `app/_layout.tsx` with
   `useFonts`; render nothing until `fontsLoaded`.

2. **`lib/types.ts`** — type the contract above (`FullAnalysis`, `ClaimResult`, `CV`, `Legal`,
   `Dimensions`, `LegalBasis`, `EvidenceSummary`). No extra fields.

3. **`lib/fixtures.ts`** — one realistic `FullAnalysis` with 3 claims matching the design:
   - "สีผนัง / Wall paint" — `฿5,000` — `UNLAWFUL`, `cv: NO`
   - "รอยบนพื้น / Floor scratch" — `฿3,000` — `DISPUTED`, `cv: PARTIAL`
   - "ทำความสะอาด / Deep cleaning" — `฿2,000` — `LAWFUL`, `cv: YES`
   Include `summary_th`, ≥1 `legal_basis` cite each (CCC §540 / OCPB 2568), and a populated
   `evidence_summary` (LINE landlord promise, deposit mention).

4. **`lib/api.ts`**
   ```ts
   const USE_MOCK = true;
   const API_BASE = 'http://<LAN-IP>:5001';  // only used when USE_MOCK = false
   export async function analyze(form: AnalyzeForm): Promise<FullAnalysis> {
     if (USE_MOCK) { await new Promise(r => setTimeout(r, 2500)); return mockResult; }
     const fd = new FormData();
     fd.append('claims', JSON.stringify(form.claims));
     if (form.moveIn)  fd.append('move_in_image',  { uri: form.moveIn.uri,  name: 'move_in.jpg',  type: 'image/jpeg' } as any);
     if (form.moveOut) fd.append('move_out_image', { uri: form.moveOut.uri, name: 'move_out.jpg', type: 'image/jpeg' } as any);
     form.screenshots?.forEach((s, i) => fd.append('screenshots', { uri: s.uri, name: `ss_${i}.jpg`, type: 'image/jpeg' } as any));
     fd.append('contract_clause', form.contractClause ?? '');
     fd.append('manual_landlord_promises', form.landlordPromises ?? '');
     fd.append('manual_tenant_promises', form.tenantPromises ?? '');
     const r = await fetch(`${API_BASE}/full-analysis`, { method: 'POST', body: fd });
     const data = await r.json();
     if (!r.ok || data.error) throw new Error(data.error ?? r.statusText);
     return data;
   }
   ```

5. **`lib/store.ts`** — Zustand store: `claims: Claim[]`, `result: FullAnalysis | null`, setters.

6. **Components**
   - `ClassificationBadge` — props `{ classification }`; maps to color token + Thai/EN label.
   - `ClaimCard` — header (item name + `amount_thb` + `ClassificationBadge`), Thai summary box
     (`legal.summary_th`, navy/soft bg), citations row (`legal.legal_basis[].section` · `source`),
     a "Why" toggle revealing the **4 dimension chips** (`dimensions.pre_existence` …
     `contractual_clarity`) labeled `ก่อนเข้าอยู่ · Pre-existence`, `สึกหรอ · Wear & tear`,
     `สัดส่วน · Proportionality`, `สัญญา · Contract`, and a **CV verdict** line
     (`cv.supports_landlord_claim` → "ภาพถ่าย: …").
   - `ImagePickerTile` — wraps `expo-image-picker`, shows thumbnail when picked.
   - `PrimaryButton`, `NavHeader` (compact step text `ขั้นตอน N / 4 · <label>`).

7. **Screens**
   - **`index.tsx` Upload** — editable claims list (item / description / amount_thb rows, add &
     remove); **block submit when 0 claims** (mirrors the backend 400). Optional move-in/move-out
     `ImagePickerTile`s, optional screenshots, optional contract-clause / promises text inputs.
     "วิเคราะห์ / Analyze" → write claims to store → `router.push('/analyzing')`.
   - **`analyzing.tsx`** — animate the 4 pipeline steps (CV → evidence → legal → done); call
     `analyze(form)`; on success store result + `router.replace('/results')`; on error show a red
     banner + back. Bilingual loading copy.
   - **`results.tsx` Results** — verdict banner; recoverable-฿ **estimate** bar (client-computed,
     labeled); evidence callout pills from `evidence_summary`; one `ClaimCard` per
     `result.claims[]`. Link to `/documents`.
   - **`documents.tsx`** — 3 placeholder cards (OCPB complaint / deposit demand / evidence
     summary) + "เร็วๆ นี้ / coming soon".

## Bilingual rule

Thai is primary (top line), English secondary (smaller line under it). Hardcoded strings are
fine — no i18n framework. Keep all Thai copy and `summary_th` verbatim from the data.

## Verification (Definition of Done)

1. `npx expo start` → open in Expo Go → full path **Upload → Analyzing → Results → Documents**
   navigates on mock data with no red screens.
2. Upload **blocks submit with 0 claims**.
3. Results shows all 3 mock claims, **both verdicts** per card, the 4 dimension chips, Thai
   summary, citations, evidence pills, and the **labeled** client-computed ฿ estimate.
4. Fonts load — Thai renders in Noto Sans Thai (no tofu boxes); classification colors match tokens.
5. **Live flip:** set `USE_MOCK = false` and `API_BASE` to a reachable Flask (LAN IP or ngrok;
   start it with `cd roomwitness-rag && flask --app portal/app.py run --port 5001 --host 0.0.0.0`).
   One real `/full-analysis` round-trips and renders — **no code change beyond those two constants**.
   (Backend may need CORS enabled for device requests.)

## Reference files (read these, don't duplicate logic)

- `roomwitness-rag/portal/templates/index.html:360-371` — exact FormData field names + the
  `renderResults` shape to mirror.
- `roomwitness-rag/portal/app.py:208-320` — the `/full-analysis` route, required-claims 400,
  and response assembly.
- `RoomWitness/CLAUDE.md:28-93` — data contracts + the "฿ total is illustrative" warning.
- Pencil design `pencil_design/BDI-roomwitness.pen` — mobile frames Upload `vXfR4`, Results
  `AuMre` for spacing, hierarchy, and copy.
