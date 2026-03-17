# Schedule Output Page — Complete Design Specification

> **Purpose:** This is the single source of truth for the Schedule Editor output page (`/schedule`). It covers everything from the 10,000ft layout to the pixel-level cell rendering logic.

---

## Table of Contents

1. [Page Architecture](#1-page-architecture)
2. [Tier 1 — Primary Bar](#2-tier-1--primary-bar)
3. [Tier 2 — Filter Bar](#3-tier-2--filter-bar)
4. [View Modes](#4-view-modes)
5. [The Timetable Grid](#5-the-timetable-grid)
6. [The Cell (UnifiedScheduleCell)](#6-the-cell-unifiedschedulecell)
7. [Cell Row Mapping by View Mode](#7-cell-row-mapping-by-view-mode)
8. [Conflict Logic (View All)](#8-conflict-logic-view-all)
9. [Summary Row](#9-summary-row)
10. [Teaching Slot Sidebar](#10-teaching-slot-sidebar)
11. [Drag-and-Drop System](#11-drag-and-drop-system)
12. [Edit Overlay (Individual Views)](#12-edit-overlay-individual-views)
13. [Overlay Inspect Popover (View All)](#13-overlay-inspect-popover-view-all)
14. [Design Tokens & Typography](#14-design-tokens--typography)
15. [Recommended Improvements](#15-recommended-improvements)

---

## 1. Page Architecture

The page is a **full-viewport, non-scrollable shell**. The grid scrolls internally.

```
┌──────────────────────────────────────────────┐
│  AdminHeader (64px, sticky)                  │
├──────────────────────────────────────────────┤
│  Tier 1: Primary Bar (≈56px)                 │
├──────────────────────────────────────────────┤
│  Tier 2: Filter Bar (≈44–88px, view-dependent)│
├──────────────────────┬───────────────────────┤
│                      │  Teaching Slot         │
│  Timetable Grid      │  Sidebar (190px)       │
│  (flex-1, scroll)    │  View All only         │
│                      │                        │
├──────────────────────┴───────────────────────┤
│  (EditOverlay / OverlayInspectPopover)       │
└──────────────────────────────────────────────┘
```

**Key layout rules:**
- `flex flex-col h-screen` on the root container
- Grid area: `flex-1 overflow-auto p-4`
- Grid + Sidebar: `flex gap-4 h-full`
- Grid: `flex-1 min-w-0` (prevents horizontal overflow)
- Sidebar: `w-[190px] flex-shrink-0` (only in View All mode)

---

## 2. Tier 1 — Primary Bar

A horizontal bar below AdminHeader. Background: `bg-surface`, bottom border.

### Left Group
| Element | Style | Content |
|---------|-------|---------|
| Back button | `text-foreground-muted`, ChevronLeft icon + "Back" text | `router.back()` |
| Divider | `h-5 w-px bg-border` | — |
| Title | `text-sm font-bold text-foreground` | "Main Schedule 1/2025" |
| Status badge | `bg-yellow-100 text-yellow-700 rounded text-xs font-semibold` | "Draft" |
| Semester | `text-xs text-foreground-muted` | "Semester 1/2025" |

### Right Group
| Element | Style | Action |
|---------|-------|--------|
| ViewModeToggle | Segmented control (All / Teacher / Class / Room) | Sets `viewMode` state |
| Divider | `h-5 w-px bg-border` | — |
| Publish button | `bg-green-600 text-white rounded-lg text-sm` + ✓ icon | — |
| Actions menu (⋯) | Dropdown with: Import JSON, Export JSON, Save Draft, AI Shuffle, Delete Schedule | — |

---

## 3. Tier 2 — Filter Bar

Dynamic height. Shows different filter rows based on `viewMode`.

### Filter Visibility Rules

| View Mode | Teacher Row | Class Row | Room Row |
|-----------|------------|-----------|----------|
| **All** | ✅ | ✅ | ✅ |
| **Teacher** | ✅ (highlighted) | ❌ | ❌ |
| **Class** | ❌ | ✅ (highlighted) | ❌ |
| **Room** | ❌ | ❌ | ✅ (highlighted) |

### Active Filter Highlight
When a filter is the "anchor" (single-entity mode), its label gets:
```
text-primary font-semibold border-l-2 border-primary pl-2
```

### Filter Row Layout (CSS Grid)
```
gridTemplateColumns: 'auto auto auto auto'
columnGap: 12px
```

**Teacher row:**
| Label | T. code (dropdown) | T. name label | Prefix + FirstName + LastName (readonly) |
|-------|-------------------|---------------|------------------------------------------|

**Class row:**
| Label | Class (dropdown) | Default Room label | Room value (readonly) |
|-------|-----------------|--------------------|-----------------------|

**Room row:**
| Label | Room (dropdown) | Room name label | Room name (readonly) |
|-------|----------------|-----------------|----------------------|

---

## 4. View Modes

```ts
type ViewMode = 'all' | 'teacher' | 'class' | 'room';
```

### View All (Overlay Mode)
- **Data source:** `computeOverlayData(teacherSchedule, classSchedule, roomSchedule, dataset)`
- **Cell logic:** Takes the **teacher's item** as primary source, renders 3 rows (Subject, Class, Room)
- **DnD:** Enabled — cells are both draggable and droppable
- **Click action:** Opens `OverlayInspectPopover`
- **Sidebar:** Visible (Teaching Slots)
- **Filter bar:** Shows all 3 filter rows

### Teacher / Class / Room (Individual Mode)
- **Data source:** `dataset.teachers[tCode]` / `dataset.classes[classCode]` / `dataset.rooms[roomCode]`
- **Cell logic:** Single entity lookup, 3 rows with entity-specific mapping
- **DnD:** Disabled — read-only banner shown at top
- **Click action:** Opens `EditOverlay` modal
- **Sidebar:** Hidden
- **Filter bar:** Shows only the relevant filter row (highlighted)

---

## 5. The Timetable Grid

Component: `TimetableGridV2`

### Grid Structure
- **Rows:** 5 days (Monday → Friday) + 1 Summary row
- **Columns:** Day label (sticky) + Info label (sticky) + 12 period slots
- **Min cell width:** 76px
- **Total min width:** `76 × 12 + 134 = 1046px`
- **Overflow:** `overflow-x-auto` with horizontal scroll

### Sticky Columns (Critical UX)
| Column | Width | Sticky Position | z-index |
|--------|-------|-----------------|---------|
| Day label | 72px | `left: 0` | z-10 (body) / z-20 (header) |
| Info label | 62px | `left: 72px` | z-10 (body) / z-20 (header) |

### Row Height
- Each cell = 3 rows × 32px = **96px total**
- Day label cell: centered text, same 96px height
- Info column: 3 stacked sub-labels matching cell rows

### Header Row
| Cell | Content | Style |
|------|---------|-------|
| Day corner | "Day" | `text-[9px] font-bold uppercase tracking-wider` |
| Info corner | "Info" | same |
| Slot 1–12 | Bold number | `text-sm font-bold text-primary` |
| Background | — | `bg-surface-alt` |

### Day Labels
Full name on desktop (`Monday`), abbreviated on mobile (`Mon`).

### Info Column (Row Labels)
Shows what each of the 3 cell rows represents:

| View Mode | Row 1 | Row 2 | Row 3 |
|-----------|-------|-------|-------|
| **All** | Subject | Class | Room |
| **Teacher** | Subject | Class | Room |
| **Class** | Subject | Teacher | Room |
| **Room** | Subject | Teacher | Class |

Style: `text-[9px] text-foreground-muted/70`

---

## 6. The Cell (UnifiedScheduleCell)

Component: `UnifiedScheduleCell`

### Anatomy
```
┌─────────────────────────────┐  ← 96px total (3 × 32px)
│  [Subject Code]    [⚠ badge]│  ← Row 1: primary (bold)
├─────────────────────────────┤
│  [Class / Teacher code]     │  ← Row 2: secondary (medium)
├─────────────────────────────┤
│  [Room / Class code]        │  ← Row 3: tertiary (muted)
└─────────────────────────────┘
```

### Row Structure

```ts
interface CellRow {
    label: string;        // 'Subject' | 'Teacher' | 'Class' | 'Room'
    value: string | null; // null → renders "—"
    weight: 'primary' | 'secondary' | 'tertiary';
}
```

**Weight → Typography:**
| Weight | Style |
|--------|-------|
| `primary` | `font-semibold text-foreground text-[11px]` |
| `secondary` | `font-medium text-foreground text-[10px]` |
| `tertiary` | `text-foreground-muted text-[10px]` |

**Row rendering:**
- Height: `32px` each (constant `ROW_HEIGHT`)
- Alignment: `flex items-center justify-center px-1.5`
- Text: `truncate w-full text-center leading-tight`
- Empty value: `—` in `text-foreground-muted/40`
- Divider between rows: `border-t border-border/50`
- Animation: Framer Motion `{ opacity: 0, y: 4 } → { opacity: 1, y: 0 }`

### Background Logic

#### Overlay Mode (View All)
| State | Background | Border |
|-------|-----------|--------|
| All free | `bg-surface` | `border border-dashed border-border` |
| Has content, no conflict | `bg-emerald-50` | `border-l-[3px] border-l-emerald-400` |
| Conflict (≥1 mismatch) | `bg-red-50` | `border border-red-300` |
| Drop target (valid) | `bg-primary-light` | `ring-2 ring-primary ring-inset` |
| Drop target (conflict) | `bg-red-100` | `ring-2 ring-red-400 ring-inset` |

#### Individual Mode
| State | Background | Border |
|-------|-----------|--------|
| Empty | `bg-surface` | `border border-dashed border-border` |
| Green variant | `bg-emerald-50` | `border-l-[3px] border-l-emerald-400` |
| Red variant | `bg-pink-50` | `border-l-[3px] border-l-pink-400` |

### Badges & Indicators

**Conflict badge (Overlay mode, conflictCount ≥ 1):**
```
Position: absolute top-1 right-1
Style: bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full
Content: ⚠ icon + conflict count
```

**Variant dot (Individual mode, has content):**
```
Position: absolute top-1.5 right-1.5
Size: w-1.5 h-1.5 rounded-full
Color: bg-pink-400 (red) / bg-emerald-400 (green)
```

**Empty cell watermark (Individual mode):**
```
Position: absolute inset-0 centered
Text: "empty" in text-[9px] text-foreground-muted/30 uppercase tracking-wider
```

---

## 7. Cell Row Mapping by View Mode

### View All Mode (`buildOverlayRows`)
Source: **Teacher's item only** (`data.teacher`)
```
Row 1: Subject  → item.subjectCode  (primary)
Row 2: Class    → item.classCode    (secondary)
Row 3: Room     → item.room         (tertiary)
```

### Teacher Mode (`buildTeacherRows`)
Source: Single teacher's schedule at that slot
```
Row 1: Subject  → item.subjectCode  (primary)
Row 2: Class    → item.classCode    (secondary)
Row 3: Room     → item.room         (tertiary)
```

### Class Mode (`buildClassRows`)
Source: Single class's schedule at that slot
```
Row 1: Subject  → item.subjectCode  (primary)
Row 2: Teacher  → item.teacherName  (secondary)
Row 3: Room     → item.room         (tertiary)
```

### Room Mode (`buildRoomRows`)
Source: Single room's schedule at that slot
```
Row 1: Subject  → item.subjectCode  (primary)
Row 2: Teacher  → item.teacherName  (secondary)
Row 3: Class    → item.classCode    (tertiary)
```

> **Key insight:** Row 1 is ALWAYS Subject. Row 2 shows the "who" (not the anchor entity). Row 3 shows the "where/which" (not the anchor entity).

---

## 8. Conflict Logic (View All)

Source: `overlayUtils.ts → computeOverlayData()`

**What is a conflict?**
A REAL cross-map mismatch. The teacher's item says "class 6/15 in room 7401", but if `dataset.classes["6/15"][day][slot]` has a DIFFERENT item, that's a conflict.

**Conflict detection algorithm:**
```
For each (day, slot):
  teacherItem = teacherSchedule[day][slot]
  if teacherItem exists:
    classEntry = dataset.classes[teacherItem.classCode][day][slot]
    if classEntry exists AND classEntry ≠ teacherItem → conflict++
    roomEntry  = dataset.rooms[teacherItem.room][day][slot]
    if roomEntry exists AND roomEntry ≠ teacherItem  → conflict++
```

**Result:**
- `conflictCount: 0` = clean (consistent across all maps)
- `conflictCount: 1` = one entity map disagrees
- `conflictCount: 2` = both class and room maps disagree
- `allFree: true` = teacher has nothing scheduled (cell is empty)

---

## 9. Summary Row

Located at the bottom of the grid. `border-t-2 border-border-strong`, `bg-surface-alt/60`.

### Labels by View Mode
| View Mode | Row 1 | Row 2 | Row 3 |
|-----------|-------|-------|-------|
| **All** | Subject | Class | Total |
| **Teacher** | Subject | Class | Total |
| **Class** | Subject | Teacher | Total |
| **Room** | Subject | Teacher | Total |

### Values
| Row | Overlay (View All) | Individual |
|-----|-------------------|------------|
| Row 1 | Count of unique `subjectCode` across 5 days for this slot | Same |
| Row 2 | Count of unique `classCode` across 5 days | Count of unique secondary entity |
| Row 3 | `filledCount / 5` (e.g. "3/5") | `items.length / 5` |

Style: `text-[10px] text-foreground-muted`, Total row uses `font-semibold text-foreground`.

---

## 10. Teaching Slot Sidebar

Component: `TeachingSlotSidebarV2`
**Only visible in View All mode.**

### Layout
- Width: `190px`, flex-shrink-0
- Background: `bg-surface`, `rounded-xl`, `border border-border`
- Max cards height: `max-h-[calc(100vh-240px)]`, `overflow-y-auto`

### Header
```
[📦 icon (orange-100 bg)] "Teaching Slots" [count badge (orange-500)]
```

### Card Anatomy (SidebarCard)
```
┌──────────────────────────────┐
│▎ [SubjectCode]          [✕]  │  ← Accent bar (left 1px, variant color)
│▎ [subject name (Thai)]       │
│▎ [classCode] → [room code]   │  ← Arrow separator between class and room
└──────────────────────────────┘
```

**Card styles:**
- Background: `bg-surface`
- Border: `border-border`, hover: `border-border-strong`
- Accent bar: `w-1`, left edge, `bg-pink-400` (red) or `bg-emerald-400` (green)
- Cursor: `cursor-grab`, active: `cursor-grabbing`
- Delete button: hidden by default, visible on hover (`group-hover:opacity-100`)
- Animation: spring `stiffness: 400, damping: 25`

### Empty State
Dashed border box with `+` icon and "Drag slots here to unschedule" text.

### Drop Zone
When dragging FROM grid TO sidebar → sidebar border turns orange, bg turns `bg-orange-50`.
This "unschedules" the item (removes from all 3 entity maps and returns card to sidebar).

---

## 11. Drag-and-Drop System

Library: `@dnd-kit/core`
Provider: `ScheduleDndProvider`

### Drag Sources
| Source | ID Format | Payload |
|--------|----------|---------|
| Grid cell | `cell-{day}-{slot}` | `{ source: 'GRID', item, day, slot }` |
| Sidebar card | `sidebar-{index}` | `{ source: 'SIDEBAR', item, index }` |

### Drop Targets
| Target | Condition | Result |
|--------|-----------|--------|
| Grid cell | View All only | Moves item into `(day, slot)` across all 3 entity maps |
| Sidebar dropzone | View All only | Removes item from grid, returns to sidebar |

### Drop Logic (Grid → Grid)
```ts
moveItem(dataset, item, targetDay, targetSlot, sourceDay, sourceSlot)
  → { dataset: newDataset, ejected: ScheduleItem[] }
```
- Clears source cell
- If target cell is occupied → ejects existing item to sidebar
- Places item in all 3 maps (teachers, classes, rooms)

### Drop Logic (Sidebar → Grid)
Same as above, plus removes the card from `presets` array.

### Drop Logic (Grid → Sidebar)
```ts
removeItemFromDataset(dataset, item, day, slot)
```
Removes item from all 3 entity maps. Card is pushed back into `presets`.

### Conflict Preview (while dragging)
```ts
hasConflict(dataset, targetDay, targetSlot, item, sourceDay?, sourceSlot?)
```
Checks if dropping would create a cross-map conflict. If yes, the droppable cell shows:
- `ring-2 ring-amber-400/70 bg-amber-50/60` (warning overlay)

### DnD Constraints
- **Only View All supports DnD.** Individual views are read-only.
- **Only the teacher's item is draggable** in View All mode.

---

## 12. Edit Overlay (Individual Views)

Component: `EditOverlay`
Trigger: Clicking a cell in Teacher/Class/Room mode.

Opens a modal to edit/create a `ScheduleItem` at `(day, slot)`.
On save → writes via `moveItem()` to keep all 3 maps consistent.

---

## 13. Overlay Inspect Popover (View All)

Component: `OverlayInspectPopover`
Trigger: Clicking a cell in View All mode.

### Layout
Full-screen backdrop (`bg-black/40 backdrop-blur-sm`) with centered card.

### Header
```
"Monday, Slot 3" — "View All — Slot Detail"
[⚠ 2 conflicts badge] or [All free badge]
[✕ close button]
```

### Body: 3 Entity Rows
Each row shows one entity's perspective on this slot:

**Teacher row:**
| Field | Source |
|-------|--------|
| Status dot | `bg-green-500` (busy) or `bg-gray-300` (free) |
| Primary | Teacher code (e.g. "0301") or "Available" |
| Subject | `subjectCode — subject` |
| Class | `classCode` |

**Class row:**
| Field | Source |
|-------|--------|
| Status dot | same pattern |
| Primary | Class code (e.g. "6/15") or "Available" |
| Subject | `subjectCode — subject` |
| Room | `room` |

**Room row:**
| Field | Source |
|-------|--------|
| Status dot | same pattern |
| Primary | Room code (e.g. "7401") or "Available" |
| Subject | `subjectCode — subject` |
| Teacher | `teacherName` |

### Footer
Full-width "Close" button.

---

## 14. Design Tokens & Typography

### Colors Used
| Token | Hex | Usage |
|-------|-----|-------|
| `$background` | `#F8FAFC` | Page background |
| `$surface` | `#FFFFFF` | Cards, grid cells |
| `$surface-alt` | `#F1F5F9` | Headers, sticky columns |
| `$foreground` | `#0F172A` | Primary text |
| `$foreground-muted` | `#64748B` | Labels, secondary text |
| `$primary` | `#2563EB` | Links, active states, slot numbers |
| `$border` | `#E2E8F0` | Light borders |
| `$border-strong` | `#CBD5E1` | Grid outer border |
| Emerald-50 | `#ECFDF5` | Clean cell bg |
| Emerald-400 | `#34D399` | Clean cell accent |
| Pink-50 | `#FDF2F8` | Red variant cell bg |
| Pink-400 | `#F472B6` | Red variant accent |
| Red-50 | `#FEF2F2` | Conflict cell bg |
| Red-500 | `#EF4444` | Conflict badge |
| Yellow-100 | `#FEF9C3` | Draft badge bg |
| Orange-100/500 | — | Sidebar accent |

### Typography Scale
| Size | Usage |
|------|-------|
| `text-[8px]` | Conflict badge count |
| `text-[9px]` | Info labels, empty watermark, day abbreviation |
| `text-[10px]` | Cell secondary/tertiary text, summary values |
| `text-[11px]` | Cell primary text, sidebar subject code, popover details |
| `text-xs` (12px) | Filter labels, badge text, sidebar header |
| `text-sm` (14px) | Primary bar title, buttons, slot header |

### Font Weights
| Weight | Usage |
|--------|-------|
| normal | Tertiary cell text, readonly inputs |
| medium (500) | Secondary cell text, filter labels |
| semibold (600) | Primary cell text, summary totals, section titles |
| bold (700) | Day labels, slot numbers, page title, sidebar subject code |

---

## 15. Recommended Improvements

Based on analysis of the current implementation, here are the design improvements discussed and agreed upon:

### A. Fixed "Slot Machine" Rows (No Jumping)
Even when a row has no data, maintain the empty slot with a dash (`—`). The teacher row is ALWAYS row 1, class ALWAYS row 2, room ALWAYS row 3 in View All mode. This prevents the visual "jumping" that makes the grid hard to scan.

**Status:** ✅ Already implemented (null → renders "—").

### B. Tiny Prefix Icons for Rapid Identification
Add small, muted icons before cell text in View All mode so the admin can instantly identify what each stacked row represents:
```
🧑‍🏫  อ21345     ← Subject (teacher POV)
👥  6/15       ← Class
🚪  7401       ← Room
```
**Status:** 🔲 Not yet implemented. Recommended for next iteration.

### C. Per-Row Conflict Highlighting
Instead of making the entire cell red, highlight only the specific row that is causing the conflict in bold red text. The clean rows stay in their normal muted color.
```
[ 🧑‍🏫  อ21345        ]  ← Normal
[ 👥  —              ]  ← Normal (free)
[ 🚪  PE101    (⚠)   ]  ← Red! This room is double-booked
```
**Status:** 🔲 Not yet implemented. The current approach colors the entire cell red.

### D. Condensed Typography for Dense Grid
Because 3 rows of text are stacked in a small cell:
- Use tighter `letter-spacing` or a condensed font variant
- Strong contrast hierarchy: Row 1 slightly bolder than Rows 2 and 3

**Status:** ✅ Partially implemented (weight system exists, but could be more distinct).
