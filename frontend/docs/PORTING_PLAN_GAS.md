# Porting Plan: Stage 2 (Google Apps Script)

## 1. Goal
Achieve 100% logic parity between the TypeScript "Master Template" and the Google Spreadsheet Script. This enables the spreadsheet to handle co-teachers, multiple rooms, and manual entry noise (trailing commas) automatically.

## 2. Implementation Steps

### Step 1: Core Utilities (`parsers.gs`)
- **Action:** Update `sanitize(val)` to strip trailing punctuation (`[,;]+$`).
- **Action:** Add `splitAndSanitize(input)` using the regex ` /[,;\n\r]|\s+\/\s+/ ` to handle multiple teachers and the `"ROOM1 / ROOM2"` format.

### Step 2: Referential Engine (`validators.gs`)
- **Action:** Implement `buildGASLookups(allData)`. This builds the "Brain" of the script by scanning the Teacher, Room, and Student tabs.
- **Action:** Port `validateCurriculumRefs`, `validateElectiveRefs`, and `validateStudentRefs`.
- **Logic:** These functions will now:
    1.  Get the cell value.
    2.  `splitAndSanitize` it into a list.
    3.  Check every item in that list against the "Brain."
    4.  Report specific errors (e.g., "Teacher 'X' not found").

### Step 3: Orchestration (`Code.gs`)
- **Action:** Refactor `runValidation()` into a two-pass system.
- **Pass 1:** Read all sheets into an `allData` object and perform structural checks.
- **Pass 2:** Build lookups from `allData` and perform referential checks.
- **Action:** Update `applyHighlights` to be "Marker Row Aware" (don't color documentation rows green).

## 3. Success Verification
1.  Open Google Sheet.
2.  Enter `"ภฤศรินทร์,"` in a Curriculum row.
3.  Enter `"COM1 / COM2"` in a Room column.
4.  Run **Schooldoo > Validate All Tabs**.
5.  **Result:** Rows should turn **Green** (indicating the noise was stripped and multiple values were validated correctly).
