# Schedool UX / Design System Audit

**Date:** March 5, 2026  
**Project:** Schedool (School Timetable Scheduling App)  
**Stakeholder Pages:** Landing, Auth (Login/Register), Admin Dashboard, Schedule (Editor), Teacher Schedule, Student Schedule

---

## Executive Summary

**Strengths:**
- Polished marketing landing page with clear value prop
- Solid structural design (role-based routing, shared headers, drag-and-drop)
- Modern tech stack (Next.js + Tailwind)

**Critical Issues:**
1. **Three icon libraries** (Font Awesome, Lucide, react-icons) — bloat + inconsistency
2. **Duplicate header** on admin schedule page
3. **Colors hardcoded** everywhere — dark mode is broken
4. **Blue vs Indigo accent confusion** — feels like two different products
5. **Mixed language** (Thai/English) — UX jarring for users
6. **Oversized modals for simple dropdowns** — poor interaction design
7. **No empty/loading states** — unpolished feel
8. **Overloaded schedule header** — cognitive overload
9. **Mobile unresponsive** — grid unusable on tablets
10. **Missing accessibility** — no keyboard support for drag-drop, focus management, etc.

---

## Detailed Findings

### 1. Icon Library Duplication

**Problem:**
- `package.json` ships:
  - `@fortawesome` (Font Awesome SVG)
  - `lucide-react` (Lucide icons)
  - `react-icons` (material + others)
- Each has different stroke weights, sizes, and design philosophy
- Creates visual inconsistency across the UI

**Evidence:**
- Landing page: Font Awesome icons (`faSchool`, `faRobot`, `faCalendarCheck`)
- Schedule/Auth pages: Lucide icons (`Mail`, `ArrowLeft`, `Eye`, `EyeOff`)
- Some dropdowns show mixed icon styles

**Impact:**
- **Bundle size:** ~80KB wasted (all three icon libs loaded)
- **Brand confusion:** Inconsistent visual language
- **Developer friction:** Which library to import for a new icon?

**Recommendation:**
- **Choose Lucide** (lightest, most modern, 1.5px stroke consistent with Tailwind)
- Remove `@fortawesome` and `react-icons` from `package.json`
- Migrate all icons to Lucide in a single pass

**Files to Update:**
- `package.json` (remove dependencies)
- `app/page.tsx` (landing page icons)
- All component files using FA or react-icons

---

### 2. Duplicate Header on Schedule Page

**Problem:**
- [app/(admin)/schedule/page.tsx](app/(admin)/schedule/page.tsx#L280-L307) renders `<AdminHeader />` at the top
- Then immediately below, inline JSX duplicates the header: logo, school name, Admin badge, avatar

**Code:**
```tsx
<AdminHeader />
<header className="bg-white border-b border-gray-200 px-6 py-3">
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-primary rounded-lg ...">...</div>
      <h1 className="text-xl font-bold text-gray-900">ScheDool</h1>
      ...
    </div>
  </div>
  ...
</header>
```

**Impact:**
- Wastes 80px of vertical space on the most data-dense page
- Confuses users: is this two different headers?
- Maintenance burden: changing header logic requires updates in two places

**Fix:**
Delete the inline `<header>` block. Use `<AdminHeader />` alone. Move filter controls to a secondary "toolbar" below the header if needed.

---

### 3. Colors Hardcoded — Dark Mode Broken

**Problem:**
- `app/globals.css` defines CSS variables for light/dark mode:
  ```css
  :root {
    --primary: #2563EB;
    --background: #f8f9fa;
    --foreground: #1a1a1a;
    --surface: #ffffff;
    --border: #e5e7eb;
  }
  
  @media (prefers-color-scheme: dark) {
    :root {
      --background: #0f172a;
      --foreground: #f1f5f9;
      --surface: #1e293b;
      --border: #334155;
    }
  }
  ```

- **But every component ignores these variables** and uses Tailwind utilities:
  ```tsx
  <div className="bg-gray-50 text-gray-900 border-gray-200">
    <input className="bg-white border-gray-300" />
  </div>
  ```

- Result: **Dark mode does nothing**. System preference for dark mode = unusable white backgrounds with black text on every page.

**Affected Files:**
- Nearly every component (`page.tsx`, `*.tsx` in `_components`, overlays)
- Tooltips: `globals.css` has a hardcoded tooltip style with `background-color: #ffffff`

**Fix:**
1. Map CSS variables to Tailwind config in `tailwind.config.ts`:
   ```js
   colors: {
     background: 'var(--color-background)',
     foreground: 'var(--color-foreground)',
     surface: 'var(--color-surface)',
     border: 'var(--color-border)',
     primary: 'var(--color-primary)',
   }
   ```
2. Replace all `bg-gray-50`, `bg-white`, `text-gray-900` with semantic names: `bg-background`, `bg-surface`, `text-foreground`
3. Replace `border-gray-200` with `border-border`

---

### 4. Accent Color Confusion: Blue vs Indigo

**Problem:**
Multiple accent colors are used inconsistently:

| Page/Component | Primary Accent | Issue |
|---|---|---|
| Landing page | `#2563EB` (blue-600) | Matches `--primary` ✓ |
| Admin dashboard | `bg-blue-600` | Matches primary ✓ |
| Admin schedule | `bg-primary` (blue) | Matches ✓ |
| Login page | `bg-indigo-600` | **MISMATCH** ✗ |
| Overlays (Inbox, SlotInfo) | `bg-indigo-600` | **MISMATCH** ✗ |
| FilterDropdown header | `bg-indigo-100` | **MISMATCH** ✗ |
| ViewModeToggle active | `text-indigo-600` | **MISMATCH** ✗ |

**Impact:**
- Users see admin pages in blue, then sign in with indigo = feels like different product
- No clear visual hierarchy between primary action and secondary actions
- Indigo (a purple-blue mix) clashes with the pure blue primary

**Fix:**
1. Commit to **blue-600** (`#2563EB`) as the single accent color
2. Use **blue-700** for hover/active states, **blue-100** for backgrounds
3. Update login (`bg-indigo-600` → `bg-primary`), overlays, dropdowns, toggles
4. Reserve a distinct *secondary accent* (e.g., orange or teal) only for **warnings** or **destructive actions**

**Files to Update:**
- `app/(auth)/login/components/box.tsx`
- `app/teacher/components/InboxOverlay.tsx`
- `app/teacher/components/TeacherSlotInfoOverlay.tsx`
- `app/(admin)/schedule/_components/FilterDropdown.tsx`
- `app/(admin)/schedule/_components/ViewModeToggle.tsx`

---

### 5. Mixed Language (Thai + English)

**Problem:**
Users encounter both Thai and English labels without clear i18n:

| Component | Language | Content |
|---|---|---|
| Login page | English | "Username", "Password", "Enter Platform" |
| Landing page | English | All copy |
| Admin dashboard | English | "Schedules", "Schedule Name" |
| ScheduleCard badges | Thai | "รอข้อมูล" (awaiting data), "กำลังสร้างตาราง" (generating) |
| CreateScheduleButton | Thai | "สร้างตารางสอนใหม่" |
| Teacher schedule header | English | "T. code", "T. name", "My Teaching Schedule" |
| Teacher/Student dashboards | English | All copy |

**Experience:**
User logs in (English) → sees dashboard (English) → clicks "Create Schedule" (Thai) → confused.

**Fix:**
1. **Pick one language** (Thai is good for Thailand-focused product)
2. OR implement **i18n** using `next-i18next` or similar:
   - All strings in a `/locales/en.json` and `/locales/th.json`
   - Switch via dropdown in header
   - URL prefix: `/en/dashboard`, `/th/dashboard`
3. At minimum: Add a language toggle in `AdminHeader` so teachers/students can switch

---

### 6. FilterDropdown: Oversized Modal for Simple Dropdown

**Problem:**
[FilterDropdown.tsx](app/(admin)/schedule/_components/FilterDropdown.tsx) opens a **full-screen centered modal** (560px fixed) for a simple "select from a list" action.

**Code:**
```tsx
<div className="fixed top-1/2 left-1/2 z-40 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl ...">
  <div className="bg-indigo-100 px-5 py-3 border-b border-gray-200">
    <h3 className="text-2xl font-semibold text-gray-900">Search : {searchTitle}</h3>
  </div>
  <div className="px-5 py-4 border-b border-gray-100">
    <p className="text-3xl leading-none mb-3 text-gray-900">Filter</p>
    ...
  </div>
```

**Issues:**
- Headline is `text-2xl` + `text-3xl` for a dropdown — architectural mismatch
- Full-screen backdrop + modal = heavy interaction for what should be a combobox
- Creates visual interruption when you just want to pick a teacher code
- Not responsive: 560px is too wide on mobile, but fixed anyway

**Fix:**
Convert to a **popover-based combobox**:
1. Trigger button stays inline in header
2. Dropdown anchors to button, opens downward or upward (detect viewport)
3. Size to ~300px width, max 6 visible items before scroll
4. Use same design as GitHub's code-search or Vercel's command palette
5. Keep the search + filter UI, but scale it down

**Library:** `@headlessui/react` (Popover + Combobox) or `radix-ui` (Popover)

---

### 7. No Loading or Empty States

**Problem:**
- Timetable grid: Before `useEffect` fires, no skeleton loader. Just blank grid.
- ScheduleList: No loading indicator while fetching schedules.
- No error boundaries for API failures.
- Preview feels unfinished.

**Example (Admin Schedule):**
```tsx
useEffect(() => {
  const days = ['Monday', 'Tuesday', ...];
  const slots = [1, 2, 3, ...];
  // Just generate dummy data directly — no loading state shown
  setScheduleData(newScheduleData);
}, []);
```

**Fix:**
1. Add **skeleton loaders**:
   - Timetable: Gray shimmer rows matching grid structure
   - ScheduleList: 3 skeleton cards fading in
2. Add **empty state illustration** for "No schedules" with a CTA to create one
3. Add **error toast** if API fails (use library like `sonner` or `react-toastify`)
4. Show "Loading..." spinner in overlay actions (Import, Export, Publish)

---

### 8. Overloaded Schedule Header

**Problem:**
The admin schedule page header crams ~20 UI controls into a single bar:

**Left column:**
- Back button + Title + Draft badge + Semester label

**Center column:**
- Import JSON, Export JSON, Save Draft, Publish, Delete, AI Shuffle buttons
- 3 FilterDropdowns (T. code, Class, Room) + text inputs (T. name, Default Room, Room name, Subject)

**Right column:**
- ViewModeToggle (4 buttons)

**Layout:** Grid that wraps awkwardly; uses `grid-cols-[auto_auto]` and `contents` trick — hard to maintain.

**Impact:**
- User sees 20+ clickable elements at once
- No visual hierarchy (everything is a button)
- Unclear which controls are critical vs. optional
- Mobile: completely unusable (wraps to many lines)

**Fix:**
**Restructure into 3 tiers:**

1. **Primary bar** (always visible, 100% width):
   ```
   [Back] [Title + Status] [→] [View Toggle] [Publish]
   ```

2. **Secondary bar** (Filters, collapsible/pinned):
   ```
   [T. Code ▼] [Class ▼] [Room ▼] [Reset]
   ```

3. **Actions menu** (in a "..." dropdown):
   ```
   • Import JSON
   • Export JSON
   • Save Draft
   • Delete
   • AI Shuffle (with icon)
   ```

**Design:**
- Use a `<Tabs>` or `<SegmentedControl>` for View Toggle (already done, but move to right end of primary bar)
- Publish button is prominent green (or primary color) with icon
- Filters use the modernized combobox (from #6 fix), not oversized modals

---

### 9. Mobile / Responsive Gaps

**Problem:**
- Timetable grid: `min-w-[80px]` × 12 slots = ~960px minimum. Non-responsive.
- FilterDropdown modal: Fixed 560px width.
- Admin header: No collapse logic. All controls visible and wrapping on mobile.
- Overlays: Fixed sizes, not mobile-first.

**Fix:**
1. **Timetable on mobile:** Switch to a **card-based layout**:
   - Show one day at a time (with prev/next day buttons)
   - Each period is a card with subject, teacher, room
   - Drag-and-drop → long-press actions (or a menu)

2. **Filters on mobile:** Collapse to a single `<Drawer>` panel (pull from bottom)

3. **Header on mobile:** Hamburger menu for secondary actions

4. **Test breakpoints:** Tailwind's `md:` (768px), `lg:` (1024px)

---

### 10. Accessibility Issues

#### 10.1 Drag-and-Drop
- **No keyboard support:** Can't reorder with arrow keys
- **No ARIA:** Missing `aria-grabbed`, `aria-dropeffect="move"`
- **No screen reader announcement** of what's being dragged

#### 10.2 Dropdowns & Modals
- No **Escape key** to close (only backdrop click)
- **Focus not trapped** in modal (user can tab behind it)
- **Focus not restored** after closing

#### 10.3 Color Contrast
- Muted text on light background: `text-gray-500` on `bg-gray-50` = **low contrast**
- Verify with WCAG AA (4.5:1 for body text, 3:1 for UI components)

#### 10.4 Buttons & Interactive Elements
- ViewModeToggle buttons lack `aria-pressed` to indicate active state
- Filter buttons should be `<button>`, not `<div>` (for keyboard navigation)

#### 10.5 Color Alone
- ScheduleCellDisplay uses only `bg-pink-100` vs `bg-green-50` to indicate variant
- Use **icon or text label** in addition (e.g., "⚠ Conflict" vs "✓ OK")

**Fix:**
- Add `aria-*` attributes to interactive elements
- Implement **focus visible styles** (e.g., `focus:ring-2 focus:ring-offset-2`)
- Use a11y libraries: `@headlessui/react`, `radix-ui`
- Test with screen readers (NVDA on Windows, VoiceOver on Mac)
- Run WAVE or Axe DevTools browser extension checks

---

## Proposed Design System

### Color Palette

**Light Mode:**
```
Primary:      #2563EB (blue-600)
Primary Hover: #1D4ED8 (blue-700)
Background:   #F8FAFC (slate-50)
Surface:      #FFFFFF
Foreground:   #0F172A (slate-900)
Muted:        #64748B (slate-500)
Border:       #E2E8F0 (slate-200)
Success:      #16A34A (green-600)
Warning:      #D97706 (amber-600)
Danger:       #DC2626 (red-600)
```

**Dark Mode:**
```
Primary:      #3B82F6 (blue-500)
Primary Hover: #2563EB (blue-600)
Background:   #0F172A (slate-950)
Surface:      #1E293B (slate-800)
Foreground:   #F1F5F9 (slate-100)
Muted:        #94A3B8 (slate-400)
Border:       #334155 (slate-700)
Success:      #22C55E (green-500)
Warning:      #F59E0B (amber-500)
Danger:       #EF4444 (red-500)
```

### Typography

**Font:** Inter (already loaded)

**Scale:**
- `text-xs` (12px): Labels, hints, metadata
- `text-sm` (14px): Body, button text, secondary info
- `text-base` (16px): Subheadings, form labels
- `text-lg` (18px): Section headings
- `text-xl` (20px): Page headings, modal titles
- `text-2xl` (24px): Large page titles only (e.g., landing hero)

**Rule:** Overlay / modal titles should be `text-lg` or `text-xl` **max**. Not `text-5xl`.

### Border Radius

- **Buttons, small cards:** `rounded-lg` (8px)
- **Cards, modals, popovers:** `rounded-xl` (12px)
- **Badge / pill:** `rounded-full`

**Remove:** `rounded-[2rem]`, `rounded-[2.5rem]` (on landing page) — standardize to above.

### Shadows

- **Subtle:** `shadow-sm` (used on cards)
- **Elevated:** `shadow-lg` (used on modals/overlays)
- **None:** Most elements have no shadow (keep it flat)

### Spacing

Use **4px base unit**:
- Padding/margin: `p-2`, `p-3`, `p-4`, `p-6`, `p-8` (8px, 12px, 16px, 24px, 32px)
- Gaps: `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`

**Remove:** `p-5`, `p-7`, `p-10`, `py-32`, `gap-x-8 gap-y-2` (inconsistent mixing)

### Components

| Component | Style | Height | Example |
|---|---|---|---|
| Button | Primary | 40px (h-10) | `bg-primary text-white rounded-lg` |
| Button | Secondary | 40px | `bg-surface border border-border rounded-lg` |
| Input | Text | 40px | `border border-border rounded-lg px-3 py-2` |
| Badge | Status | 24px | `bg-surface text-foreground text-xs rounded-full px-2` |
| Modal | — | — | `w-[480px] rounded-xl shadow-lg` |
| Popover | — | — | `w-[300px] rounded-xl shadow-lg` |

---

## Implementation Roadmap

### Phase 1: Foundation (1 day)
- [ ] Create `design-tokens.md` file
- [ ] Update `tailwind.config.ts` to map CSS variables
- [ ] Create a **Tailwind config export** for semantic color utilities

### Phase 2: Icon & Color Cleanup (1 day)
- [ ] Remove Font Awesome, react-icons from `package.json`
- [ ] Migrate all icons to Lucide
- [ ] Audit all color usages, fix blue-vs-indigo mismatch
- [ ] Replace hardcoded colors with semantic classNames

### Phase 3: Interaction Design (2 days)
- [ ] Convert FilterDropdown to popover + combobox
- [ ] Remove duplicate header from schedule page
- [ ] Add loading/empty states to timetable and lists
- [ ] Add focus management + keyboard support to modals

### Phase 4: Accessibility (1 day)
- [ ] Add ARIA attributes to drag-drop, buttons, radio groups
- [ ] Test with Axe DevTools / WAVE
- [ ] Ensure 4.5:1 contrast on body text
- [ ] Add keyboard-only user testing

### Phase 5: Mobile & Language (2 days)
- [ ] Implement mobile-first responsive for schedule grid
- [ ] Add i18n setup (or pick single language consistently)
- [ ] Test on tablet + mobile devices

---

## Quick Reference: Files to Prioritize

### High Impact (Do First)
1. **app/globals.css** — Add semantic color tokens
2. **tailwind.config.ts** — Map CSS variables
3. **app/(admin)/schedule/page.tsx** — Remove duplicate header (line 280–307)
4. **app/(admin)/schedule/_components/FilterDropdown.tsx** — Convert to popover
5. **app/(auth)/login/components/box.tsx** — Change indigo → primary

### Medium Impact
6. **app/(admin)/schedule/_components/ViewModeToggle.tsx** — Indigo → primary
7. **app/teacher/components/InboxOverlay.tsx** — Indigo → primary
8. **app/teacher/components/TeacherSlotInfoOverlay.tsx** — Indigo → primary
9. **app/page.tsx** — Migrate icons to Lucide
10. **All `_components/` files** — Replace hardcoded colors with semantic classNames

### Nice to Have (Follow-Up)
11. Add loading skeletons
12. Add i18n
13. Responsive mobile layout
14. Drag-drop accessibility

---

## Conclusion

Schedool has a strong foundation and polished landing page, but the **internal tool UX** is inconsistent and unfinished. Fixing the **design system** (colors, icons, tokens) and **interaction patterns** (modals, headers, loading states) will dramatically improve user trust and reduce development friction.

**Start with Phase 1 + Phase 2.** They're quick wins that unlock the rest.
