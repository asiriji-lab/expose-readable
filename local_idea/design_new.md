# Schedule Page Redesign — 3-Band Availability View

> Implementation blueprint. Each phase is self-contained and should be done in order.
> Files are relative to `app/(admin)/schedule/`.

---

## Core Concept Recap

The schedule page shows a **3-way intersection** of Teacher × Class × Room.

- **View All** (edit mode): Each cell has 3 colored **bands** representing what each filtered entity is doing at that slot. Editing (drag-drop + modal) is only possible here because all 3 must be free simultaneously.
- **Teacher / Class / Room views** (read-only): Show one entity's full timetable. No editing.

### Band colors & meaning

| Band | Color | Entity | When occupied, shows... | When free |
|------|-------|--------|-------------------------|-----------|
| Green (top) | `emerald` tones | Selected Teacher | Subject code + class + room (full detail — this is YOUR anchor) | Transparent / hidden |
| Pink (middle) | `pink` tones | Selected Class | Compact label (subject code or teacher code). **Click → popover** | Transparent / hidden |
| Yellow (bottom) | `amber` tones | Selected Room | Compact label (subject code or teacher code). **Click → popover** | Transparent / hidden |

### Cell states in View All

| State | Visual |
|-------|--------|
| All 3 free | Pure white, dashed border. Droppable. Clickable → open EditOverlay to create new. |
| Teacher has lesson here (matching class+room = synchronized) | All 3 bands filled with matching data. Green accent border-left. |
| Teacher has lesson here (different class/room than filter) | Green band filled. Pink/yellow may or may not be filled (independent). |
| Teacher free, but class or room busy | White bg. Pink and/or yellow band visible with compact label. Green band empty. NOT droppable (conflict). |
| All 3 busy with DIFFERENT lessons | All 3 bands filled with different data. Red accent or red top-right badge. NOT droppable. |

### Click behavior on bands (pink/yellow)

Clicking a pink or yellow band opens the existing **OverlayInspectPopover** scoped to that single entity, showing:
- Who booked it (teacher name + code)
- What subject
- What room / what class
- This replaces the current "show all 3 entities in popover at once" approach

---

## Phase 1: Fix `overlayUtils.ts` — True 3-Way Availability

### File: `_utils/overlayUtils.ts`

**Current bug**: `allFree: !hasTeacher` — only checks teacher.

**Change**: 

```ts
// BEFORE
const hasTeacher = !!teacherItem;
// ...
allFree: !hasTeacher,
partiallyOccupied: !hasTeacher && (!!classItem || !!roomItem),

// AFTER
const hasTeacher = !!teacherItem;
const hasClass = !!classItem;
const hasRoom = !!roomItem;
const busyCount = [hasTeacher, hasClass, hasRoom].filter(Boolean).length;
// ...
allFree: busyCount === 0,                          // TRUE 3-way: all must be free
partiallyOccupied: !hasTeacher && busyCount > 0,   // teacher free but class/room taken
```

**Also update `conflictCount`**: Currently counts cross-map data inconsistencies (always 0 in clean data). Change it to count how many of the 3 entities are busy — this is what the UI actually needs.

```ts
// AFTER
conflictCount: busyCount,  // 0 = all free, 1-3 = N entities occupied
```

**No other files change in this phase.** The type `OverlayCellData` already has the right fields.

---

## Phase 2: New `ThreeBandCell` Component

### New file: `_components/ThreeBandCell.tsx`

This component renders the 3-band layout for **View All mode only**. `UnifiedScheduleCell` continues to handle individual views unchanged.

#### Props

```ts
interface ThreeBandCellProps {
    data: OverlayCellData;
    /** Callback when a band is clicked. entityType tells which band. */
    onBandClick?: (entityType: 'teacher' | 'class' | 'room') => void;
    /** Callback when the empty area is clicked (all-free cell). */
    onEmptyClick?: () => void;
    /** Height per band in px */
    bandHeight?: number; // default ROW_HEIGHT (32)
}
```

#### Constants

```ts
const BAND_HEIGHT = 32; // same as ROW_HEIGHT for consistent grid alignment
const TOTAL_HEIGHT = BAND_HEIGHT * 3; // 96px — matches current cell height
```

#### Rendering logic

```tsx
export default function ThreeBandCell({ data, onBandClick, onEmptyClick, bandHeight = 32 }: ThreeBandCellProps) {
    const { teacher, class: classItem, room, allFree } = data;
    const totalHeight = bandHeight * 3;

    // Cell-level background
    // - allFree → white + dashed border (droppable target)
    // - has any content → white bg, no border (bands provide the color)

    return (
        <div style={{ height: totalHeight }} onClick={allFree ? onEmptyClick : undefined} className={...}>
            {/* Green band — Teacher */}
            <Band
                color="emerald"
                item={teacher}
                height={bandHeight}
                label={teacher ? `${teacher.subjectCode}  ${teacher.classCode}  ${teacher.room}` : null}
                format="full"           // show all 3 fields since teacher is the anchor
                onClick={() => onBandClick?.('teacher')}
            />
            {/* Pink band — Class */}
            <Band
                color="pink"
                item={classItem}
                height={bandHeight}
                label={classItem ? classItem.subjectCode : null}
                format="compact"        // just subject code; click for details
                onClick={() => onBandClick?.('class')}
            />
            {/* Yellow band — Room */}
            <Band
                color="amber"
                item={room}
                height={bandHeight}
                label={room ? room.subjectCode : null}
                format="compact"
                onClick={() => onBandClick?.('room')}
            />
        </div>
    );
}
```

#### Internal `<Band>` sub-component

```tsx
function Band({ color, item, height, label, format, onClick }: BandProps) {
    if (!item) {
        // Entity is free — render transparent/empty band
        return <div style={{ height }} className="w-full" />;
    }

    // Color mapping
    const colorMap = {
        emerald: 'bg-emerald-100 border-l-emerald-400 text-emerald-900',
        pink:    'bg-pink-100 border-l-pink-400 text-pink-900',
        amber:   'bg-amber-100 border-l-amber-400 text-amber-900',
    };

    return (
        <div
            style={{ height }}
            className={`w-full border-l-[3px] flex items-center px-1.5 cursor-pointer 
                        hover:brightness-95 transition-all ${colorMap[color]}`}
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        >
            {format === 'full' ? (
                // Green band: show "subjectCode | classCode | room"
                <div className="flex items-center gap-1 w-full overflow-hidden">
                    <span className="font-semibold text-[11px] truncate">{item.subjectCode}</span>
                    <span className="text-[9px] text-current/60 truncate">{item.classCode}</span>
                    <span className="text-[9px] text-current/60 truncate">{item.room}</span>
                </div>
            ) : (
                // Pink/Yellow band: compact — just the subject code (or teacher code)
                <span className="font-medium text-[10px] truncate w-full text-center">{label}</span>
            )}
        </div>
    );
}
```

#### Export

```ts
export { BAND_HEIGHT };
```

### Key design decisions

1. **Green band shows full detail** because teacher is the anchor — the user is building their schedule.
2. **Pink/yellow bands show compact labels** to save space. The subject code tells you "this slot is taken." Click for full details via the existing OverlayInspectPopover.
3. **Empty bands are transparent** (not hidden) so the 3-band structure keeps consistent height. The white space communicates "this entity is free."
4. Each band is independently clickable. The `onBandClick` callback tells the parent which entity was clicked so the popover can be scoped.

---

## Phase 3: Wire `ThreeBandCell` into `TimetableGridV2`

### File: `_components/TimetableGridV2.tsx`

#### 3a. Import

```ts
import ThreeBandCell, { BAND_HEIGHT } from './ThreeBandCell';
```

#### 3b. Update `cellHeight` for overlay mode

Currently: `const cellHeight = 3 * ROW_HEIGHT;` (always 96px).  
Keep the same — `BAND_HEIGHT` === `ROW_HEIGHT` === 32, so `3 * 32 = 96`. No change needed.

#### 3c. Update the Info column labels for View All

Currently `visibleLabels` for View All defaults to `['Subject', 'Class', 'Room']`.

Change to:

```ts
if (viewMode === 'all') return ['Teacher', 'Class', 'Room'];
```

This matches the 3 bands: green=Teacher, pink=Class, yellow=Room.

#### 3d. Replace cell rendering for overlay mode

In the `{SLOTS.map((slot, si) => { ... })}` block, where it currently builds `rows` and renders `<UnifiedScheduleCell mode="overlay">`:

**Replace the overlay path** (when `isOverlay && overlayCell`) with:

```tsx
const cellContent = isOverlay && overlayCell
    ? (
        <ThreeBandCell
            data={overlayCell}
            onBandClick={(entityType) => onBandClick?.(day, slot, entityType, overlayCell)}
            onEmptyClick={() => onCellClick?.(day, slot)}
        />
    )
    : (
        <UnifiedScheduleCell
            mode="individual"
            rows={buildRowsForMode(viewMode, cellData)}
            variant={cellData?.variant}
            onClick={() => onCellClick?.(day, slot)}
        />
    );
```

#### 3e. Add `onBandClick` to the grid's props

```ts
interface TimetableGridProps {
    scheduleData: ScheduleData;
    viewMode: ViewMode;
    onCellClick?: (day: string, slot: number) => void;
    onBandClick?: (day: string, slot: number, entityType: EntityType, data: OverlayCellData) => void;  // NEW
    overlayData?: OverlayData;
}
```

#### 3f. Drag-and-drop wrapping stays the same

`DroppableCell` wraps the new `ThreeBandCell` exactly as it wraps `UnifiedScheduleCell` today. `DraggableWrapper` wraps only when the teacher band is occupied (same logic: `isDraggable = !!overlayCell?.teacher`).

---

## Phase 4: Update `page.tsx` — Band Click Handling

### File: `page.tsx`

#### 4a. New state for band-click popover

```ts
const [bandInspect, setBandInspect] = useState<{
    day: string;
    slot: number;
    entityType: EntityType;
    data: OverlayCellData;
} | null>(null);
```

#### 4b. New handler

```ts
const handleBandClick = (day: string, slot: number, entityType: EntityType, data: OverlayCellData) => {
    // If teacher band is clicked and it has data, open edit/inspect
    // If class/room band is clicked, open the inspect popover scoped to that entity
    const item = entityType === 'teacher' ? data.teacher
               : entityType === 'class'  ? data.class
               : data.room;

    if (!item) return; // band was empty, nothing to inspect

    // Open popover showing that entity's details
    setBandInspect({ day, slot, entityType, data });
};
```

#### 4c. Pass to grid

```tsx
<TimetableGridV2
    scheduleData={activeSchedule}
    viewMode={viewMode}
    onCellClick={handleCellClick}
    onBandClick={handleBandClick}          // NEW
    overlayData={viewMode === 'all' ? overlayData : undefined}
/>
```

#### 4d. Update `handleCellClick` for View All

Currently it opens `OverlayInspectPopover` for occupied cells. With the new design, band clicks handle occupied cells. `handleCellClick` in View All should ONLY fire for **all-free cells** (opening EditOverlay to create new). The `ThreeBandCell.onEmptyClick` already ensures this.

Simplify:

```ts
const handleCellClick = (day: string, slot: number) => {
    if (viewMode === 'all') {
        const cellData = overlayData?.[day]?.[slot];
        if (cellData?.allFree) {
            // All 3 free → open edit to create new lesson
            setEditingParams({ day, slot });
            setEditingItem(null);
            setIsModalOpen(true);
        }
        // If not all free, do nothing — band clicks handle the interaction
        return;
    }
    // Individual views — open read-only inspect (or do nothing since read-only)
    setEditingParams({ day, slot });
    setEditingItem(activeSchedule[day]?.[slot] ?? null);
    setIsModalOpen(true);
};
```

#### 4e. Render the band-scoped popover

Reuse or adapt `OverlayInspectPopover`. The simplest approach: pass `bandInspect` to a variant of the popover that shows only the clicked entity's details.

```tsx
{bandInspect && (
    <OverlayInspectPopover
        isOpen={true}
        onClose={() => setBandInspect(null)}
        onEdit={bandInspect.entityType === 'teacher' ? () => { /* open EditOverlay */ } : undefined}
        day={bandInspect.day}
        slot={bandInspect.slot}
        data={bandInspect.data}
        focusedEntity={bandInspect.entityType}   // NEW PROP — tells popover which entity to highlight
    />
)}
```

---

## Phase 5: Update `OverlayInspectPopover` — Focused Entity Mode

### File: `_components/OverlayInspectPopover.tsx`

#### 5a. Add optional `focusedEntity` prop

```ts
interface OverlayInspectPopoverProps {
    // ... existing props ...
    focusedEntity?: EntityType;  // NEW — if set, highlight this entity's row and dim others
}
```

#### 5b. Rendering change

When `focusedEntity` is set:
- The focused entity's `EntityRow` renders at full opacity with a colored left border matching its band color
- Other entity rows render dimmed (opacity-50) but still visible for context
- Header shows "Teacher Detail" / "Class Detail" / "Room Detail" instead of generic "Slot Detail"

When `focusedEntity` is NOT set (backwards compat — old inspect flow):
- Show all 3 entities equally (current behavior)

---

## Phase 6: Improve `EditOverlay` — Dropdown Validation

### File: `_components/EditOverlay.tsx`

#### 6a. Replace free-text inputs with dropdowns

Import `TEACHER_CODES`, `TEACHER_META`, `CLASS_CODES`, `CLASS_META`, `ROOM_CODES`, `ROOM_META`, `SUBJECTS` from `dummyData.ts`.

Replace each `<input type="text">` with a `<select>`:

| Field | Source | Auto-fills |
|-------|--------|------------|
| T.Code | `TEACHER_CODES` dropdown | `teacherName` auto-filled from `TEACHER_META[code]` |
| Subject | `SUBJECTS` key dropdown | `subject` (Thai name) auto-filled |
| Class | `CLASS_CODES` dropdown | — |
| Room | `ROOM_CODES` dropdown | `roomName` auto-filled from `ROOM_META[code]` |

#### 6b. Read-only auto-filled fields

`teacherName` and `roomName` become read-only displays that update when their code dropdown changes. No free typing.

#### 6c. No conflict validation in EditOverlay itself

The conflict check happens in `page.tsx` before calling `handleModalSave`. If there's a conflict at save time, show an inline error in the modal. But with the 3-band design, the user can already SEE what's occupied before clicking, so conflicts at save time should be rare.

---

## What NOT to Change

| File | Reason |
|------|--------|
| `scheduleLogic.ts` | Already correct — pure functions, immutable updates, 3-map sync |
| `ScheduleDndProvider.tsx` | Drag-drop works. Only View All allows it. Keep as-is. |
| `TeachingSlotSidebarV2.tsx` | Sidebar workload is correct. Only shows in View All. Keep. |
| `workloadUtils.ts` | Correct. |
| `summaryUtils.ts` | Correct. |
| `schedule.types.ts` | `OverlayCellData` already has `teacher`, `class`, `room` fields — no changes needed. Only add `EntityType` import where needed (already exported). |
| `ViewModeToggle.tsx` | Correct. |
| `TimetableGridSkeleton.tsx` | Correct. |
| `FilterChip.tsx` / `FilterDropdown.tsx` | Unused. Ignore. |
| Individual view rendering in `UnifiedScheduleCell` | Keep `buildTeacherRows`, `buildClassRows`, `buildRoomRows` — they serve individual views. |
| `dummyData.ts` | Data generation is correct. |

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `_utils/overlayUtils.ts` | Edit ~5 lines (fix `allFree`, `conflictCount`) | 1 |
| `_components/ThreeBandCell.tsx` | **Create** (~120 lines) | 2 |
| `_components/TimetableGridV2.tsx` | Edit — import ThreeBandCell, add `onBandClick` prop, swap overlay cell rendering (~30 lines changed) | 3 |
| `page.tsx` | Edit — add `bandInspect` state, `handleBandClick`, simplify `handleCellClick`, pass props (~25 lines changed) | 4 |
| `_components/OverlayInspectPopover.tsx` | Edit — add `focusedEntity` prop, conditional styling (~15 lines changed) | 5 |
| `_components/EditOverlay.tsx` | Edit — replace inputs with dropdowns, auto-fill logic (~40 lines changed) | 6 |

Total: **1 new file**, **5 files edited**. ~200-250 lines of net change.