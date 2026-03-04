import { ValidationError, ValidationResult, LookupTables } from '../types';
import { resolveRoom } from './lookups';
import { fuzzyMatch } from '../utils/levenshtein';
import { parseStudentClassString } from '../utils/parsers';

/**
 * CU-3: "ครู" — split on ", " → each token must match a known teacher first name (fuzzy).
 * CU-4: "ห้อง (นักเรียน) ที่สอน" — parse /N and /N-M ranges → each section must exist
 *        in gradeToSections[_grade] (grade is injected by Phase 1).
 * CU-5: "ห้องเรียน" — split on " / " → each token must resolve via 3-way room lookup.
 * CU-6: "คาบเรียน" — if present, must be a known preplace slot or match DAY_N-DAY_M.
 */
export function validateCurriculumRefs(
  curriculumResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...curriculumResult.errors];
  const warnings: ValidationError[] = [...curriculumResult.warnings];

  if (curriculumResult.parsedRows.length === 0) {
    return { ...curriculumResult, errors, warnings };
  }

  for (let i = 0; i < curriculumResult.parsedRows.length; i++) {
    const row = curriculumResult.parsedRows[i];
    const rowNum = i + 2;

    // CU-3: teacher column — may be multi-value (comma-separated first names)
    const teacherRaw = (row['ครู'] ?? '').trim();
    if (teacherRaw && teacherRaw !== '-') {
      const tokens = teacherRaw.split(',').map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        const matchById   = lookups.teacherIds.has(token);
        const matchByName = lookups.teacherNames.some((n) => n === token);
        if (!matchById && !matchByName) {
          const suggestion = fuzzyMatch(token, lookups.teacherNames);
          errors.push({
            row: rowNum,
            col: -1,
            column: 'ครู',
            value: token,
            message: `Row ${rowNum}, 'ครู': Teacher "${token}" not found in teacher tab.`,
            severity: 'error',
            suggestion: suggestion ?? undefined,
          });
        }
      }
    }

    // CU-4: student class ranges — e.g. "/1, /3-5" validated against grade sections
    const classRaw = (row['ห้อง (นักเรียน) ที่สอน'] ?? '').trim();
    const grade    = (row['_grade'] ?? '').trim();
    if (classRaw && grade) {
      const sections       = parseStudentClassString(classRaw);
      const knownSections  = lookups.gradeToSections.get(grade) ?? new Set<number>();
      for (const sec of sections) {
        if (!knownSections.has(sec)) {
          errors.push({
            row: rowNum,
            col: -1,
            column: 'ห้อง (นักเรียน) ที่สอน',
            value: `/${sec}`,
            message: `Row ${rowNum}, 'ห้อง (นักเรียน) ที่สอน': Section /${sec} is not defined for ${grade}. (Defined: ${[...knownSections].sort((a,b)=>a-b).map(s=>`/${s}`).join(', ')})`,
            severity: 'error',
          });
        }
      }
    }

    // CU-5: room column — may be multi-value (slash-separated)
    const roomRaw = (row['ห้องเรียน'] ?? '').trim();
    if (roomRaw && roomRaw !== '-') {
      const tokens = roomRaw.split('/').map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        if (!resolveRoom(token, lookups)) {
          warnings.push({
            row: rowNum,
            col: -1,
            column: 'ห้องเรียน',
            value: token,
            message: `Row ${rowNum}, 'ห้องเรียน': Room "${token}" could not be resolved (not a room ID, alias, or type). May be handled by backend.`,
            severity: 'warning',
          });
        }
      }
    }

    // CU-6: fixed period — if present, must be a valid DAY_N-DAY_M format
    const fixedPeriod = (row['คาบเรียน'] ?? '').trim();
    if (fixedPeriod && !/^(MON|TUE|WED|THU|FRI)_\d+-(MON|TUE|WED|THU|FRI)_\d+$/.test(fixedPeriod)) {
      errors.push({
        row: rowNum,
        col: -1,
        column: 'คาบเรียน',
        value: fixedPeriod,
        message: `Row ${rowNum}, 'คาบเรียน': Invalid fixed period "${fixedPeriod}". Expected DAY_N-DAY_M (e.g. MON_9-MON_10).`,
        severity: 'error',
      });
    }
  }

  return {
    ...curriculumResult,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}
