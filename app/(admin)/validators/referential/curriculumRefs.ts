import { ValidationError, ValidationResult, LookupTables } from '../types';
import { fuzzyMatchTeacher, parseStudentClassString, splitAndSanitize } from '../utils/parsers';
import { resolveRoom } from './lookups';

/**
 * CU-4: Validate teacher exists (fuzzy suggest if not). Supports multiple teachers.
 * CU-5: Validate room exists (IDs or Notes). Supports multiple rooms.
 * CU-6: Validate student section range exists for the specified grade.
 */
export function validateCurriculumRefs(
  curriculumResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...curriculumResult.errors];
  const warnings: ValidationError[] = [...curriculumResult.warnings];

  const teacherNames = lookups.teacherNames;

  for (let i = 0; i < curriculumResult.parsedRows.length; i++) {
    const row = curriculumResult.parsedRows[i];
    const rowNum = i + 2;

    // 1. Teacher Check (Supports multiple)
    const teachers = splitAndSanitize(row['ครู']);
    for (const t of teachers) {
      if (!teacherNames.includes(t)) {
        const suggestion = fuzzyMatchTeacher(t, teacherNames);
        errors.push({
          row: rowNum, col: -1, column: 'ครู', value: t,
          message: `Row ${rowNum}, 'ครู': ไม่พบชื่อครู "${t}" ในระบบ`,
          severity: 'error',
          suggestion: suggestion ?? undefined
        });
      }
    }

    // 2. Room Check (Supports multiple)
    const rooms = splitAndSanitize(row['ห้องเรียน']);
    for (const rRef of rooms) {
      if (!resolveRoom(rRef, lookups)) {
        errors.push({
          row: rowNum, col: -1, column: 'ห้องเรียน', value: rRef,
          message: `Row ${rowNum}, 'ห้องเรียน': ไม่พบห้อง "${rRef}" ในระบบ`,
          severity: 'error'
        });
      }
    }

    // 3. Class Range Check (CU-4)
    const classRangeStr = (row['ห้อง (นักเรียน) ที่สอน'] ?? '').trim();
    const grade = (row['_grade'] ?? '').trim();
    if (classRangeStr && grade) {
      const sections = parseStudentClassString(classRangeStr);
      const validSections = lookups.gradeToSections.get(grade);
      
      if (!validSections) {
        errors.push({
          row: rowNum, col: -1, column: 'ห้อง (นักเรียน) ที่สอน', value: classRangeStr,
          message: `Row ${rowNum}, 'ห้อง (นักเรียน) ที่สอน': ไม่พบข้อมูลนักเรียนชั้น ${grade} ในระบบ`,
          severity: 'error'
        });
      } else {
        const missing = sections.filter(s => !validSections.has(s));
        if (missing.length > 0) {
          errors.push({
            row: rowNum, col: -1, column: 'ห้อง (นักเรียน) ที่สอน', value: classRangeStr,
            message: `Row ${rowNum}, 'ห้อง (นักเรียน) ที่สอน': ห้อง /${missing.join(', /')} ไม่มีอยู่ในชั้น ${grade}`,
            severity: 'error'
          });
        }
      }
    }
  }

  return { ...curriculumResult, errors, warnings, valid: errors.length === 0 };
}
