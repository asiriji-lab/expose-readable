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

    if (!row['ห้องเรียน']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'ห้องเรียน', value: '', message: `Row ${rowNum}, 'ห้องเรียน': ไม่ได้ระบุห้องเรียน`, severity: 'warning' });
    }
    if (!row['การแบ่งคาบสอน']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'การแบ่งคาบสอน', value: '', message: `Row ${rowNum}, 'การแบ่งคาบสอน': ไม่ได้ระบุการแบ่งคาบ`, severity: 'warning' });
    }
  }

  return { ...curriculumResult, errors, warnings, valid: errors.length === 0 };
}
