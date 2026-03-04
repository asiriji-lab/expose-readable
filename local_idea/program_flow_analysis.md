# Application Flow Map — ScheDool

## Tech Stack
- **Next.js 14+ (App Router)** with TypeScript
- **Supabase** for auth + database (profiles table with `role`, `username`, `email`)
- **Tailwind CSS** for styling

---

## 1. MIDDLEWARE LAYER (`proxy.ts` via `middleware.ts`)

Every request hits middleware, which:

1. Refreshes Supabase session cookies (CSRF-safe)
2. **Unauthenticated** user hitting `/dashboard`, `/admin/*`, `/teacher/*`, `/student/*` → redirect to `/login`
3. **Authenticated** user hitting `/login` (without `?switch=1`) → redirect by role:
   - `admin` → `/dashboard`
   - `teacher` → `/teacher/dashboard`
   - `student` → `/student/dashboard`

---

## 2. AUTH FLOW (3 pages)

| Route | Page | What it does |
|-------|------|-------------|
| `/` | `app/page.tsx` | Immediately `redirect('/register')` |
| `/register` | `app/(auth)/register/page.tsx` | Registration form → signs up via Supabase → sends OTP email |
| `/verify-otp` | `app/(auth)/verify-otp/page.tsx` | OTP verification form → calls `verifyOtpAction()` server action |
| `/login` | `app/(auth)/login/page.tsx` | Login via username or email + password |

**Server Actions:**
- `loginWithUsernameOrEmail()` — resolves username→email via admin client (bypasses RLS), then signs in. Returns `{ success, role }`
- `detectRoleAction()` — looks up role by username/email (used to pre-detect role for UI)
- `verifyOtpAction()` — verifies email OTP token
- `signOutAction()` — signs out, redirects to `/login`

**Supabase Clients:**
- `lib/supabase.ts` — browser client (anon key)
- `utils/supabase/server.ts` — `createClient()` (server, cookie-based) + `createAdminClient()` (service role, bypasses RLS)

---

## 3. ADMIN FLOW (3 pages — inside `(admin)` route group)

| Route | Page | What it does |
|-------|------|-------------|
| `/dashboard` | `app/(admin)/dashboard/page.tsx` | Schedule list with create button. Uses `AdminHeader` |
| `/input` | `app/(admin)/input/page.tsx` | **10-step wizard** to upload CSV data for schedule generation |
| `/schedule` | `app/(admin)/schedule/page.tsx` | Full timetable editor with drag-and-drop, filtering, view modes |

**Key Components:**
- `AdminHeader` — shared header showing user name, role badge, sign-out dropdown. Accepts `roleLabel` prop for teacher/student reuse
- `Stepper` / `ProgressBar` / `NavigationButtons` — multi-step wizard UI
- `TimetableGrid` — editable timetable with drag-drop cell swapping
- `FilterDropdown` — modal search with checkbox filters (Teacher/Class/Room)
- `ViewModeToggle` — switch between All/Teacher/Class/Room grid views
- `EditOverlay` / `TeachingSlotSidebar` — edit slot details + presets sidebar

**CSV Input Steps (10):**

1. Curriculum → 2. Teacher → 3. Elective → 4. Scout → 5. Period → 6. Student → 7. Room → 8. Constraint → 9. Related Files → 10. Generate

---

## 4. TEACHER FLOW (2 pages)

| Route | Page | What it does |
|-------|------|-------------|
| `/teacher/dashboard` | `app/teacher/dashboard/page.tsx` | Stats (24 periods, 6 classes, homeroom 6/15) + link to schedule |
| `/teacher/schedule` | `app/teacher/schedule/page.tsx` | **Read-only** timetable filtered to teacher code, with inbox + slot info overlay |

**Teacher Components:**
- `TeacherTimetableGrid` — read-only grid reusing `ScheduleCellDisplay`
- `InboxOverlay` — modal inbox table (sender, topic, timestamp)
- `TeacherSlotInfoOverlay` — read-only slot detail (subject, class, room)

---

## 5. STUDENT FLOW (2 pages)

| Route | Page | What it does |
|-------|------|-------------|
| `/student/dashboard` | `app/student/dashboard/page.tsx` | Stats (32 periods, class 6/15, room 5410) + link to schedule |
| `/student/schedule` | `app/student/schedule/page.tsx` | **Read-only** timetable filtered to class code, reuses teacher components |

---

## 6. DATA LAYER STATUS

| What | Status |
|------|--------|
| Auth (login/register/OTP) | **Real** — Supabase auth + profiles table |
| Role-based routing | **Real** — middleware + login action reads `profiles.role` |
| Admin schedule grid | **Dummy** — `generateScheduleItem()` + `Math.random()` |
| Teacher/Student schedule | **Dummy** — same random generation |
| CSV upload + validation | **Real** — file upload with regex validation per step |
| Schedule generation | **Not implemented** — Step 10 is placeholder |
| Inbox messages | **Hardcoded** — static array in page components |
| Dashboard stats | **Hardcoded** — static numbers (24, 32, 6/15, etc.) |

---

## Summary: What's Real vs What Needs Work

**Working end-to-end:**
- Registration → OTP → Login → role-based redirect
- Middleware auth guards
- CSV upload wizard (10 steps with validation)
- Admin timetable UI (drag-drop editing)
- Teacher/Student read-only timetable views

**Needs real backend:**
- All schedule data (currently random dummy data)
- Dashboard stats (hardcoded numbers)
- Inbox/notification system (hardcoded messages)
- Schedule generation from CSV input (Step 10)
- Connecting CSV uploaded data → schedule solver → timetable display
