import { ValidationError, ValidationResult, LookupTables } from '../types';
import { fuzzyMatchTeacher, splitAndSanitize } from '../utils/parsers';
import { resolveRoom } from './lookups';

/**
 * EL-3: Validate teacher exists (fuzzy suggest if not). Supports multiple teachers.
 * EL-4: Validate room exists (IDs or Notes). Supports multiple rooms.
 * EL-5: (Warning) If ครูผู้สอน or ห้องเรียน are empty.
 */
export function validateElectiveRefs(
  electiveResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...electiveResult.errors];
  const warnings: ValidationError[] = [...electiveResult.warnings];

  const teacherNames = lookups.teacherNames;

  for (let i = 0; i < electiveResult.parsedRows.length; i++) {
    const row = electiveResult.parsedRows[i];
    const rowNum = i + 2;

    const rawTeachers = row['ครูผู้สอน'];
    const rawRooms    = row['ห้องเรียน'];

    // 1. Teacher Check
    if (!rawTeachers) {
      warnings.push({ 
        row: rowNum, col: -1, column: 'ครูผู้สอน', value: '', 
        message: `Row ${rowNum}, 'ครูผู้สอน': ไม่ได้ระบุครูผู้สอน`, 
        severity: 'warning' 
      });
    } else {
      const teachers = splitAndSanitize(rawTeachers);
      for (const t of teachers) {
        if (!teacherNames.includes(t)) {
          const suggestion = fuzzyMatchTeacher(t, teacherNames);
          errors.push({
            row: rowNum, col: -1, column: 'ครูผู้สอน', value: t,
            message: `Row ${rowNum}, 'ครูผู้สอน': ไม่พบชื่อครู "${t}" ในระบบ`,
            severity: 'error',
            suggestion: suggestion ?? undefined
          });
        }
      }
    }

    // 2. Room Check
    if (!rawRooms) {
      warnings.push({ 
        row: rowNum, col: -1, column: 'ห้องเรียน', value: '', 
        message: `Row ${rowNum}, 'ห้องเรียน': ไม่ได้ระบุห้องเรียน`, 
        severity: 'warning' 
      });
    } else {
      const rooms = splitAndSanitize(rawRooms);
      for (const rRef of rooms) {
        if (!resolveRoom(rRef, lookups)) {
          errors.push({
            row: rowNum, col: -1, column: 'ห้องเรียน', value: rRef,
            message: `Row ${rowNum}, 'ห้องเรียน': ไม่พบห้อง "${rRef}" ในระบบ`,
            severity: 'error'
          });
        }
      }
    }
  }

  return { ...electiveResult, errors, warnings, valid: errors.length === 0 };
}
