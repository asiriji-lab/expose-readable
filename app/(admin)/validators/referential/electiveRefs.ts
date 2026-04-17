import { ValidationError, ValidationResult, LookupTables } from '../types';

/**
 * Warns if ครูผู้สอน or ห้องเรียน are empty — matches Apps Script behaviour.
 * No cross-tab ref checks (teacher name lookup, room lookup, slot column check).
 */
export function validateElectiveRefs(
  electiveResult: ValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...electiveResult.errors];
  const warnings: ValidationError[] = [...electiveResult.warnings];

  for (let i = 0; i < electiveResult.parsedRows.length; i++) {
    const row = electiveResult.parsedRows[i];
    const rowNum = i + 2;

    if (!row['ครูผู้สอน']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'ครูผู้สอน', value: '', message: `Row ${rowNum}, 'ครูผู้สอน': ไม่ได้ระบุครูผู้สอน`, severity: 'warning' });
    }
    if (!row['ห้องเรียน']?.trim()) {
      warnings.push({ row: rowNum, col: -1, column: 'ห้องเรียน', value: '', message: `Row ${rowNum}, 'ห้องเรียน': ไม่ได้ระบุห้องเรียน`, severity: 'warning' });
    }
  }

  return { ...electiveResult, errors, warnings, valid: errors.length === 0 };
}
