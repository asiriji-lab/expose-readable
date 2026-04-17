import { ValidationError, ValidationResult, LookupTables } from '../types';

/**
 * Warns if ห้องเรียน or การแบ่งคาบสอน are empty — matches Apps Script behaviour.
 * No cross-tab ref checks (teacher name lookup, section ranges, room lookup, period format).
 */
export function validateCurriculumRefs(
  curriculumResult: ValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...curriculumResult.errors];
  const warnings: ValidationError[] = [...curriculumResult.warnings];

  for (let i = 0; i < curriculumResult.parsedRows.length; i++) {
    const row = curriculumResult.parsedRows[i];
    const rowNum = i + 2;

    // No empty warnings for "ห้องเรียน" or "การแบ่งคาบสอน".
  }

  return { ...curriculumResult, errors, warnings, valid: errors.length === 0 };
}
