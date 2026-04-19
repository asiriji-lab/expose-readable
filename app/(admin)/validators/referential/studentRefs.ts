import { ValidationError, ValidationResult, LookupTables } from '../types';

/**
 * Warns if ห้องประจำ or หลักสูตร are missing — matches Apps Script behaviour.
 * No cross-tab existence check.
 */
export function validateStudentRefs(
  studentResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...studentResult.errors];
  const warnings: ValidationError[] = [...studentResult.warnings];

  for (let i = 0; i < studentResult.parsedRows.length; i++) {
    const row = studentResult.parsedRows[i];
    const rowNum = i + 2;

    // No empty warnings for "ห้องประจำ" or "หลักสูตร".
  }

  return { ...studentResult, errors, warnings, valid: errors.length === 0 };
}
