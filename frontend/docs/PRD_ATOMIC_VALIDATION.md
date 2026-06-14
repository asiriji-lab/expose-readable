# PRD: Atomic Data Validation & Multi-Value Support

## 1. Goal
To enable robust validation for cells containing multiple values (co-teachers, multiple rooms) and to eliminate false-positive errors caused by manual entry "noise" (like trailing commas).

## 2. Success Criteria
1.  **Zero False Positives:** Input like `"ภฤศรินทร์,"` must be recognized as valid if `"ภฤศรินทร์"` exists in the system.
2.  **Multi-Teacher Support:** Input like `"Teacher A, Teacher B"` must validate both individuals against the teacher list.
3.  **Code Parity:** The logic must be identical in both the Next.js backend and the Google Spreadsheet.

## 3. Technical Implementation Plan (Stage 1: TypeScript)

### Step 1: Centralized Helper (`utils/parsers.ts`)
Implement `splitAndSanitize(input: string): string[]`:
- Split by comma (standard separator).
- Trim each resulting string.
- Run existing `sanitize()` (stripping BOM/zero-width).
- Strip trailing punctuation (`,`, `;`).
- Filter out empty strings.

### Step 2: Referential Logic Update (`curriculumRefs.ts`, `electiveRefs.ts`)
Refactor the Teacher and Room checks:
```typescript
const entities = splitAndSanitize(cellValue);
for (const entity of entities) {
  if (!isValid(entity)) {
    // Report specific error for this sub-entity
  }
}
```

### Step 3: Source of Truth Sanitization (`lookups.ts`)
Ensure that the lookup tables themselves are built using the same `sanitize()` logic to guarantee a perfect 1:1 match.

## 4. Technical Debt Considerations
- **Centralization:** Do NOT use `.split(',')` directly in the validators. Always use the helper.
- **Error Messaging:** Ensure error messages are clear. Instead of "Invalid name," say "Teacher 'X' not found in the system."

## 5. Risk Assessment
- **Performance:** Splitting and sanitizing every cell adds negligible overhead for typical school data sizes (< 5,000 rows).
- **Format Conflict:** We must ensure that valid teacher names or room IDs don't naturally contain commas (unlikely in this context).
