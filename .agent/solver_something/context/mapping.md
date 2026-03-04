# ScheDool — CSV Data Mapping & Hierarchy

This document defines the relationships and referential integrity requirements between the raw Thai-language CSV files used in the scheduling process. This serves as the blueprint for the frontend validator.

---

## 1. Entity Hierarchy (Dependency Order)

Files must be validated in this order to ensure all cross-references exist.

### Layer 0: Root Definitions
*Pure standalone files. No foreign keys.*
1. **`period.csv`**: Defines the valid time slots (e.g., `1`, `2`, `Morning Break`).
2. **`room.csv`**: Defines all physical spaces, their aliases, and types.

### Layer 1: Primary Entities
*Defines people and groups. Primary keys are established here.*
3. **`teacher.csv`**: Defines `teacher_id` and names. References `period.csv` syntax in availability columns.
4. **`student.csv`**: Defines class structures. References `room.csv` for `ห้องประจำ` (Home Room).

### Layer 2: Relational Sheets
*Mapping files that connect Layer 1 entities.*
5. **`preplace.csv`**: Connects time slots to student grades/sections.
6. **`scout.csv`**: A matrix mapping teachers to scout levels. Every cell value is a Foreign Key to `teacher.csv`.
7. **`elective.csv`**: Connects subjects, teachers, and rooms. Column headers reference `preplace.csv` slot names.

### Layer 3: High-Complexity Relational
8. **`curriculum.csv`**: The master schedule requirement sheet. References almost every other file (Teachers, Rooms, Student groups, Period constraints).

---

## 2. Cross-Reference (Foreign Key) Map

| Source File | Column | Raw Value Example | Resolves To (Target) |
| :--- | :--- | :--- | :--- |
| `student.csv` | `ห้องประจำ` | `C103` | `room.csv` -> `ห้องทั้งหมด` |
| `teacher.csv` | `unavailable_slots` | `MON_6-MON_8` | `period.csv` -> Pattern `DAY_N-DAY_M` |
| `scout.csv` | (All table cells) | `วีรภัทร` | `teacher.csv` -> `ชื่อ` (First Name) |
| `elective.csv` | `ครูผู้สอน` | `วงศ์ตะวัน` | `teacher.csv` -> `ชื่อ` (First Name) |
| `elective.csv` | `ห้องเรียน` | `COM2`, `ยิม` | `room.csv` -> `ห้องทั้งหมด` OR `หมายเหตุ` OR `ประเภท` |
| `elective.csv` | (Column Headers) | `เสรีม.ต้น1` | `preplace.csv` -> `ชื่อ` |
| `curriculum.csv` | `ครู` | `ภฤศรินทร์, Coulter` | `teacher.csv` -> `ชื่อ` (Multi-value possible) |
| `curriculum.csv` | `ห้อง (นักเรียน)` | `/1, /3-5` | `student.csv` -> `ห้อง` (Filtered by current grade) |
| `curriculum.csv` | `ห้องเรียน` | `อังกฤษ`, `D205` | `room.csv` -> `ห้องทั้งหมด` OR `หมายเหตุ` OR `ประเภท` |

---

## 3. Structural Validation Rules (The "Raw" Logic)

Unlike the backend solver, the frontend validator must handle these human-centric patterns:

### A. The Room Triple-Lookup
A room reference is valid if it matches ANY of these in `room.csv`:
1. `ห้องทั้งหมด` (The ID, e.g., `A316`)
2. `หมายเหตุ` (The Alias, e.g., `COM1`)
3. `ประเภท` (The Category, e.g., `OUT`, `COM`)

### B. Curriculum Grade Markers
The `curriculum.csv` uses structural rows (e.g., `ม.1` in the first column with all other columns empty).
* **Validation Rule**: If a row contains exactly `ม.[1-6]` in column 1 and is otherwise empty, it is a **Grade Header**. All subsequent rows belong to that grade until the next header.

### C. Student Class Notation
The `curriculum.csv` column `ห้อง (นักเรียน) ที่สอน` uses shorthand like `/1, /3-5`.
* **Validation Rule**: Must be parsed against the specific sections defined in `student.csv` for the current grade.

---

## 4. Validator Strategy Proposal

1. **Step 1-8 Individual Upload**:
   - Perform **Structural Validation** only (Column names present? Cell types correct?).
   - Store raw data in state.

2. **Step 9/10 Cross-Check (Global)**:
   - Perform **Referential Validation**.
   - Build lookup maps from Uploads 1-7.
   - Sweep `curriculum.csv` (Upload 1) and `elective.csv` (Upload 3) to flag missing names, rooms, or illegal class notations.
