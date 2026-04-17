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

    if (!row['ห้องประจำ']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'ห้องประจำ', value: '', message: `Row ${rowNum}, 'ห้องประจำ': ไม่ได้ระบุห้องประจำ`, severity: 'warning' });
    }
    if (!row['หลักสูตร']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'หลักสูตร', value: '', message: `Row ${rowNum}, 'หลักสูตร': ไม่ได้ระบุหลักสูตร`, severity: 'warning' });
    }
  }

  return { ...studentResult, errors, warnings, valid: errors.length === 0 };
}
