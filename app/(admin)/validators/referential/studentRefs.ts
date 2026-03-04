import { ValidationError, ValidationResult, LookupTables } from '../types';

/**
 * ST-5: "ห้องประจำ" (home room) for each student class must exist in room IDs.
 * Resolves against roomIds only — no alias/type resolution (per field spec).
 */
export function validateStudentRefs(
  studentResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...studentResult.errors];
  const warnings: ValidationError[] = [...studentResult.warnings];

  for (let i = 0; i < studentResult.parsedRows.length; i++) {
    const row = studentResult.parsedRows[i];
    const homeRoom = (row['ห้องประจำ'] ?? '').trim();
    const rowNum = i + 2;

    if (homeRoom && !lookups.roomIds.has(homeRoom)) {
      errors.push({
        row: rowNum,
        col: -1, // column index not tracked in Phase 2 row map
        column: 'ห้องประจำ',
        value: homeRoom,
        message: `Row ${rowNum}, 'ห้องประจำ': Room "${homeRoom}" not found in room tab (exact ID match required).`,
        severity: 'error',
      });
    }
  }

  return { ...studentResult, errors, warnings, valid: errors.length === 0 };
}
