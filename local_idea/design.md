# Output Design for Schedool — Admin Views

## 1. Master JSON Structure

The entire schedule is stored as a single **Master Schedule JSON**. Each admin view is a different lens on the same synchronized data.

```json
{
  "config": {
    "academic_year": "2026",
    "semester": 1,
    "columns": [
      { "key": "day", "label": "Day", "type": "text" },
      { "key": "1", "label": "1", "time": "08.30-09.20" },
      { "key": "2", "label": "2", "time": "09.25-10.15" },
      { "key": "3", "label": "3", "time": "10.20-11.10" }
    ]
  },
  "teachers": [
    {
      "id": "T0001",
      "name": "Beam",
      "department": "Language Arts",
      "rows": [
        {
          "day": "MON",
          "1": { "subject": "Thai", "class": "1/1", "room": "R001" },
          "2": { "subject": "Thai", "class": "1/1", "room": "R001" },
          "3": { "subject": "Thai", "class": "1/2", "room": "R002" }
        },
        {
          "day": "TUE",
          "1": null,
          "2": { "subject": "Thai", "class": "2/1", "room": "R001" },
          "3": { "subject": "Thai", "class": "2/1", "room": "R001" }
        }
      ]
    }
  ],
  "students": [
    {
      "id": "S5501",
      "name": "Alice",
      "class_group": "1/1",
      "rows": [
        {
          "day": "MON",
          "1": { "subject": "Thai", "teacher": "Beam", "room": "R001" },
          "2": { "subject": "Thai", "teacher": "Beam", "room": "R001" },
          "3": null
        }
      ]
    }
  ],
  "rooms": [
    {
      "id": "R0001",
      "name": "Main Hall A",
      "rows": [
        {
          "day": "MON",
          "1": { "subject": "Thai", "teacher": "Beam", "class": "1/1" },
          "2": { "subject": "Thai", "teacher": "Beam", "class": "1/1" },
          "3": { "subject": "History", "teacher": "John", "class": "2/4" }
        }
      ]
    }
  ]
}
```

---

## 2. Four Admin Views

| View | Source Key | Anchor Entity | Colored Band | Perspective |
|---|---|---|---|---|
| **View All** | entire JSON | none (grid) | Green + Pink + Yellow | Unified |
| **Teacher** | `teachers[]` | Teacher | 🟢 Green | "I teach X to class Y in room Z" |
| **Class** | `students[]` | Student Class | 🩷 Pink | "We take X from teacher Y in room Z" |
| **Room** | `rooms[]` | Classroom | 🟡 Yellow | "Room occupied for X by teacher Y with class Z" |

---

## 3. Data Flow Diagram

```
┌──────────────────────────────────────────────────┐
│                  MASTER JSON                      │
│  config + teachers[] + students[] + rooms[]       │
└──────────┬───────────┬───────────┬───────────────┘
           │           │           │
     ┌─────▼─────┐ ┌──▼────┐ ┌───▼────┐
     │ View All  │ │Teacher│ │ Class  │ ┌───────┐
     │ (admin)   │ │ View  │ │ View   │ │ Room  │
     │ 3 bands   │ │ 🟢    │ │ 🩷     │ │ View  │
     │ per slot  │ │green  │ │ pink   │ │ 🟡    │
     └───────────┘ └───────┘ └────────┘ └───────┘
           │           │           │         │
           └─────── TimetableGrid ──────────┘
                  (shared component)
```

---

## 4. View Details

### 4A. View All (Master Grid)

The **bird's-eye view**. Renders every teacher's schedule sequentially. Each booked slot shows **3 colored bands**:

```
┌─────────────────────────────┐
│  🟢 Thai                    │  ← Green band  (Teacher: Beam teaches Thai)
│  🩷 1/1                     │  ← Pink band   (Class: 1/1)
│  🟡 R001                    │  ← Yellow band (Room: R001)
└─────────────────────────────┘
```

- **Empty slot** → pure white background → all 3 databases are free
- **Booked slot** → 3 colored bands → hover to see full details from each perspective
- Teachers are listed sequentially, each with their own grid section

### 4B. Teacher View — แสดงครู (Green Perspective)

User selects **one teacher** from a dropdown. Grid renders that teacher's `rows[]`.

Each booked cell shows:

```
┌─────────────────────────────┐
│  Thai           (subject)   │
│  1/1            (class)     │
│  R001           (room)      │
└─────────────────────────────┘
```

**Sentence output:** "I teach {subject} to class {class} in room {room}"

**Cell data shape:**
```json
{ "subject": "Thai", "class": "1/1", "room": "R001" }
```

### 4C. Class View — แสดงนักเรียน (Pink Perspective)

User selects **one student class** from a dropdown. Grid renders that class's `rows[]`.

Each booked cell shows:

```
┌─────────────────────────────┐
│  Thai           (subject)   │
│  Beam           (teacher)   │
│  R001           (room)      │
└─────────────────────────────┘
```

**Sentence output:** "We take {subject} from teacher {teacher} in room {room}"

**Cell data shape:**
```json
{ "subject": "Thai", "teacher": "Beam", "room": "R001" }
```

### 4D. Room View — แสดงห้องเรียน (Yellow Perspective)

User selects **one room** from a dropdown. Grid renders that room's `rows[]`.

Each booked cell shows:

```
┌─────────────────────────────┐
│  Thai           (subject)   │
│  Beam           (teacher)   │
│  1/1            (class)     │
└─────────────────────────────┘
```

**Sentence output:** "Room occupied for {subject} by teacher {teacher} with class {class}"

**Cell data shape:**
```json
{ "subject": "Thai", "teacher": "Beam", "class": "1/1" }
```

---

## 5. Slot States

| State | Background | Meaning |
|---|---|---|
| `null` | Pure white `#ffffff` | Available — teacher, class, and room are all free |
| Object present | Tinted by perspective | Booked — at least one entity is occupied |

**Tint colors by perspective:**

| Perspective | Background Tint | Hex |
|---|---|---|
| View All | White (bands are colored) | `#ffffff` |
| Teacher | Green tint | `#d4edda` |
| Class | Pink tint | `#f8d7da` |
| Room | Yellow tint | `#fff3cd` |

---

## 6. Cell Data Shape per Perspective

Each perspective only includes the fields **meaningful to that viewer**:

```
Teacher cell:  { subject, class, room     }  → teacher is implicit (it's their grid)
Student cell:  { subject, teacher, room    }  → class is implicit (it's their grid)
Room cell:     { subject, teacher, class   }  → room is implicit (it's their grid)
```

This avoids redundancy — you never store the anchor entity inside its own cell.

---

## 7. Shared Grid Component

All four views render through a single **TimetableGrid** component:

- **Input:** `config.columns` (defines periods) + `rows[]` (defines days) + `renderCell` callback
- **Output:** An HTML table where each cell delegates rendering to the view-specific callback
- Adding new periods (Period 4, 5, etc.) is purely a `config.columns` change — zero code change

---

## 8. Key Design Decisions

| Decision | Rationale |
|---|---|
| `null` = available | Empty slots render pure white, matching "white = all 3 free" rule |
| `config.columns` drives the grid | Adding periods is just a config change |
| Cell shape varies by array | Each perspective only includes what's meaningful |
| 3 bands only in View All | Individual views show a single condensed cell |
| Teacher is the anchor | Building all teacher schedules auto-completes students and rooms |
| Single source of truth | One JSON, four read-only rendering lenses |

---

## 9. File Structure

```
src/
├── types/
│   └── schedule.ts              # MasterSchedule, cell types, row types
├── components/
│   ├── shared/
│   │   └── TimetableGrid.tsx    # Shared grid (columns + rows + renderCell)
│   └── admin/
│       ├── ViewAll.tsx           # 3 colored bands per slot
│       ├── TeacherView.tsx       # Green perspective
│       ├── ClassView.tsx         # Pink perspective
│       └── RoomView.tsx          # Yellow perspective
└── styles/
    └── schedule.css             # Band colors, slot states, grid layout
```