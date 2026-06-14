import { ValidationError, ValidationResult, LookupTables } from '../types';
import { sanitize } from '../utils/parsers';

/**
 * RM-R1: 'ชั้นเรียนประจำ' must reference a class_id that exists in the student sheet.
 */
export function validateRoomRefs(
  roomResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...roomResult.errors];
  const warnings: ValidationError[] = [...roomResult.warnings];

  for (let i = 0; i < roomResult.parsedRows.length; i++) {
    const row = roomResult.parsedRows[i];
    const rowNum = i + 2;

    const classId = sanitize(row['ชั้นเรียนประจำ']);
    if (classId && !lookups.classIds.has(classId)) {
      errors.push({
        row: rowNum, col: -1, column: 'ชั้นเรียนประจำ', value: classId,
        message: `Row ${rowNum}, 'ชั้นเรียนประจำ': ไม่พบ "${classId}" ในแท็บ student`,
        severity: 'error',
      });
    }
  }

  return { ...roomResult, errors, warnings, valid: errors.length === 0 };
}
