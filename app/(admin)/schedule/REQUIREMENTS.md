# Schedule Page — View Requirements

---

## All Views (shared)

- Filter bar always visible with 3 rows:
  - Row 1: `T. code` (dropdown) + `T. name` (read-only: prefix / first / last)
  - Row 2: `Class` (dropdown) + `Default Room` (read-only)
  - Row 3: `Room` (dropdown) + `Room name` (read-only)
- Name/room fields auto-fill from selected code — not user-editable
- View toggle in top bar: `View all | Teacher's view | Class view | Room view`

---

## Teacher's View

**Filter bar active row:** T. code + T. name

**Left labels column:**
```
Subject
Class
Room
```

**Cell content (per slot):**
| Row | Content |
|-----|---------|
| Subject | `● subjectCode` (colored dot + code, e.g. `● อ21345`) |
| Class | `classCode` (e.g. `6/15`) |
| Room | `room code` (e.g. `7401`) |

**Summary row labels:**
```
Subject
Class
Total
```

---

## Class View

**Filter bar active row:** Class + Default Room

**Left labels column:**
```
Subject
Teacher
Room
```

**Cell content (per slot):**
| Row | Content |
|-----|---------|
| Subject | `● subjectCode` |
| Teacher | `teacherName` (first name, e.g. `ธนาวันทร์`) |
| Room | `room code` |

**Summary row labels:**
```
Subject
Teacher
Total
```

---

## Room View

**Filter bar active row:** Room + Room name

**Left labels column:**
```
Subject
Teacher
Class
```

**Cell content (per slot):**
| Row | Content |
|-----|---------|
| Subject | `● subjectCode` |
| Teacher | `teacherName` |
| Class | `classCode` |

**Summary row labels:**
```
Subject
Teacher
Total
```

---

## View All

**Filter bar:** all 3 rows shown (T. code, Class, Room)

**Left labels column:**
```
Subject
Class
Room
```

**Cell content (per slot) — single assignment block:**
| Row | Content |
|-----|---------|
| Subject | `subjectCode` (bold, e.g. `อ21345`) |
| Class | `classCode` (muted, e.g. `ม.3/2`) |
| Room | `room code` (muted, e.g. `5410`) |

**Cell states:**
| State | Appearance |
|-------|------------|
| Assigned | White bg, subject bold, class + room muted |
| Empty / free | `gray-50` bg, dashed `gray-200` border, centered `—` |
| Conflict (2+ entities double-booked) | `red-50` bg, `red-400` border, `⚠` badge in corner |

**Hover tooltip:** Full details (subject name, teacher name, class, room + room name)

**Sidebar (filter-driven):**
- Populated from selected teacher's unscheduled assignments
- Each card shows: subject code, class, room
- Draggable onto grid cells

**Summary row labels:**
```
Subject
Class
Total
```

**Summary row content per slot:**
| Row | Content |
|-----|---------|
| Subject | Unique subject count across 5 days |
| Class | Unique class count across 5 days |
| Total | Filled slots out of 5 (e.g. `3/5`) |

---

## Open Questions

- [ ] Should the filter bar highlight / dim irrelevant rows based on active view mode?
- [ ] View All: keep dot/tooltip overlay style, or switch to same stacked 3-row layout?
