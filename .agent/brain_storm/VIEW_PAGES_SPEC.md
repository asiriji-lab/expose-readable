# View Modes Specification — Teacher / Class / Room

> **Purpose:** Specification for the three read-only schedule view toggles (modes) within the Admin Schedule Output page, each showing a timetable from the perspective of a single entity.
> **Source of truth:** Based on `schedool.pen` design screens (adapted for Admin view modes) and the `SCHEDULE_OUTPUT_DESIGN.md` grid system.

---

## Table of Contents

1. [Overview & Integration](#1-overview--integration)
2. [Teacher Mode](#2-teacher-mode)
3. [Class Mode](#3-class-mode)
4. [Room Mode](#4-room-mode)
5. [Shared Timetable Grid](#5-shared-timetable-grid)
6. [Design Tokens (Shared)](#6-design-tokens-shared)

---

## 1. Overview & Integration

These are **integrated view toggles** (tabs or dropdown modes) within the main Admin Schedule Output page. The admin can switch between the master "View All" grid and these isolated viewpoints.

| View Mode | Anchor entity | Filter | Behavior |
|-----------|---------------|--------|----------|
| **Teacher** | Teacher | Teacher Dropdown | Replaces master grid with the selected teacher's schedule. |
| **Class** | Class | Class Dropdown | Replaces master grid with the selected class's schedule. |
| **Room** | Room | Room Dropdown | Replaces master grid with the selected room's schedule. |

### Component Behavior in these Modes

| Concern | Details |
|---------|---------|
| Mode Toggle | Uses state (e.g., `viewMode: 'ALL' \| 'TEACHER' \| 'CLASS' \| 'ROOM'`). |
| Layout | The main Admin Header remains. Only the top summary cards, specific info bar, and grid cells swap out. |
| Grid Cells | The timetable switches to a **Read-only** representation of single entity data. |
| Target user | Schedule admin looking for a specific entity's view. |

---

## 2. Teacher Mode

**Mode Toggle:** `Teacher`

### 2.1 Layout (When Active)

```
┌──────────────────────────────────────────────┐
│  Header (64px)                               │
│  [🔵 Teacher]  [logo]          [avatar] name │
├──────────────────────────────────────────────┤
│  Dashboard Summary (auto-height)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Total Hrs │ │Avg/Day   │ │Classes   │     │
│  │   24     │ │   6      │ │  6/15    │     │
│  └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────┤
│  Teacher Info Bar                            │
│  T. code: 0301 │ Name: Mr. Somchai Jaidee   │
├──────────────────────────────────────────────┤
│                                              │
│  Timetable Grid (flex-1, scroll)             │
│  Mon–Fri × 12 slots                         │
│                                              │
├──────────────────────────────────────────────┤
│  Summary Row                                 │
└──────────────────────────────────────────────┘
```

### 2.2 Header Bar

> **Note:** Because this is integrated into the Admin page, the top-level Header remains the standard Admin Header. The specific "Teacher" branding is replaced by simply being in "Teacher Mode".

### 2.3 Summary Stats (3 cards, horizontal)

| Card | Label | Value | Sub-label |
|------|-------|-------|-----------|
| 1 | Total Hours | `24` | Teaching periods |
| 2 | Average/Day | `6` | Across day spread |
| 3 | Classes | `6/15` | Primary assigned room |

**Style:** `cornerRadius: 8`, `fill: $surface`, `padding: 20`, `stroke: $border 1px`, `gap: 16` between cards.

### 2.4 Teacher Info Bar

Simple horizontal bar showing the teacher's identity:

| Field | Value | Style |
|-------|-------|-------|
| T. code | `0301` (from auth) | `font-semibold text-primary` |
| Name | Full name | `font-medium text-foreground` |
| Department | (optional) | `text-foreground-muted` |

**Layout:** `bg-surface`, `padding: [8, 16]`, bottom border `$border`.

### 2.5 Timetable Grid

Uses the **shared grid** (see [§5](#5-shared-timetable-grid)) with **Teacher mode** row mapping:

| Row | Label | Source | Weight |
|-----|-------|--------|--------|
| Row 1 | Subject | `item.subjectCode` | `primary` — semibold |
| Row 2 | Class | `item.classCode` | `secondary` — medium |
| Row 3 | Room | `item.room` | `tertiary` — muted |

**Data source:** `dataset.teachers[authTeacherCode]`

### 2.6 Cell Background (Read-Only)

| State | Background | Left accent |
|-------|-----------|-------------|
| Empty | `$surface` + dashed border | — |
| Has content | `bg-emerald-50` | `3px border-l-emerald-400` |

> No conflict highlighting (single-entity view has no cross-map mismatches).

### 2.7 Click Behavior

Clicking a filled cell → opens a **read-only detail popover** (not an edit overlay):

```
┌──────────────────────────┐
│  Monday, Slot 3          │
│  ─────────────────────── │
│  Subject: อ21345         │
│           English Fund.  │
│  Class:   6/15           │
│  Room:    7401           │
│           Computer Room  │
│  ─────────────────────── │
│       [ Close ]          │
└──────────────────────────┘
```

### 2.8 Summary Row

| Row 1 | Row 2 | Row 3 |
|-------|-------|-------|
| Unique subjects per slot | Unique classes per slot | Filled slots / 5 |

---

## 3. Class Mode

**Mode Toggle:** `Class`

### 3.1 Layout (When Active)

```
┌──────────────────────────────────────────────┐
│  Header (64px)                               │
│  [🔵 Student]  [logo]         [avatar] name  │
├──────────────────────────────────────────────┤
│  Dashboard Summary (auto-height)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Total Hrs │ │Class     │ │Room      │     │
│  │   32     │ │  6/15    │ │  5410    │     │
│  └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────┤
│  Class Info Bar                              │
│  Class: 6/15 │ Homeroom: 5410 │ Adviser: …  │
├──────────────────────────────────────────────┤
│                                              │
│  Timetable Grid (flex-1, scroll)             │
│  Mon–Fri × 12 slots                         │
│                                              │
├──────────────────────────────────────────────┤
│  Summary Row                                 │
└──────────────────────────────────────────────┘
```

### 3.2 Header Bar

> **Note:** The top-level Header remains the standard Admin Header.

### 3.3 Summary Stats (3 cards)

| Card | Label | Value | Sub-label |
|------|-------|-------|-----------|
| 1 | Total Hours | `32` | Lessons per week |
| 2 | Latest Class | `6/15` | Homeroom assignment |
| 3 | Default Room | `5410` | Primary classroom |

### 3.4 Class Info Bar

| Field | Value | Style |
|-------|-------|-------|
| Class | `6/15` (from auth) | `font-semibold text-primary` |
| Homeroom | `5410` | `font-medium text-foreground` |
| Adviser | Teacher name (optional) | `text-foreground-muted` |

### 3.5 Timetable Grid

Uses the **shared grid** with **Class mode** row mapping:

| Row | Label | Source | Weight |
|-----|-------|--------|--------|
| Row 1 | Subject | `item.subjectCode` | `primary` |
| Row 2 | Teacher | `item.teacherName` | `secondary` |
| Row 3 | Room | `item.room` | `tertiary` |

**Data source:** `dataset.classes[authClassCode]`

### 3.6 Cell Background

Same as Teacher view — read-only, no conflict states:

| State | Background | Left accent |
|-------|-----------|-------------|
| Empty | `$surface` + dashed border | — |
| Has content | `bg-blue-50` | `3px border-l-blue-400` |

> **Note:** Uses **blue** accent (not emerald) to visually distinguish from Teacher view.

### 3.7 Click Behavior

Same read-only detail popover pattern, but showing class-relevant info:

```
┌──────────────────────────┐
│  Monday, Slot 3          │
│  ─────────────────────── │
│  Subject: อ21345         │
│           English Fund.  │
│  Teacher: Mr. Somchai    │
│           (0301)         │
│  Room:    7401           │
│           Computer Room  │
│  ─────────────────────── │
│       [ Close ]          │
└──────────────────────────┘
```

### 3.8 Summary Row

| Row 1 | Row 2 | Row 3 |
|-------|-------|-------|
| Unique subjects per slot | Unique teachers per slot | Filled slots / 5 |

---

## 4. Room Mode

**Mode Toggle:** `Room`

### 4.1 Layout (When Active)

```
┌──────────────────────────────────────────────┐
│  Header (64px)                               │
│  [🔵 Schedool]  [logo]        [avatar] name  │
├──────────────────────────────────────────────┤
│  Room Selector Bar                           │
│  Room: [▼ 7401 ] │ Name: Computer Room      │
├──────────────────────────────────────────────┤
│  Dashboard Summary (auto-height)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Usage %   │ │Unique T. │ │Unique Cl.│     │
│  │   78%    │ │   8      │ │   12     │     │
│  └──────────┘ └──────────┘ └──────────┘     │
├──────────────────────────────────────────────┤
│                                              │
│  Timetable Grid (flex-1, scroll)             │
│  Mon–Fri × 12 slots                         │
│                                              │
├──────────────────────────────────────────────┤
│  Summary Row                                 │
└──────────────────────────────────────────────┘
```

### 4.2 Header Bar

Standard admin header remains active.

### 4.3 Room Selector Bar

Unlike Teacher/Class (which auto-resolve from auth), Room view uses a **dropdown selector**:

| Element | Style | Behavior |
|---------|-------|----------|
| Label | `"Room"` — `font-semibold text-primary` | Static |
| Dropdown | `cornerRadius: 6`, `fill: $surface`, `stroke: $border` | Selects room code |
| Room name | `font-medium text-foreground` | Auto-fills from selected room |

### 4.4 Summary Stats (3 cards)

| Card | Label | Value | Sub-label |
|------|-------|-------|-----------|
| 1 | Usage | `78%` | Room utilization rate |
| 2 | Teachers | `8` | Unique teachers using this room |
| 3 | Classes | `12` | Unique classes using this room |

### 4.5 Timetable Grid

Uses the **shared grid** with **Room mode** row mapping:

| Row | Label | Source | Weight |
|-----|-------|--------|--------|
| Row 1 | Subject | `item.subjectCode` | `primary` |
| Row 2 | Teacher | `item.teacherName` | `secondary` |
| Row 3 | Class | `item.classCode` | `tertiary` |

**Data source:** `dataset.rooms[selectedRoomCode]`

### 4.6 Cell Background

| State | Background | Left accent |
|-------|-----------|-------------|
| Empty | `$surface` + dashed border | — |
| Has content | `bg-violet-50` | `3px border-l-violet-400` |

> Uses **violet** accent to distinguish from Teacher (emerald) and Class (blue).

### 4.7 Click Behavior

Read-only detail popover showing room-relevant info:

```
┌──────────────────────────┐
│  Monday, Slot 3          │
│  ─────────────────────── │
│  Subject: อ21345         │
│           English Fund.  │
│  Teacher: Mr. Somchai    │
│           (0301)         │
│  Class:   6/15           │
│  ─────────────────────── │
│       [ Close ]          │
└──────────────────────────┘
```

### 4.8 Summary Row

| Row 1 | Row 2 | Row 3 |
|-------|-------|-------|
| Unique subjects per slot | Unique teachers per slot | Filled slots / 5 |

---

## 5. Shared Timetable Grid

All 3 pages share the same `ReadOnlyTimetableGrid` component (derived from `TimetableGridV2`).

### 5.1 Grid Dimensions

| Property | Value |
|----------|-------|
| Rows | 5 days (Mon–Fri) + 1 Summary |
| Columns | Day label (72px, sticky) + Info label (62px, sticky) + 12 period slots |
| Min cell width | 76px |
| Cell height | 3 × 32px = **96px** |
| Overflow | `overflow-x-auto` |
| Corner radius | `12px` on grid wrapper |
| Border | `$border-strong` 1px |

### 5.2 Header Row

| Cell | Content | Style |
|------|---------|-------|
| Day corner | `"DAY"` | `text-[9px] font-bold uppercase` |
| Info corner | `"INFO"` | same |
| Slots 1–12 | Bold number | `text-sm font-bold text-primary` |
| Background | — | `bg-surface-alt` |

### 5.3 Info Column Labels (per view)

| View | Row 1 | Row 2 | Row 3 |
|------|-------|-------|-------|
| **Teacher** | Subject | Class | Room |
| **Class** | Subject | Teacher | Room |
| **Room** | Subject | Teacher | Class |

Style: `text-[9px] text-foreground-muted/70`

### 5.4 Cell Typography

| Weight | Font | Size | Color |
|--------|------|------|-------|
| `primary` | Inter semibold 600 | 11px | `$foreground` |
| `secondary` | Inter medium 500 | 10px | `$foreground` |
| `tertiary` | Inter normal 400 | 10px | `$foreground-muted` |

### 5.5 Empty Cell

- Dashed border: `border border-dashed border-border`
- Watermark: `"—"` centered in `text-foreground-muted/40`
- No "empty" text watermark (cleaner for read-only)

### 5.6 Day Labels

| Desktop | Mobile |
|---------|--------|
| `Monday` | `Mon` |
| `Tuesday` | `Tue` |
| etc. | etc. |

---

## 6. Design Tokens (Shared)

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `$background` | `#F8FAFC` | Page background |
| `$surface` | `#FFFFFF` | Cards, grid cells |
| `$surface-alt` | `#F1F5F9` | Headers, sticky cols |
| `$foreground` | `#0F172A` | Primary text |
| `$foreground-muted` | `#64748B` | Secondary text |
| `$primary` | `#2563EB` | Links, accents |
| `$border` | `#E2E8F0` | Light borders |
| `$border-strong` | `#CBD5E1` | Grid outer border |

### View-Specific Accent Colors

| View | Cell bg | Left accent | Rationale |
|------|---------|-------------|-----------|
| Teacher | `emerald-50 (#ECFDF5)` | `emerald-400 (#34D399)` | Matches admin editor convention |
| Class | `blue-50 (#EFF6FF)` | `blue-400 (#60A5FA)` | Student-friendly, distinct |
| Room | `violet-50 (#F5F3FF)` | `violet-400 (#A78BFA)` | Facility/space association |

### Typography

| Size | Usage |
|------|-------|
| 9px | Info labels, watermark |
| 10px | Cell secondary/tertiary |
| 11px | Cell primary |
| 12px | Filter labels, badges |
| 14px | Header user name, buttons |
| 18px | Header brand text |
| 32px | Dashboard page title |

### Shared Component References

| Component | Source |
|-----------|--------|
| Header | Derived from `schedool.pen` Teacher/Student Dashboard headers |
| Stat Card | Same card pattern (`cornerRadius: 8`, `fill: $surface`, `stroke: $border`, `padding: 20`) |
| Timetable | Simplified `TimetableGridV2` without DnD or sidebar |
| Detail Popover | Simplified `OverlayInspectPopover` — single entity, no conflict display |
