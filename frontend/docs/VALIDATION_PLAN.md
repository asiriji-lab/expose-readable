# TypeScript Referential Validation Plan

## 1. Core Utilities (`app/(admin)/validators/utils/parsers.ts`)
- **`sanitize(str: string)`**: Create a helper to strip zero-width characters (BOM, ZWSP) and trim whitespace, mirroring the GAS `_str` function.
- **`isMarkerRow(row: string[])`**: Implement the logic to detect and skip decorative rows (e.g., rows where only the first cell has content and it ends with a colon, like "กลุ่มสาระ:").
- **`fuzzyMatchTeacher(name: string, validNames: string[])`**: Create a utility to suggest correct teacher names if a slight typo is detected (e.g., suggesting "สมชาย แซ่ดี" when the user typed "สมชาย").

## 2. Structural Validator Updates
- Inject the new `isMarkerRow` check into all structural validators (`curriculum.ts`, `room.ts`, `teacher.ts`, `student.ts`, `elective.ts`, `period.ts`, `preplace.ts`) to ensure decorative rows are safely ignored and don't trigger false-positive formatting errors.
- Ensure all raw cell data is passed through the new `sanitize()` helper before validation.

## 3. Implement Referential Validators (The "Bridge")
- **`curriculumRefs.ts`**:
    - Validate the "ครู" column: Ensure the teacher exists in `lookups.teacherNames` (using `fuzzyMatchTeacher` if not found).
    - Validate the "ห้องเรียน" column: Ensure the room exists using `resolveRoom(val, lookups)`.
    - Validate "ห้อง (นักเรียน) ที่สอน" (Class range, e.g., "1-3"): Ensure these sections actually exist for the row's `_grade` in `lookups.gradeToSections`.
- **`electiveRefs.ts`**:
    - Validate "ครูผู้สอน": Check against `lookups.teacherNames`.
    - Validate "ห้องเรียน": Check against `resolveRoom`.
- **`studentRefs.ts`**:
    - Validate "ห้องประจำ": Check against `resolveRoom`.
