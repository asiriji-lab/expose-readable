# Schedool Frontend

Web interface for the Schedool GA scheduling system. Built with Next.js 16 App Router, Clerk authentication, and Supabase for schedule persistence.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) |
| Language | TypeScript 5 |
| Auth | Clerk (SSO + JWT) |
| Database | Supabase (schedule persistence) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Drag & Drop | dnd-kit |
| CSV parsing | PapaParse |
| Testing | Vitest + Testing Library |

---

## Project Structure

```
app/
├── (admin)/
│   ├── dashboard/          # Schedule list + per-schedule detail ([id])
│   └── schedule/           # Timetable viewer with drag-and-drop editor
├── (auth)/                 # Login, register, OTP, complete-profile flows
├── teacher/                # Teacher-facing timetable view
├── student/                # Student-facing timetable view
└── room/                   # Room-facing timetable view

lib/
├── api/                    # Backend API client (scheduleApi.ts, backend.ts)
├── hooks/                  # useJobStatus, useLatestSchedule
├── adapters/               # scheduleAdapter — transforms backend JSON to UI model
└── supabase.ts             # Supabase client

../appscript/               # Google Apps Script — sheet validation + slot picker UI (root level)
```

---

## Auth Flow

Two layers of auth run in parallel via `middleware.ts`:

1. **Clerk** — handles identity (login, OAuth, session)
2. **Backend JWT** (`auth-token` cookie) — issued by the scheduling backend after Clerk verification

All pages except `/`, `/login`, and `/after-sign-in` require both. `/complete-profile` requires Clerk only (used during initial registration before the backend token exists).

---

## Getting Started

### Prerequisites

- Node.js 20+
- Clerk account + application ([clerk.com](https://clerk.com))
- Supabase project ([supabase.com](https://supabase.com))
- Schedool backend running (see `../backend/HOW_TO_RUN.md`)

### Setup

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Clerk (baked into client bundle at build time)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/after-sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/after-sign-in

# Clerk (server-only, runtime)
CLERK_SECRET_KEY=sk_...

# Backend
BACKEND_URL=http://localhost:5000

# Supabase (public)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Supabase (server-only)
SUPABASE_SERVICE_ROLE_KEY=...

# Admin registration gate (baked into client bundle at build time)
NEXT_PUBLIC_ADMIN_REGISTRATION_KEY=...

# Google service account (server-only — never expose to client)
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_TEMPLATE_ID=...
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

### Run

```bash
npm run dev       # development server — http://localhost:3000
npm run build     # production build
npm run test      # unit tests (Vitest)
```

---

## Docker

```bash
# From project root — builds both frontend and backend
docker-compose up --build

# Frontend only
docker build \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_... \
  --build-arg NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login \
  --build-arg NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register \
  --build-arg NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/after-sign-in \
  --build-arg NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/after-sign-in \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --build-arg NEXT_PUBLIC_ADMIN_REGISTRATION_KEY=... \
  -t schedool-frontend ./frontend
```

> `NEXT_PUBLIC_*` variables are baked into the client bundle at build time and must be passed as `--build-arg`. Runtime-only variables (`CLERK_SECRET_KEY`, `BACKEND_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_*`) are injected via `docker-compose env_file` and do not need build args.

---

## Google Apps Script

The `appscript/` directory lives at the **project root** (not inside `frontend/`). It contains the Google Apps Script that runs inside the Google Sheets input template:

- **Slot picker UI** — sidebar dialog for selecting timeslots (generates `MON_2-5, WED_6-8` format)
- **Sheet validation** — mirrors frontend validation rules directly in the sheet

See `../appscript/README.md` for the 3-part deployment structure (Library, Template Sheet, Web App).

---

## Key Docs

- [`docs/coding_standard.md`](docs/coding_standard.md) — engineering standards (KISS, FSD architecture, TypeScript conventions)
- [`../backend/docs/INPUT_SPEC.md`](../backend/docs/INPUT_SPEC.md) — CSV input format specification
- [`../backend/docs/OUTPUT_FORMAT.md`](../backend/docs/OUTPUT_FORMAT.md) — schedule JSON output format (used by `lib/adapters/scheduleAdapter.ts`)
