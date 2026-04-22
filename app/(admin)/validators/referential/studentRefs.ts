import { ValidationError, ValidationResult, LookupTables } from '../types';
import { splitAndSanitize } from '../utils/parsers';
import { resolveRoom } from './lookups';

/**
 * ST-5: Validate homeroom (ห้องประจำ) exists if specified. Supports multiple rooms.
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

    const rooms = splitAndSanitize(row['ห้องประจำ']);

    // 1. Homeroom Check
    for (const rRef of rooms) {
      if (!resolveRoom(rRef, lookups)) {
        errors.push({
          row: rowNum, col: -1, column: 'ห้องประจำ', value: rRef,
          message: `Row ${rowNum}, 'ห้องประจำ': ไม่พบห้อง "${rRef}" ในระบบ`,
          severity: 'error'
        });
      }
    }
  }

  return { ...studentResult, errors, warnings, valid: errors.length === 0 };
}
