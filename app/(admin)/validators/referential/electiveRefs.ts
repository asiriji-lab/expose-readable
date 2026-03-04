import { ValidationError, ValidationResult, LookupTables } from '../types';
import { resolveRoom } from './lookups';
import { fuzzyMatch } from '../utils/levenshtein';

// Static columns in elective tab — anything beyond these is a slot column
const STATIC_ELECTIVE_COLS = new Set(['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน']);

/**
 * EL-3: Dynamic slot column headers must match a slot name in preplace tab (ชื่อ column).
 * EL-4: "ครูผู้สอน" must match a known teacher first name (fuzzy).
 * EL-5: "ห้องเรียน" must resolve via 3-way room lookup.
 */
export function validateElectiveRefs(
  electiveResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...electiveResult.errors];
  const warnings: ValidationError[] = [...electiveResult.warnings];

  if (electiveResult.parsedRows.length === 0) {
    return { ...electiveResult, errors, warnings };
  }

  const headers = Object.keys(electiveResult.parsedRows[0]);

  // EL-3: slot column headers must exist in preplace slots
  for (const h of headers) {
    if (STATIC_ELECTIVE_COLS.has(h)) continue;
    if (!lookups.preplaceSlots.has(h)) {
      errors.push({
        row: 1,
        col: headers.indexOf(h) + 1,
        column: h,
        value: h,
        message: `Column header "${h}" is not a known slot name from preplace tab.`,
        severity: 'error',
      });
    }
  }

  for (let i = 0; i < electiveResult.parsedRows.length; i++) {
    const row = electiveResult.parsedRows[i];
    const rowNum = i + 2;

    // EL-4: teacher ref (ครูผู้สอน)
    const teacher = (row['ครูผู้สอน'] ?? '').trim();
    if (teacher) {
      const matchById   = lookups.teacherIds.has(teacher);
      const matchByName = lookups.teacherNames.some((n) => n === teacher);
      if (!matchById && !matchByName) {
        const suggestion = fuzzyMatch(teacher, lookups.teacherNames);
        errors.push({
          row: rowNum,
          col: headers.indexOf('ครูผู้สอน') + 1,
          column: 'ครูผู้สอน',
          value: teacher,
          message: `Row ${rowNum}, 'ครูผู้สอน': Teacher "${teacher}" not found in teacher tab.`,
          severity: 'error',
          suggestion: suggestion ?? undefined,
        });
      }
    }

    // EL-5: room ref (3-way)
    const room = (row['ห้องเรียน'] ?? '').trim();
    if (room && !resolveRoom(room, lookups)) {
      errors.push({
        row: rowNum,
        col: headers.indexOf('ห้องเรียน') + 1,
        column: 'ห้องเรียน',
        value: room,
        message: `Row ${rowNum}, 'ห้องเรียน': Room "${room}" not found (not a room ID, alias, or type).`,
        severity: 'error',
      });
    }
  }

  return { ...electiveResult, errors, warnings, valid: errors.length === 0 };
}
