# Schedool Remediation Execution Tracker

## Phase 0 — Hygiene
- [x] 0.1 Delete `app/globals.css.bak`
- [x] 0.2 Update `.gitignore` with junk directories
- [x] 0.3 Delete `app/_components/DevNavigator.tsx`
- [x] 0.4 Fix font conflict in `layout.tsx` (Use Geist, remove Inter)
- [ ] 0.5 Extract Contracts & Remove Old Landing Page Code
- [ ] 0.6 Remove dead action buttons

## Phase 1 — Security
- [x] 1.1 Check security middleware
    - *Status*: Next.js 16 deprecated `middleware.ts` for `proxy.ts`. We have reverted back to `proxy.ts` which natively runs our auth guard!

## Phase 2 — Backend Integration
- [x] 2.1 Create API client layer (`api.ts`, `scheduleApi.ts`)
- [x] 2.2 Build backend → FullDataset adapter (`scheduleAdapter.ts`)
- [x] 2.3 Create polling hook (`useJobStatus.ts`)
- [x] 2.4 Build CSV Upload Modal
- [x] 2.5 Wire Upload Modal & result handler to `page.tsx`
- [x] 2.6 Refactor Export & Save features

## Phase 3 — Architecture Cleanup
- [x] 3.1 Fix `DragPayload` import source
- [x] 3.2 Use `structuredClone` in `cloneEntityMap`
- [x] 3.3 Add `<ErrorBoundary>` to schedule page
- [x] 3.4 Decompose `PaletteSidebar.tsx`

## Phase 4 — Bug Fixes & Missing Features (from doc audit)

### Bugs
- [ ] 4.1 `roomName` always shows room ID — `lib/adapters/scheduleAdapter.ts`
  Build a `roomNameMap` from `sched.rooms` before the teacher loop and use it in `cellToItem`.
- [ ] 4.2 `unfilledPalette` never displayed — `schedule/page.tsx` + `PaletteSidebar`
  Pass `unfilledSlots` prop to `PaletteSidebar` and render a warning section for lessons that failed to schedule.

### Missing features (API already supports these)
- [ ] 4.3 No "Download ZIP" button — `GenerationStatus.tsx`
  Add a download button on the completed card hitting `GET /schedule/:jobId/download`.
- [ ] 4.4 No feasibility / GA result summary — `GenerationStatus.tsx`
  Show `result.feasibility.is_feasible`, `ga_result.solution_found`, and `ga_result.final_fitness` after job completes.
- [ ] 4.5 `ga_params` not exposed — `UploadModal.tsx`
  Add optional advanced settings (max_generations, mutation_rate, etc.) to the upload form.

### Minor gaps
- [ ] 4.6 `academic_year` + `semester` not sent on job submit
  Wire up from `SessionInfoCard` data on the dashboard page.

---

## Phase 5 — Production Architecture (Schedule Persistence)

> Root cause: no Supabase `schedules` table exists. Schedule data is ephemeral —
> refresh on /schedule = lost data. job_id expires on backend in 7 days.
> 
> Fix: introduce a `schedules` table as the permanent identity for every session.
> All pages route by Supabase schedule ID, not backend job_id.

### 5.1 — Supabase: Create `schedules` table
```sql
CREATE TABLE schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  semester      INT  NOT NULL,
  academic_year INT  NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  -- 'draft' | 'generating' | 'completed' | 'published'
  job_id        TEXT,
  result_json   JSONB,
  unfilled_json JSONB,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
-- RLS: admin sees all rows for their org, students/teachers see only published
```
- [ ] Run migration in Supabase dashboard

### 5.2 — Supabase DB API layer: `lib/api/schedulesDb.ts`
Functions needed:
- `createSchedule(name, semester, year)` → `{ id }`
- `getSchedule(id)` → schedule row
- `listSchedules()` → all rows for current user's org
- `updateScheduleJob(id, jobId)` → status: generating
- `saveScheduleResult(id, resultJson, unfilledJson)` → status: completed
- `publishSchedule(id)` → status: published
- [ ] Implement all 6 functions

### 5.3 — Redesign `/dashboard/new`
Currently: hardcoded Link to `/dashboard/new`, renders full CSV page with id="new"
Target: small modal/form — name + semester + year → `createSchedule()` → redirect to `/dashboard/[uuid]`
- [ ] Convert `CreateScheduleButton` to open an inline form modal
- [ ] On submit: call `createSchedule()`, redirect to `/dashboard/[newId]`

### 5.4 — Fix `/dashboard/[id]/page.tsx` — wire sessionInfo + save to Supabase
Current bugs on this page:
  a) `sessionInfo` (name, semester, year) collected but NEVER passed to `submitScheduleJob`
  b) On job complete: navigates to `/schedule?jobId=...` but never saves result to Supabase
  c) `id = "new"` string is meaningless — page should load real schedule row by UUID

Fixes:
- [ ] Load schedule metadata from Supabase by `id` on mount (name/semester/year pre-filled)
- [ ] Fix `handleSubmit`: add `job_name: sessionInfo.name`, `academic_year: sessionInfo.year`, `semester: sessionInfo.semester` to `submitScheduleJob` payload
- [ ] After submit: call `updateScheduleJob(id, res.job_id)` to save job_id to Supabase
- [ ] On job complete (in `GenerationStatus` or parent): call `getJobResult` → `adaptBackendSchedule` → `saveScheduleResult(id, dataset, unfilled)`
- [ ] Redirect to `/schedule/[id]` (Supabase id, not jobId)
- [ ] Add `academic_year` + `semester` params to `submitScheduleJob` in `lib/api/scheduleApi.ts`

### 5.5 — Rename `/schedule/page.tsx` → `/schedule/[scheduleId]/page.tsx`
Current problems:
  - URL is `/schedule` with no ID — not bookmarkable
  - On mount: reads `?jobId=` from URL, immediately wipes it, data lost on refresh
  - Falls back to dummy data if no jobId
  - Has UploadModal for re-running GA (noted, deleted below — see 5.8)

Target:
- [ ] Create `app/(admin)/schedule/[scheduleId]/page.tsx`
- [ ] On mount: `getSchedule(scheduleId)` from Supabase → load `result_json` as dataset
- [ ] Remove `?jobId` URL param approach entirely
- [ ] Remove dummy data fallback (show empty state instead)
- [ ] Keep all drag-drop / edit logic as-is
- [ ] Edits (drag-drop, EditOverlay save) → debounced PATCH `result_json` in Supabase
- [ ] Publish button → `publishSchedule(scheduleId)` → status: published

### 5.6 — Fix `/dashboard/page.tsx` ScheduleList
- [ ] Replace mock `mockSchedules` array with real `listSchedules()` Supabase call
- [ ] Each row links to `/dashboard/[id]` if status is draft/generating, `/schedule/[id]` if completed/published
- [ ] Show status badge (Draft / Generating / Completed / Published)

### 5.7 — `unfilledPalette` prop wiring (was 4.2, now integrated here)
- [ ] Pass `unfilledSlots={unfilledPalette}` to `PaletteSidebar` in `/schedule/[scheduleId]/page.tsx`
- [ ] `PaletteSidebar`: add warning section for unfilled lessons

### 5.8 — Delete UploadModal from schedule page (Re-run GA — deferred)
- [ ] Remove `<UploadModal>` and `isUploadModalOpen` state from schedule page
- [ ] Remove `Upload CSVs` from the `⋯` actions menu
- *Note*: Re-run GA ("teacher not satisfied with result") is a real future feature.
  Come back and implement as: button on `/schedule/[id]` → navigate back to
  `/dashboard/[id]` with a "re-run" flag that pre-fills the CSVs from the last job.

---

## Phase 6 — Teacher Viewer (post Phase 5)

- [ ] 6.1 Teacher viewer page (`/teacher/schedule`) — read-only timetable by teacher code
  Currently: page exists but likely loads dummy/no data
  Needs: query Supabase for published schedule → load result_json → filter by teacher

---

## Deferred / Future

- Re-run GA from schedule viewer (see 5.8 note)
- `ga_params` advanced settings in upload form (was 4.5)
- AI Shuffle button (UI exists, no backend)
- Google Sheets integration (SheetEmbed skeleton exists)
- Student flow is already done — verify it reads from published schedule correctly
