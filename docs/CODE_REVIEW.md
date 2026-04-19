# 🚨 Schedool — Code Review (April 2026)

> **Rating: 5.5 / 10 — The bones are okay but the flesh is a disaster.**
>
> **Good:** `scheduleLogic.ts` is clean, immutable, and well-structured. The CSS design token system is solid.
> **Bad:** Security holes, dead code everywhere, a completely fake import system, two competing Supabase clients, a 73 KB dummy-data file, and a middleware that isn't even a middleware.

---

## 🔴 CRITICAL — Broken or Security-Breaking

### 1. `proxy.ts` IS NOT A MIDDLEWARE — Auth Bypass
**File:** `proxy.ts` (root)

Next.js middleware **must** be in a file named `middleware.ts`. Because the file is named `proxy.ts`, **none of the auth guards, CSRF protection, or role-based redirects ever execute**. Any user can navigate directly to `/dashboard`, `/admin/*`, `/teacher/*`, `/student/*` with zero authentication.

```
STATUS: Every protected route is publicly accessible.
```

**Fix:** Rename `proxy.ts` → `middleware.ts` and rename the export from `proxy` → `middleware`.

---

### 2. Two Supabase Clients Fighting Each Other
**Files:** `lib/supabase.ts` + `utils/supabase/server.ts`

| File | Client Type | Cookie/Session Aware | Used Where |
|------|------------|----------------------|------------|
| `lib/supabase.ts` | `createClient` (browser/anon) | ❌ No | Unknown — possibly nothing |
| `utils/supabase/server.ts` | `createServerClient` (SSR) | ✅ Yes | `_actions/auth.ts` |

Using `lib/supabase.ts` in an SSR Next.js 15 app will cause auth state desync between server and client. This looks like a tutorial leftover that was never cleaned up.

**Fix:** Delete `lib/supabase.ts`. Use `utils/supabase/server.ts` for all server-side clients.

---

### 3. Import API is a No-Op
**File:** `app/api/schedule/import/route.ts`

The route receives JSON, does a trivially shallow check, then bounces the data straight back to the client:
```ts
return NextResponse.json({ message: 'Import successful', data });
```
The caller (`page.tsx` line 98) then does `console.log('Import Successful:', result.data)` and throws it away. **The imported data is never loaded into schedule state.**

```
STATUS: Import button does nothing. It's a lie.
```

---

### 4. Export API Reads a Non-Existent Key
**File:** `app/api/schedule/export/route.ts`

The client sends `{ teachers, classes, rooms }` (the new `FullDataset` shape).  
The server reads `payload._rawState` — a key from a *previous version* of the app.  
`_rawState` is always `undefined`, so `rawState = payload._rawState || {}` = `{}`.  
The export loop iterates over nothing. The JSON file is always empty.

```
STATUS: Export feature produces a valid but empty JSON file every time.
```

---

## 🟠 MAJOR — Architectural Problems

### 5. 73 KB Dummy Data File with an Empty Lessons Array
**File:** `app/(admin)/schedule/_utils/dummyData.ts` (1,591 lines)

```ts
const LESSONS: RawLesson[] = []; // ← EMPTY
```

`generateFullScheduleDataset()` loops over `LESSONS` and produces an empty `FullDataset`. The timetable grid **always loads blank**. Meanwhile, 1,200+ lines of `TEACHER_WORKLOAD` data sit in the same file giving the palette sidebar content — so the sidebar shows unscheduled lessons but the grid is permanently empty.

The `_dataset` singleton at module level is also dangerous for serverless environments — can cause request-level state bleed.

---

### 6. `cloneEntityMap` Is a Shallow Clone
**File:** `scheduleLogic.ts`, lines 31–40

```ts
out[key][day] = { ...map[key][day] }; // shallow spread of slot record
```

Each slot value is a `ScheduleItem`. Currently fine because `ScheduleItem` only has primitive fields. But one nested object/array field on `ScheduleItem` and every mutation (`moveItem`, `removeItemFromDataset`) creates silent shared-reference bugs.

**Fix:** Document explicitly that `ScheduleItem` must remain flat, OR replace with `structuredClone`.

---

### 7. `DragPayload` Type Imported From `dummyData.ts`
**File:** `page.tsx` line 19

`DragPayload` is defined in `_types/schedule.types.ts` but re-exported from `dummyData.ts`. Types don't belong in data files. The page imports it from the wrong source.

---

### 8. Font Setup — Two Fonts, Wrong One Wins
**File:** `app/layout.tsx`

```ts
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' }); // applied to <html>
const inter = Inter({ subsets: ['latin'] });                           // applied to <body>
```

`<body>` overrides `<html>`. Inter wins. Geist is downloaded and never rendered. Additionally, `globals.css` line 119 sets `--font-sans: inherit`, overriding the variable Geist was mapped to.

**Fix:** Pick one font. Delete the other.

---

## 🟡 MODERATE — Code Quality

### 9. Hardcoded Values in Live UI

| Location | Hardcoded Value | Should Be |
|----------|----------------|-----------|
| `page.tsx:303` | `"Main Schedule 1/2025"` | From route param / schedule state |
| `page.tsx:304` | `"Draft"` (status badge) | From schedule state |
| `page.tsx:111` | `academic_year: '2026', semester: 1` | From schedule config |
| `export/route.ts:7-25` | All 12 time slot configs | From database / shared config |

---

### 10. `alert()` for Error Handling
**File:** `page.tsx` lines 99, 103, 133

`alert()` blocks the main thread and is visually inconsistent with the design system. The design tokens for toast notifications already exist (`--success`, `--danger`).

---

### 11. Commented-Out Code Committed
**File:** `app/page.tsx` lines 298–325

The entire old landing page is commented out and committed, including a color code note (`// color codes used: black 000000...`). Delete it — that's what git history is for.

---

### 12. `globals.css.bak` Committed to Repo
Delete it. Use `.gitignore`.

---

### 13. Inline `import()` Type Notation in `overlayUtils.ts`
**File:** `_utils/overlayUtils.ts` lines 18–19

```ts
a: import('../_types/schedule.types').ScheduleItem | undefined,
```

`ScheduleItem` is **already imported at the top of the file** (line 1). This inline import is redundant. Classic AI-generated code that doesn't track its own import list.

---

### 14. `DAYS` Constant Defined 3 Times
`overlayUtils.ts` line 3, `scheduleLogic.ts` lines 228 and 327. Same hardcoded array, three places.

---

### 15. `DevNavigator` Is Always Bundled
**File:** `app/_components/DevNavigator.tsx`

The `process.env.NODE_ENV !== 'development'` check is client-side — the component is always imported, always parsed, always server-rendered (returning null). In production it should not be imported at all.

---

### 16. Buttons with No `onClick`
- **"Save Draft"** (`page.tsx:354`) — no handler, purely decorative
- **"AI Shuffle"** (`page.tsx:359`) — no handler

---

### 17. `suppressHydrationWarning` Without Explanation
**File:** `app/layout.tsx:17`

Added with no comment explaining the root cause. This suppresses real bugs silently.

---

## 🔵 UNKNOWNS / SUSPICIOUS

| Item | Issue |
|------|-------|
| `next: "^16.1.0"` | Next.js 16 doesn't exist (as of knowledge cutoff). Likely a typo for `^15.1.0`. |
| `@fortune-sheet/react` | Chinese spreadsheet library in deps. Only CSS override remnants visible — possibly abandoned. |
| `xlsx` + `xlsx-js-style` | Both installed. One is a fork of the other. Probably only need one. |
| No error boundaries | Complex DnD page with no `<ErrorBoundary>`. One runtime error → white screen. |
| No database queries visible | "Save Draft" saves to nowhere. Zero schedule persistence. |
| `Untitled/` directory | Committed to repo. Contents unknown. |
| `.obsidian/`, `local_idea/`, `SAMPLE/`, `.agent/` | Non-code directories committed. Need `.gitignore` entries. |
| `PaletteSidebar.tsx` (20 KB) | Almost certainly doing too many things. Needs decomposition. |

---

## Summary Scorecard

| Area | Score | Verdict |
|------|-------|---------|
| Middleware / Auth | 0/10 | **Completely broken** |
| Import Feature | 0/10 | **Non-functional** |
| Export Feature | 1/10 | **Broken** (reads wrong key) |
| Schedule Grid Data | 2/10 | Always empty on load |
| TypeScript Quality | 6/10 | Types are good, some `any` leakage in export route |
| Code Hygiene | 3/10 | Dead code, `.bak` files, `Untitled/` dir |
| Component Architecture | 5/10 | OK structure, but `PaletteSidebar` is a monolith |
| CSS / Design System | 8/10 | Token system is genuinely clean |
| Security | 2/10 | Auth bypass, no input validation on import |
