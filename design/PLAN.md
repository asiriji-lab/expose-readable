# Plan — Step-by-step wizard flow for the Schedool input redesign

## Context
The `.pen` file has 8 polished but **disconnected** screens (01 Overview hub, 6 forms, slot-picker modal, submit gate). Nothing shows the *journey* an admin actually goes through — the dependency-ordered path from an empty session to a generated timetable. The existing Overview (01, `P9nAh`) is a **parallel hub** (tier cards with lock/done badges), not a linear "do step 1, then 2…" narrative.

User decisions:
- **Form = in-product wizard** (Direction C): a persistent horizontal **step-bar** at the top of the forms + a **Back/Next** footer, making the experience itself a guided linear walkthrough.
- **Upgrade the hub**: rework screen 01 into the canonical flow landing (a linear roadmap), so there's one entry screen, not two overlapping overviews.

Outcome: the admin sees exactly where they are in an 8-step sequence, can only move forward when the current step is valid, and the whole path is legible at a glance from screen 01.

## The 8 steps (dependency order)
Honors the tier graph in `CLAUDE.md` (period·room → student·teacher → preplace → curriculum·elective → submit). Maps to existing screens:

| # | Step (Thai) | Tier | Existing screen |
|---|---|---|---|
| 1 | คาบเรียน (period) | 1 | 08 `knBRY` |
| 2 | ห้องเรียน (room) | 1 | 06 `A0JJTp` |
| 3 | นักเรียน/ชั้นเรียน (student) | 2 | 02 `iHUCu` |
| 4 | ครู (teacher) | 2 | — (step only, no body yet) |
| 5 | คาบล็อก (preplace) | 3 | 05 `Lbqmw` |
| 6 | หลักสูตร (curriculum) | 4 | 03 `LkKZX` |
| 7 | วิชาเลือกเสรี (elective, optional) | 4 | — (step only, no body yet) |
| 8 | ตรวจ & สร้าง (review/run) | submit | 07 `gnRCr` |

Slot picker (04 `pmIi4`) is a sub-widget modal, not a step — leave untouched.

## Build

### 1. Reusable components (new, top-level, like `EntityCard`)
- **`WizardStepBar`** — horizontal, full-width, `$surface` bg, bottom border. 8 step nodes joined by connector lines.
  - Step node = a circle + label. States via override:
    - **done**: `$success` circle + `circle-check`, label `$text-muted` (clickable = jump back).
    - **active**: `$primary` filled circle + number, label `$primary` weight 700.
    - **locked**: `$surface-alt` circle + `lock`, label `$text-faint` (not clickable).
  - Connector segment: 2px line; before-active = `$success`/`$primary`, after = `$border`.
  - Build as one reusable component; instance per screen overrides each node's state + the active index. Use a JS loop in `batch_design` over a `[label, icon, state]` array (same idiom already used for the sidebars).
- **`FooterNav`** — horizontal, full-width, top border, `justifyContent: space_between`.
  - Left: `‹ ย้อนกลับ` ghost button (override `enabled:false` on step 1).
  - Center: faint `บันทึกอัตโนมัติ` hint.
  - Right: primary `ถัดไป ›`; overridden to `ตรวจสอบและสร้าง` on step 8. Disabled-look + hint when the step has blocking (structural/relational) errors — reuses the hard-error-blocks rule already shown in the submit gate.

Create each component in its own `batch_design` call so the child IDs come back for later overrides (per Pencil rules).

### 2. Upgrade screen 01 (`P9nAh`) → flow roadmap
- Keep the existing Header (`AWojb`) — title + the struct/rel legend chips.
- Replace the tier-card hub inside Body (`pzGAE`) with a **vertical numbered roadmap**: 8 rows top→bottom joined by a vertical connector line. Each row: number/check/lock badge + step name + status pill + one-line description. Group visually by the 4 tiers (small `ขั้นที่ 1–4` dividers) so order + gating are explicit.
- Primary CTA: `ดำเนินการต่อ — ขั้นที่ 3 · ชั้นเรียน` (jumps to the current step).
- Reuse the existing `EntityCard` look where it fits, but the defining change is the **single ordered column with connectors** (vs today's parallel cards).

### 3. Convert each form screen to wizard layout
Screens: 02 `iHUCu`, 03 `LkKZX`, 05 `Lbqmw`, 06 `A0JJTp`, 08 `knBRY`, and 07 `gnRCr` (final step). Each currently is `horizontal [Sidebar(264) + Main(TopBar+Content)]`. Per screen:
1. Set the screen frame `layout: "vertical"`.
2. `Delete` the left Sidebar (`nBv9o`/`Zm54S`/`wT4L2`/`g7YuI3`/`E28CQ5`/`m7gB6`) — the step-bar replaces its nav role (matches the selected preview).
3. Insert a `WizardStepBar` instance as the **first** child, with that screen's active index + done/locked states set.
4. Keep `Main` (now full-width) with its `TopBar` (breadcrumb repurposed as the step title) + `Content` untouched — preserves all the work already in each form (CSV cards, builders, etc.).
5. Insert a `FooterNav` instance as the **last** child (Back/Next, correct enabled/label state).
- Active index per screen: 08→1, 06→2, 02→3, 05→5, 03→6, 07→8.

### 4. Out of scope (note, don't build unless asked)
Teacher (step 4) and elective (step 7) have no body screens — they appear in the step-bar only. Building them would complete all 8 bodies; flagged as a follow-up.

## Critical files
- `pencil_new design.pen` (only artifact) — via **Pencil MCP only** (`batch_design`, `batch_get`, `get_screenshot`, `export_nodes`). Never Read/Edit the `.pen` directly.
- Reference (read-only, already reviewed): `from claude design/Schedool Input Wireframes.dc.html` (Direction C stepper) and `Direction B - Guided Workspace.dc.html`.
- Variables already defined (struct/rel/primary/success palette, `$font-main`) — reuse, don't redefine.

## Verification
- After each component + screen, `get_screenshot` the screen; if a freshly-added node renders blank, **re-request once or `export_nodes` to a temp PNG and Read it** — the screenshot service serves stale region tiles for new complex subtrees (confirmed twice this session; data is correct in `batch_get`).
- Check per screen: step-bar shows correct done/active/locked + connector colors; active index matches the screen; Back hidden/disabled on step 1; Next label = `ตรวจสอบและสร้าง` on step 8; footer aligned; no clipped content (grow screen height if needed).
- Check screen 01: single ordered column, connectors, tier dividers, CTA points at the active step.
- Delete any temp export folder when done.
