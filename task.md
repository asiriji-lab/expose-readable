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
