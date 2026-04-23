# Conceptual Analysis: Missing Logic in GAS Validators

## Objective
Provide a conceptual analysis of the missing referential and structural validation logic from the TypeScript implementation (`app/(admin)/validators/`) compared to the current Google Apps Script implementation (`appscript/`). **No code changes will be executed based on this plan.**

## Key Files & Context
- `appscript/parsers.gs`: Needs fuzzy match logic (`levenshtein` and `fuzzyMatchTeacher`) and class string parsing (`parseStudentClassString`).
- `appscript/validators.gs`: Needs updates for 3-way room lookups, elective section skips, curriculum CU-4 checks, and fuzzy matching suggestions.

## Implementation Steps

### 1. Update `appscript/parsers.gs`
- **Fuzzy Matching**: Port `levenshtein` and `fuzzyMatchTeacher` to provide suggestions when teacher names are not found.
- **Class String Parsing**: Port `parseStudentClassString` to parse "ห้อง (นักเรียน) ที่สอน" values (e.g., `/1, /3-5`) into arrays of section numbers.

### 2. Update Lookups (`appscript/validators.gs`)
- Modify `buildGASLookups` to collect `roomTypes` from the "ประเภท" column in the room tab.
- Update `_resolveRoom` to perform a 3-way check: `lookups.roomIds[v] || lookups.roomNotes[v] || lookups.roomTypes[v]`.

### 3. Update Curriculum Validation (`appscript/validators.gs`)
- **Phase 2 (`validateCurriculumRefs`)**:
  - Add state to track `currentGrade` (updating when `isGradeHeader(row[0])` is true).
  - Add the **CU-4 Class Range Check**: read "ห้อง (นักเรียน) ที่สอน", parse it with `parseStudentClassString`, check against `lookups.gradeToSections[currentGrade]`, and report errors if missing.
  - Implement `fuzzyMatchTeacher` suggestion in the error output for missing teachers.

### 4. Update Elective Validation (`appscript/validators.gs`)
- **Phase 1 (`validateElective`)**: Skip rows where the "รหัสวิชา" matches the section header regex `/^เสรีม\.(ต้น|ปลาย)$/`.
- **Phase 2 (`validateElectiveRefs`)**: Skip the same section header rows. Add fuzzy matching suggestions for teacher name errors.

### 5. Update Remaining Referential Checks (`appscript/validators.gs`)
- Update `validateScoutRefs` to use `fuzzyMatchTeacher` for missing teacher name errors.

## Verification & Testing
- Load the AppScript into Google Sheets.
- Provide malformed teacher names and verify that suggestions appear in the validation output.
- Use valid room types ("ประเภท") in room columns and ensure they do not trigger errors.
- Test curriculum rows with invalid "ห้อง (นักเรียน) ที่สอน" ranges and verify that missing sections are correctly identified.
- Ensure elective section headers (e.g., `เสรีม.ต้น`) are ignored and do not trigger missing value warnings/errors.
