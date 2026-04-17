# View All — Data Mapping

## Filter → Cell Relationship

The admin selects 3 filters:

| Filter | Example | Selects |
|--------|---------|---------| 
| **T. code** | `0301` | A specific teacher's schedule |
| **Class** | `6/15` | A specific class/student group's schedule |
| **Room** | `7401` | A specific room's schedule |

---

## Core Entity: `ScheduleItem`

Every occupied slot — regardless of view mode — is one `ScheduleItem`:

```ts
ScheduleItem {
  teacher:     string  // teacher code   e.g. "0301"
  teacherName: string  // Thai full name  e.g. "ธนาวันทร์"
  classCode:   string  // class          e.g. "6/15"
  room:        string  // room code      e.g. "7401"
  roomName:    string  // room name      e.g. "Computer room"
  subjectCode: string  // subject code   e.g. "อ21345"
  subject:     string  // Thai name
}
```

One `ScheduleItem` = one assigned lesson occupying one `(day, slot)`.

---

## Dataset Shape: `FullDataset`

```
FullDataset
  ├── teachers  →  Map<teacherCode, Map<day, Map<slot, ScheduleItem>>>
  ├── classes   →  Map<classCode,   Map<day, Map<slot, ScheduleItem>>>
  └── rooms     →  Map<roomCode,    Map<day, Map<slot, ScheduleItem>>>
```

> All 3 maps index the **same `ScheduleItem` objects**, just from different angles.
> `teachers["0301"]["MON"][2]` and `classes["6/15"]["MON"][2]` return the **same item** if that teacher is teaching that class at that slot.

---

## View Modes

### `View All` — Three independent lookups overlaid

All 3 filters (teacher, class, room) are active.
Each cell composites 3 separate schedule lookups at the same `(day, slot)`.

```
Cell (day, slot)
  ├── Subject row  ←  teachers[tCode][day][slot].subjectCode   (teacher's POV)
  ├── Class row    ←  classes[classCode][day][slot].classCode  (class's POV)
  └── Room row     ←  rooms[roomCode][day][slot].room           (room's POV)
```

| Subject | Class | Room | Meaning |
|---------|-------|------|---------|
| อ21345  | 6/15  | 7401 | All 3 busy — the teacher, class, and room are all occupied (likely the same lesson) |
| อ21345  | —     | —    | Only teacher is busy. The selected class and room are free that slot. |
| —       | 6/15  | 7401 | Teacher is free. The selected class and room are occupied by another teacher. |
| —       | —     | —    | All 3 are free. |

**Conflict:** if `conflictCount >= 2`, cell shows red bg + ⚠ badge.

---

### `Teacher View` — Single entity, full detail

Filter: `T. code` only.
Lookup: `teachers[tCode][day][slot]`

| Row | Content | Source Field |
|-----|---------|-------------|
| Subject | `● subjectCode` | `item.subjectCode` |
| Class | `classCode` | `item.classCode` |
| Room | `room code` | `item.room` |

The teacher is the anchor. Each slot shows **what that teacher teaches**, **to which class**, **in which room**.

---

### `Class View` — Single entity, full detail

Filter: `Class` only.
Lookup: `classes[classCode][day][slot]`

| Row | Content | Source Field |
|-----|---------|-------------|
| Subject | `● subjectCode` | `item.subjectCode` |
| Teacher | `teacherName` | `item.teacherName` |
| Room | `room code` | `item.room` |

The class is the anchor. Each slot shows **what subject the class is studying**, **who teaches it**, **where**.

---

### `Room View` — Single entity, full detail

Filter: `Room` only.
Lookup: `rooms[roomCode][day][slot]`

| Row | Content | Source Field |
|-----|---------|-------------|
| Subject | `● subjectCode` | `item.subjectCode` |
| Teacher | `teacherName` | `item.teacherName` |
| Class | `classCode` | `item.classCode` |

The room is the anchor. Each slot shows **what is being taught in the room**, **by whom**, **for which class**.

---

## Row Labels By View Mode

| View | Row 1 | Row 2 | Row 3 |
|------|-------|-------|-------|
| **View All** | Subject | Class | Room |
| **Teacher** | Subject | Class | Room |
| **Class** | Subject | Teacher | Room |
| **Room** | Subject | Teacher | Class |

> Row 1 is always **Subject**. Row 2 and 3 swap between **Teacher**, **Class**, and **Room** depending on which entity is the anchor (the anchor is omitted from the cell since it's already the filter).

---

## Data Flow Summary

```
Filters
  tCode, classCode, roomCode
         │
         ▼
  page.tsx reads filter state
         │
         ├── teacherSchedule = dataset.teachers[tCode]
         ├── classSchedule   = dataset.classes[classCode]
         └── roomSchedule    = dataset.rooms[roomCode]
                  │
                  ▼
          computeOverlayData()
          For each (day, slot):
             OverlayCellData {
               teacher:       teacherSchedule[day][slot]
               class:         classSchedule[day][slot]
               room:          roomSchedule[day][slot]
               conflictCount: N entities that are non-undefined
               allFree:       all 3 are undefined
             }
                  │
                  ▼
          OverlayCellDisplay renders rows
```

---

## Summary Row (All Views)

| Label | Source | Shows |
|-------|--------|-------|
| **Subject** | slot's `subjectCode` across 5 days | Unique subject count per slot |
| **Class** or **Teacher** | slot's second entity across 5 days | Unique count per slot |
| **Total** | all entities | Filled slots / 5 (e.g. `3/5`) |

---

## Sidebar (Teaching Slots — View All & Teacher View)

Populated from the selected teacher's **unscheduled assignments**.
Each card contains `{ subjectCode, classCode, roomCode }`.
Dragging a card onto a grid cell assigns that lesson to `(day, slot)`.
