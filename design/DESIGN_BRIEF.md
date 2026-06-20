# Schedool — Admin Input Redesign (Design Phase)

Design workspace for redesigning the Schedool admin **data-input** experience.
Goal: kill confusion + complexity in how a school admin enters scheduling data.
This phase = **design only** (Pencil `.pen` mockups). No production code yet.

The actual app lives in `schedool/` (Next.js frontend + Flask/GA backend) — see
`schedool/CLAUDE.md`. Do not duplicate that; this file governs the design work.

---

## The problem being solved

Today admins fill a **Google Sheet** (Thai headers, pipe syntax, `constraint type=`,
timeslot strings, cross-sheet references), come back to the app, validate, fix, repeat.
The complexity lives *inside the sheet*. Decision: replace it with **native in-app forms**.

## Core design principle — dependency-ordered entry

Two kinds of checks, two fixes:

| Check type | Means | Fix in design |
|---|---|---|
| **Structural** | Is the cell's *syntax* right (`1/1`, `MON_2-10`) | Inline field validation + input widgets (masks, pickers). Can't type bad syntax. |
| **Relational** | Does the referenced thing *exist* (room id, slot name, teacher) | **Deleted by construction.** Downstream forms only offer dropdowns built from upstream data. Can't reference what doesn't exist. |

Order entry by the data dependency graph so each tier feeds the next tier's dropdowns:

```
Tier 1  period · room          (no deps — pure structural)
Tier 2  student → room          (homeroom_room picks an existing room)
        teacher → student class (homeroom_class picks an existing class)
Tier 3  preplace → student/teacher/period
Tier 4  curriculum → teacher/room/period/student
        elective  → teacher/room/preplace
```

Leftover relational checks are **cross-row only** (duplicate `homeroom_room`,
`subject_id` uniqueness per grade, SUB_GROUP pipe-count match) → section-level
badges gated before submit, not free-text validation.

## Hard syntaxes → widgets

- timeslot `MON_2-10` → slot-picker grid (days × periods)
- SUB_GROUP `|` pipes → sub-group builder rows (each picks teachers + room + sections)
- anchor/continuation merged rows → one subject card + class-assignment sub-rows
- `constraint type=` → teaching-type selector that reveals only relevant fields
- preplace `department:` / `student_grade:` / `homeroom_teacher` → category chip multi-select

---

## Sources of truth (read, don't reinvent)

| What | Where |
|---|---|
| Full input spec + all validation rules | `schedool/backend/docs/INPUT_SPEC.md` |
| Structural check logic | `schedool/frontend/app/(admin)/validators/structural/` |
| Relational check logic | `schedool/frontend/app/(admin)/validators/referential/` |
| Current input UI (being replaced) | `schedool/frontend/app/(admin)/dashboard/[id]/` |

## Tooling

- Mockups via **Pencil MCP** (`.pen` files). Requires the Antigravity app running.
- UI language: **Thai** (matches current app + school admins).
- Always `get_guidelines()` before drawing; verify sections with `get_screenshot`.

## ponytail

Lazy/efficient design. No speculative screens, no states nobody asked for.
Ship the simplest flow that removes confusion; add complexity only when a real
input case demands it.