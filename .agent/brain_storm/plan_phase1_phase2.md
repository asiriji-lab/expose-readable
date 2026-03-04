# Implementation Plan: Phase 1–2
## Design Tokens + Color Unification

**Goal:** Establish a single source of truth for all colors and icons so every page is visually consistent and dark mode works.  
**Estimated time:** 1–2 days  
**Files touched:** ~15 files  
**Breaking changes:** None — pure visual/style changes

---

## PHASE 1 — Design Tokens

### Step 1.1 — Rewrite `app/globals.css`

Add a full semantic token set. No new file needed — expand the existing `:root`.

**Target state:**
```css
@import "tailwindcss";

:root {
  /* === Brand === */
  --primary:            #2563EB;  /* blue-600 */
  --primary-hover:      #1D4ED8;  /* blue-700 */
  --primary-light:      #EFF6FF;  /* blue-50 — for hover bg, chips */
  --primary-border:     #BFDBFE;  /* blue-200 */
  --primary-foreground: #FFFFFF;

  /* === Surface === */
  --background:  #F8FAFC;  /* slate-50 */
  --surface:     #FFFFFF;
  --surface-alt: #F1F5F9;  /* slate-100 — secondary surface (table headers, etc.) */

  /* === Text === */
  --foreground:      #0F172A;  /* slate-900 */
  --foreground-muted:#64748B;  /* slate-500 */

  /* === Border === */
  --border:      #E2E8F0;  /* slate-200 */
  --border-strong:#CBD5E1; /* slate-300 */

  /* === Semantic === */
  --success:          #16A34A;  /* green-600 */
  --success-light:    #F0FDF4;  /* green-50 */
  --success-border:   #BBF7D0;  /* green-200 */
  --success-foreground:#FFFFFF;

  --warning:          #D97706;  /* amber-600 */
  --warning-light:    #FFFBEB;  /* amber-50 */
  --warning-border:   #FDE68A;  /* amber-200 */
  --warning-foreground:#FFFFFF;

  --danger:           #DC2626;  /* red-600 */
  --danger-light:     #FEF2F2;  /* red-50 */
  --danger-border:    #FECACA;  /* red-200 */
  --danger-foreground:#FFFFFF;

  --info:             #0891B2;  /* cyan-600 */
  --info-light:       #ECFEFF;  /* cyan-50 */

  /* === Role badges === */
  --role-admin:       #7C3AED;  /* violet-600 */
  --role-admin-bg:    #EDE9FE;  /* violet-100 */
  --role-teacher:     #059669;  /* emerald-600 */
  --role-teacher-bg:  #D1FAE5;  /* emerald-100 */
  --role-student:     #EA580C;  /* orange-600 */
  --role-student-bg:  #FFEDD5;  /* orange-100 */

  /* Tailwind v4 aliases */
  --color-background:        var(--background);
  --color-foreground:        var(--foreground);
  --color-foreground-muted:  var(--foreground-muted);
  --color-surface:           var(--surface);
  --color-surface-alt:       var(--surface-alt);
  --color-border:            var(--border);
  --color-border-strong:     var(--border-strong);
  --color-primary:           var(--primary);
  --color-primary-hover:     var(--primary-hover);
  --color-primary-light:     var(--primary-light);
  --color-primary-border:    var(--primary-border);
  --color-primary-foreground:var(--primary-foreground);

  --font-sans: inherit;
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary:            #3B82F6;  /* blue-500 */
    --primary-hover:      #2563EB;  /* blue-600 */
    --primary-light:      #1E3A5F;
    --primary-border:     #1D4ED8;

    --background:  #0F172A;
    --surface:     #1E293B;
    --surface-alt: #0F172A;

    --foreground:       #F1F5F9;
    --foreground-muted: #94A3B8;

    --border:       #334155;
    --border-strong:#475569;

    --success:          #22C55E;
    --success-light:    #052E16;
    --success-border:   #166534;

    --warning:          #F59E0B;
    --warning-light:    #1C1400;
    --warning-border:   #92400E;

    --danger:           #EF4444;
    --danger-light:     #1C0000;
    --danger-border:    #991B1B;

    --role-admin-bg:    #2E1065;
    --role-teacher-bg:  #022C22;
    --role-student-bg:  #431407;
  }
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: inherit;
}

/* === FortuneSheet Tooltip Overrides === */
.luckysheet-postil-show-main {
  word-break: break-word !important;
  white-space: normal !important;
  border-radius: 8px !important;
  padding: 12px !important;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06) !important;
  font-family: inherit !important;
  line-height: 1.5 !important;
  background-color: var(--surface) !important;
  color: var(--foreground) !important;
}

.luckysheet-postil-show {
  border-radius: 8px !important;
  border: 1px solid var(--border) !important;
  overflow: hidden !important;
}

/* === Animations === */
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.animate-slide-in-right {
  animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer { animation: shimmer 2s infinite; }
```

---

### Step 1.2 — Map Tokens into Tailwind Config

Tailwind v4 already reads CSS variables set in `:root` via `@import "tailwindcss"` **if** they follow the `--color-*` naming convention. So by using the `--color-*` aliases above, Tailwind utilities like `bg-background`, `text-foreground`, `border-border` are **automatically available** once the aliases are in place.

**Verify in `tailwind.config.ts` (or `postcss.config.mjs`):**
No changes needed for v4. The `--color-*` variables are picked up automatically.

> If you're on Tailwind v3, add to `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background:        'var(--background)',
        surface:           'var(--surface)',
        'surface-alt':     'var(--surface-alt)',
        foreground:        'var(--foreground)',
        'foreground-muted':'var(--foreground-muted)',
        border:            'var(--border)',
        'border-strong':   'var(--border-strong)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-hover)',
          light:   'var(--primary-light)',
          border:  'var(--primary-border)',
          fg:      'var(--primary-foreground)',
        },
        success: { DEFAULT: 'var(--success)', light: 'var(--success-light)', border: 'var(--success-border)' },
        warning: { DEFAULT: 'var(--warning)', light: 'var(--warning-light)', border: 'var(--warning-border)' },
        danger:  { DEFAULT: 'var(--danger)',  light: 'var(--danger-light)',  border: 'var(--danger-border)'  },
      },
    },
  },
} satisfies Config
```

---

## PHASE 2 — Color Unification + Icon Migration

### Step 2.1 — Identify & Fix the Indigo Leaks

These are every usage of `indigo` that must be changed to `primary` (blue):

| File | Occurrences | Change |
|------|-------------|--------|
| `app/(auth)/login/components/box.tsx` | `bg-indigo-600`, `focus:ring-indigo-500`, `hover:bg-indigo-700`, `border-indigo-500`, `bg-indigo-50`, `bg-indigo-600` | → `bg-primary`, `focus:ring-primary`, `hover:bg-primary-hover`, etc. |
| `app/teacher/components/InboxOverlay.tsx` | `bg-indigo-600` (header) | → `bg-primary` |
| `app/teacher/components/TeacherSlotInfoOverlay.tsx` | `bg-indigo-600` (header), `bg-indigo-600` (Select button), `hover:bg-indigo-700` | → `bg-primary`, `hover:bg-primary-hover` |
| `app/(admin)/schedule/_components/FilterDropdown.tsx` | `bg-indigo-100` (header), `bg-indigo-100` (filter tag), `hover:bg-indigo-200`, `border-indigo-200` | → `bg-primary-light`, `hover:bg-primary-light/80`, `border-primary-border` |
| `app/(admin)/schedule/_components/ViewModeToggle.tsx` | `text-indigo-600` (active mode) | → `text-primary` |

**Exact replacements:**

```
bg-indigo-600   → bg-primary
bg-indigo-700   → bg-primary  (hover handled by hover:bg-primary-hover)
hover:bg-indigo-700 → hover:bg-primary-hover (or just hover:opacity-90)
border-indigo-500   → border-primary
bg-indigo-50    → bg-primary-light
bg-indigo-100   → bg-primary-light
text-indigo-600 → text-primary
focus:ring-indigo-500 → focus:ring-primary
```

---

### Step 2.2 — Fix Hardcoded Colors in Core Components

Replace the most common offenders with semantic tokens:

**Pattern replacements (global search-replace):**

| From | To | Notes |
|------|----|-------|
| `bg-gray-50` | `bg-background` | Page backgrounds |
| `bg-white` | `bg-surface` | Cards, modals |
| `bg-gray-100` | `bg-surface-alt` | Table headers, input bg |
| `text-gray-900` | `text-foreground` | Body / heading text |
| `text-gray-500` | `text-foreground-muted` | Secondary labels |
| `text-gray-600` | `text-foreground-muted` | Secondary text |
| `border-gray-200` | `border-border` | General borders |
| `border-gray-300` | `border-border-strong` | Inputs, strong separators |
| `bg-gray-200` | `bg-surface-alt` | Avatar bg, placeholder bg |
| `bg-gray-300` | `bg-border` | Dividers |
| `hover:bg-gray-50` | `hover:bg-surface-alt` | Hover states |
| `hover:bg-gray-100` | `hover:bg-surface-alt` | Hover states |
| `focus:ring-blue-500` | `focus:ring-primary` | Focus rings |
| `text-blue-600` | `text-primary` | Links, accents |
| `bg-blue-600` | `bg-primary` | Buttons (when not using `bg-primary` already) |
| `bg-blue-100` | `bg-primary-light` | Light chip bg |
| `text-blue-700` | `text-primary` | Light chip text |
| `border-blue-200` | `border-primary-border` | Light chip border |
| `hover:bg-blue-100` | `hover:bg-primary-light` | Hover on chips |
| `hover:bg-blue-700` | `hover:bg-primary-hover` | Button hover |

**Scope:** Apply across all files in `app/**/*.tsx`.

> ⚠️ Be careful with these classes on the **landing page** (`app/page.tsx`) — it uses bespoke Bento card backgrounds (`bg-gray-900`, `bg-blue-50`) intentionally as decorative elements. Don't replace those.

**Do NOT replace in:**
- `app/page.tsx` (landing) — decorative backgrounds are intentional
- `globals.css` Tailwind imports
- Any utility class that's doing a one-off decoration

---

### Step 2.3 — Fix Role Badge Colors

`AdminHeader.tsx` currently uses:
```tsx
normalizedRole === 'student'  ? 'bg-orange-100 text-orange-700'
normalizedRole === 'admin'    ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'   // teacher
```

Update to use role tokens:
```tsx
normalizedRole === 'student'  ? 'bg-[var(--role-student-bg)] text-[var(--role-student)]'
normalizedRole === 'admin'    ? 'bg-[var(--role-admin-bg)] text-[var(--role-admin)]'
                              : 'bg-[var(--role-teacher-bg)] text-[var(--role-teacher)]'
```

This preserves the same visual appearance in light mode but now works correctly in dark mode.

---

### Step 2.4 — Remove Duplicate Header from Schedule Page

In `app/(admin)/schedule/page.tsx`, the inline header block (around line 280–307) is a duplicate of `<AdminHeader />` which renders above it.

**Delete this block:**
```tsx
<div className="flex items-center justify-between mb-3">
  {/* Left: Logo and School Name */}
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
      ...ScheDool logo SVG...
    </div>
    <h1 className="text-xl font-bold text-gray-900">ScheDool</h1>
    <span className="text-gray-400">Bodindecha School</span>
  </div>
  {/* Right: Admin Badge and User Icon */}
  <div className="flex items-center gap-3">
    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-sm font-medium">Admin</span>
    <div className="w-9 h-9 bg-gray-300 rounded-full ...">...</div>
  </div>
</div>
```

**Keep:** Everything inside `<header>` from the filter grid downwards.

---

### Step 2.5 — Icon Library Migration (Lucide only)

**a) Update `package.json`:**
```json
// REMOVE:
"@fortawesome/fontawesome-svg-core": "...",
"@fortawesome/free-solid-svg-icons": "...",
"@fortawesome/react-fontawesome": "...",
"react-icons": "...",

// KEEP:
"lucide-react": "^0.563.0"
```

**b) Run:**
```bash
npm uninstall @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome react-icons
```

**c) Migrate `app/page.tsx` icons:**

| Font Awesome | Lucide Replacement |
|---|---|
| `faSchool` | `School` |
| `faRobot` | `Bot` |
| `faCalendarCheck` | `CalendarCheck` |
| `faArrowRight` | `ArrowRight` |
| `faCheckCircle` | `CheckCircle` |
| `faBolt` | `Zap` |
| `faUsers` | `Users` |
| `faChartPie` | `PieChart` |
| `faQuoteLeft` | `Quote` |
| `faChevronDown` | `ChevronDown` |
| `faStar` | `Star` |
| `faPlus` (CreateScheduleButton) | `Plus` |

**d) Updated import pattern:**
```tsx
// Before
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCheckCircle } from '@fortawesome/free-solid-svg-icons'
<FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />

// After
import { ArrowRight, CheckCircle } from 'lucide-react'
<ArrowRight className="w-4 h-4" />
```

---

## Execution Order

```
1. [ ] globals.css       — Apply new token set
2. [ ] tailwind.config   — Confirm v4 auto-map (or add v3 config)
3. [ ] Test dark mode    — Toggle system preference, check page looks correct
4. [ ] schedule/page.tsx — Delete duplicate header block
5. [ ] box.tsx (login)   — Indigo → primary
6. [ ] Overlays          — InboxOverlay + TeacherSlotInfoOverlay: indigo → primary
7. [ ] FilterDropdown    — Indigo → primary-light
8. [ ] ViewModeToggle    — text-indigo-600 → text-primary
9. [ ] AdminHeader       — Role badge → role tokens
10.[ ] All components    — bg-white → bg-surface, text-gray-900 → text-foreground, etc.
11.[ ] page.tsx          — Migrate FA icons to Lucide
12.[ ] CreateScheduleButton — fa-plus → Plus (Lucide)
13.[ ] npm uninstall     — Remove FA + react-icons
14.[ ] Build check       — npm run build (no TS errors, no missing icon imports)
```

---

## QA Checklist (after changes)

- [ ] Light mode: landing, login, dashboard, schedule, teacher, student pages
- [ ] Dark mode: toggle OS to dark, same pages
- [ ] Role badges: Admin (violet), Teacher (green), Student (orange) — correct in both modes
- [ ] Primary buttons (blue-600) — hover works, focus ring visible
- [ ] No console errors about missing icons
- [ ] `npm run build` completes with 0 errors
- [ ] `npm run lint` completes with 0 errors
- [ ] Timetable cells: pink/green variant backgrounds still visible
- [ ] Inbox/Edit/SlotInfo overlays: header now blue (not indigo)

---

## Non-Goals for Phase 1–2

The following are **out of scope** and tracked in future phases:
- Converting FilterDropdown to a popover (Phase 3)
- Responsive/mobile layout (Phase 5)
- i18n / language selection (Phase 5)
- Loading skeletons (Phase 3)
- Accessibility (ARIA, keyboard) (Phase 4)
