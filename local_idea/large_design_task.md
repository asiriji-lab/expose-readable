# ScheDool Design System — Full Specification

> Direction: **"Structured Data Tool"** (Notion/Airtable-inspired)
> Tone: **Authoritative**, data-dense, professional
> Foundation: **shadcn/ui** + **Tailwind v4** + **Inter font**
> Migration: **Incremental** — component-by-component, starting from `/dashboard/[id]`

---

## 1. Core Principles

| Principle | Rule |
|-----------|------|
| **Authority** | Lucide icons only. No emoji in UI chrome. |
| **Density** | Compact spacing. Data should breathe, not float. |
| **Traffic light** | Status is always: green/yellow/red/blue/gray — bold and distinct. |
| **Consistency** | One component, one way. shadcn/ui as foundation. |
| **Dark mode** | Supported from day one via existing CSS variable system. |

---

## 2. Token System

### 2.1 Existing Tokens (keep as-is in `globals.css`)

```
Surfaces:    --background → --surface → --surface-alt  (3 tiers)
Text:        --foreground → --foreground-muted          (2 tiers)
Borders:     --border → --border-strong                 (2 tiers)
Primary:     --primary / --primary-hover / --primary-light / --primary-border / --primary-foreground
Status:      --success / --success-light / --success-border
             --warning / --warning-light / --warning-border
             --danger  / --danger-light  / --danger-border
Roles:       --role-admin / --role-teacher / --role-student (+ bg variants)
```

### 2.2 Tokens to Add

```css
/* Add to @theme inline block */
--color-info:              var(--info);
--color-info-light:        var(--info-light);
--color-success-border:    var(--success-border);
--color-warning-border:    var(--warning-border);
--color-danger-border:     var(--danger-border);

/* Add to :root */
--purple:              #7C3AED; /* violet-600 — for "completed" status */
--purple-light:        #F5F3FF; /* violet-50 */
--purple-border:       #DDD6FE; /* violet-200 */

/* Add to @theme inline */
--color-purple:        var(--purple);
--color-purple-light:  var(--purple-light);
--color-purple-border: var(--purple-border);

/* Dark mode overrides for purple */
@media (prefers-color-scheme: dark) {
  --purple:        #A78BFA; /* violet-400 */
  --purple-light:  #1e1035;
  --purple-border: #4C1D95;
}
```

### 2.3 The Rule

**NEVER use hardcoded Tailwind colors for semantic meaning.**

| Instead of | Use |
|---|---|
| `bg-green-100 text-green-700` | `bg-success-light text-success` |
| `bg-red-100 text-red-700` | `bg-danger-light text-danger` |
| `bg-yellow-100 text-yellow-700` | `bg-warning-light text-warning` |
| `bg-red-50 border-red-200` | `bg-danger-light border-danger-border` |
| `bg-purple-100 text-purple-700` | `bg-purple-light text-purple` |
| `text-red-400` (required asterisk) | `text-danger` |

---

## 3. Typography

### 3.1 Font: Inter

Install via `next/font/google` in `layout.tsx`:
```tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
// Apply: <body className={inter.className}>
```

### 3.2 Scale

| Role | Classes | Example |
|------|---------|---------|
| Page title | `text-2xl font-bold text-foreground` | "นำเข้าข้อมูลตารางสอน" |
| Section header | `text-xs font-semibold tracking-wide text-foreground-muted` | "PHASE 1 — ตรวจโครงสร้าง" |
| Card title | `text-sm font-semibold text-foreground` | "คาบ" |
| Label | `text-xs font-medium text-foreground-muted` | "ชื่อตาราง" |
| Body | `text-sm text-foreground` | Regular content |
| Caption | `text-xs text-foreground-muted` | "24 แถว" |
| Badge text | `text-xs font-medium` | "ผ่าน", "3 errors" |

### 3.3 Thai + English Section Headers

Thai has no uppercase, so the "structured" feel for section headers comes from:
- **English parts** uppercase: `PHASE 1`
- **Thai parts** normal case but styled with `text-xs font-semibold tracking-wide`
- Optional: a `border-l-2 border-primary pl-2` left accent for stronger hierarchy

Example rendering: `PHASE 1 — ตรวจโครงสร้าง`

---

## 4. Spacing Scale

**Lock to these values only:**

| Token | Value | Use |
|-------|-------|-----|
| `gap-1.5` | 6px | Inline icon + text |
| `gap-2` | 8px | Badge groups, compact lists |
| `gap-3` | 12px | Card grid gaps, form field rows |
| `gap-4` / `p-4` | 16px | Card internal padding |
| `gap-6` / `p-6` | 24px | Section spacing, panel padding |
| `space-y-6` | 24px | Page-level vertical rhythm |

---

## 5. Border Radius — Three Values Only

| Use | Value |
|-----|-------|
| Buttons, inputs, badges, small pills | `rounded-lg` (8px) |
| Cards, panels, modals | `rounded-xl` (12px) |
| Avatars, status dots | `rounded-full` |

---

## 6. Shadow / Elevation — Three Levels

| Level | Class | Use |
|-------|-------|-----|
| Flat | `shadow-none` | Default cards (rely on `border` instead) |
| Raised | `shadow-sm` | Hover states on interactive cards, dropdowns |
| Modal | `shadow-xl` | Slide-overs, overlays, popovers |

---

## 7. Icon System — Lucide Only

### 7.1 Migration Map

| Current Emoji | Lucide Replacement | Import |
|---|---|---|
| 📅 period | `Calendar` | `lucide-react` |
| 🏫 room | `Building2` | `lucide-react` |
| 👨‍🏫 teacher | `GraduationCap` | `lucide-react` |
| 👨‍🎓 student | `Users` | `lucide-react` |
| 📌 preplace | `Pin` | `lucide-react` |
| ⚜️ scout | `Shield` | `lucide-react` |
| 📚 elective | `BookOpen` | `lucide-react` |
| 📖 curriculum | `FileText` | `lucide-react` |
| ✅ passed | `CheckCircle` | `lucide-react` |
| ❌ error | `XCircle` | `lucide-react` |
| ⚠️ warning | `AlertTriangle` | `lucide-react` |
| ⏳ pending | `Clock` | `lucide-react` |
| 🔄 loading | `Loader2` + `animate-spin` | `lucide-react` |
| 🔒 locked | `Lock` | `lucide-react` |
| ❓ missing | `HelpCircle` | `lucide-react` |
| 📋 info card | `ClipboardList` | `lucide-react` |
| 💡 suggestion | `Lightbulb` | `lucide-react` |
| 🔗 link | `ExternalLink` | `lucide-react` |
| 🚀 submit | `Send` | `lucide-react` |

### 7.2 Size Standards

| Context | Size prop | Example |
|---------|-----------|---------|
| Inline with text (badges, labels) | `size={14}` | Badge icons |
| Card/section icons | `size={18}` | TabCard icon |
| Empty states, hero | `size={24}` | EmptyState center icon |
| Header/nav | `size={20}` | AdminHeader logo area |

### 7.3 Rule

- **No inline `<svg>` tags.** Always import from `lucide-react`.
- **No emoji in component JSX.** Emoji are only acceptable in user-generated content.

---

## 8. Component Library

### 8.1 Installation

```bash
npx shadcn@latest init
# When prompted:
#   Style: Default
#   Base color: Slate
#   CSS variables: Yes
```

Then install individual components as needed:
```bash
npx shadcn@latest add button badge card input select sheet separator
```

### 8.2 Customization Plan

After installing shadcn defaults, override to match our token system:

#### Button Variants

| Variant | Classes |
|---------|---------|
| `default` (primary) | `bg-primary hover:bg-primary-hover text-primary-foreground` |
| `secondary` | `bg-surface-alt hover:bg-border text-foreground border border-border` |
| `ghost` | `hover:bg-surface-alt text-foreground-muted hover:text-foreground` |
| `success` | `bg-success hover:bg-success/90 text-white` |
| `danger` | `bg-danger hover:bg-danger/90 text-white` |
| `outline` | `border border-border hover:bg-surface-alt text-foreground` |

Standard sizes:
- `sm`: `h-8 px-3 text-xs`
- `default`: `h-9 px-4 text-sm`
- `lg`: `h-11 px-6 text-sm font-semibold`
- `full`: `w-full py-3 text-sm font-semibold` (for full-width CTAs like validate button)

#### Badge Variants

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| `success` | `bg-success-light` | `text-success` | `border-success-border` |
| `warning` | `bg-warning-light` | `text-warning` | `border-warning-border` |
| `danger` | `bg-danger-light` | `text-danger` | `border-danger-border` |
| `info` | `bg-primary-light` | `text-primary` | `border-primary-border` |
| `purple` | `bg-purple-light` | `text-purple` | `border-purple-border` |
| `neutral` | `bg-surface-alt` | `text-foreground-muted` | `border-border` |

All badges: `text-xs font-medium px-2.5 py-0.5 rounded-lg border inline-flex items-center gap-1.5`

#### Card

- Default: `bg-surface border border-border rounded-xl`
- With header: header gets `px-4 py-3 border-b border-border` + `bg-surface-alt` optional
- Padding: `p-4` body

#### Input / Select

- Base: `w-full px-3 py-2 text-sm rounded-lg border border-border-strong bg-surface`
- Focus: `focus:border-primary focus:ring-2 focus:ring-primary-light outline-none`
- Label above: `text-xs font-medium text-foreground-muted mb-1`

#### Sheet (for ErrorPanel slide-over)

Use shadcn `Sheet` component with `side="right"`:
- Width: `max-w-2xl w-full`
- Header: sticky, with border-b
- Footer: sticky, with border-t
- Body: `overflow-y-auto flex-1`

### 8.3 Custom Components to Build (not in shadcn)

| Component | Location | Purpose |
|-----------|----------|---------|
| `StatusBadge` | `components/ui/status-badge.tsx` | Badge + Lucide icon for validation/generation states |
| `SectionHeader` | `components/ui/section-header.tsx` | `PHASE 1 — ตรวจโครงสร้าง` with optional counter pill |
| `PageShell` | `components/layout/page-shell.tsx` | `min-h-screen bg-background` + `max-w-5xl mx-auto px-4 py-8 space-y-6` |
| `PageHeader` | `components/layout/page-header.tsx` | Title + description + optional breadcrumb |
| `EmptyState` | `components/ui/empty-state.tsx` | Icon circle + title + description + optional CTA |
| `StatSummary` | `components/ui/stat-summary.tsx` | The "24 แถว · 0 ข้อผิดพลาด · 3 คำเตือน" inline pattern |

---

## 9. Migration Plan — `/dashboard/[id]` First

### Step 1: Foundation Setup
1. Install shadcn/ui (`npx shadcn@latest init`)
2. Install Inter font via `next/font/google`
3. Add missing tokens to `globals.css`
4. Install shadcn components: `button`, `badge`, `card`, `input`, `select`, `sheet`, `separator`

### Step 2: Build Custom Components
1. `StatusBadge` — maps status → lucide icon + badge variant
2. `SectionHeader` — replaces inline phase headers
3. `PageShell` + `PageHeader` — replaces inline layout wrappers

### Step 3: Migrate `/dashboard/[id]` Components (one at a time)

#### 3a. `SessionInfoCard.tsx`
- Wrap in shadcn `Card`
- Replace inline `<input>` and `<select>` with shadcn `Input` / `Select`
- Replace 📋 emoji with `ClipboardList` icon
- Replace `text-red-400` required asterisk with `text-danger`

#### 3b. `TabCard.tsx`
- Replace emoji icon map with Lucide icon map
- Replace hardcoded color classes with `StatusBadge` component
- Use `Card` as wrapper with status-colored `border-l-4` instead of full background color
  (more "structured tool" — color accent on left edge, not entire card)

#### 3c. `ValidationSection.tsx`
- Use `SectionHeader` for phase headers
- Replace `bg-green-100 text-green-700` pills with `Badge variant="success"`
- Replace inline validate button with `Button variant="default" size="full"`
- Replace summary bar with `StatSummary` component
- Replace submit button with `Button variant="success"`

#### 3d. `ErrorPanel.tsx`
- Replace with shadcn `Sheet` (side="right")
- Error/warning items use `Badge` + structured card layout
- Replace emoji in footer with Lucide icons

#### 3e. `GenerationStatus.tsx`
- Replace emoji (✅❌🔄) with Lucide icons
- Use `Card` wrapper with status-colored border
- Progress bar stays custom (or use shadcn `Progress` if installed)

#### 3f. `page.tsx` (the page itself)
- Wrap in `PageShell`
- Use `PageHeader` for title + description
- Breadcrumb becomes its own small component

### Step 4: Migrate `/dashboard` List Page
- `ScheduleCard.tsx` — status badges use `StatusBadge`
- `EmptyScheduleState.tsx` — use `EmptyState` component
- Table itself can stay custom or migrate to `DataTable` later

### Step 5: Propagate to Other Views
- Teacher schedule page
- Student schedule page
- Room schedule page
- Admin schedule editor (most complex — do last)

---

## 10. Audit: Known Bugs to Fix During Migration

1. **`FilterChip.tsx` line ~183**: `hover:${c.activeBg}` — dynamic Tailwind class won't compile. Must use complete class strings or `style` prop.
2. **`AdminHeader.tsx`**: Uses `bg-[var(--role-admin-bg)]` bracket syntax — works but should be registered as proper Tailwind tokens.
3. **Color inconsistency**: 30+ instances of hardcoded `bg-green-*`, `bg-red-*`, `bg-yellow-*` that should use semantic tokens.

---

## 11. Visual Reference: TabCard Before vs After

### Before (current)
```
┌──────────────────────┐
│ 📅                   │  ← emoji icon
│ คาบ                  │
│ period               │
│ 24 แถว               │
│ [✅ ผ่าน]            │  ← hardcoded bg-green-100
└──────────────────────┘
   Full green background
   border-green-300
```

### After (design system)
```
┌───┬──────────────────┐
│ G │ ⊙ คาบ            │  ← Lucide Calendar icon (size 18)
│ R │   period          │
│ E │   24 แถว          │
│ E │                   │
│ N │  [✓ ผ่าน]        │  ← StatusBadge variant="success"
│   │                   │     bg-success-light text-success
└───┴──────────────────┘
   ↑ border-l-4 border-success
   White card background
   Subtle, structured
```

---

## 12. File Structure After Setup

```
components/
  ui/
    button.tsx          ← shadcn (customized variants)
    badge.tsx           ← shadcn (customized variants)
    card.tsx            ← shadcn
    input.tsx           ← shadcn
    select.tsx          ← shadcn
    sheet.tsx           ← shadcn
    separator.tsx       ← shadcn
    status-badge.tsx    ← custom: icon + badge combo
    section-header.tsx  ← custom: "PHASE 1 — ตรวจโครงสร้าง"
    empty-state.tsx     ← custom: icon circle + title + CTA
    stat-summary.tsx    ← custom: "24 แถว · 0 errors · 3 warnings"
  layout/
    page-shell.tsx      ← custom: page wrapper
    page-header.tsx     ← custom: title + desc + breadcrumb
```
