import { ValidationError, ValidationResult, LookupTables } from '../types';
import { fuzzyMatchTeacher, splitAndSanitize } from '../utils/parsers';

/**
 * SC-2: Validate every cell value (Teacher names) against the teacher tab.
 * Supports multiple teachers in a single cell.
 */
export function validateScoutRefs(
  scoutResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...scoutResult.errors];
  const warnings: ValidationError[] = [...scoutResult.warnings];

  const teacherNames = lookups.teacherNames;

  // Scout is a sparse matrix where every non-empty cell is expected to be a teacher name
  for (let i = 0; i < scoutResult.parsedRows.length; i++) {
    const row = scoutResult.parsedRows[i];
    const rowNum = i + 2;

    // Iterate over all keys in the row (column headers)
    Object.keys(row).forEach((colName) => {
      // Internal grade markers start with underscore
      if (colName.startsWith('_')) return;

      const cellValue = row[colName];
      const teachers = splitAndSanitize(cellValue);

      for (const t of teachers) {
        if (!teacherNames.includes(t)) {
          const suggestion = fuzzyMatchTeacher(t, teacherNames);
          errors.push({
            row: rowNum, col: -1, column: colName, value: t,
            message: `Row ${rowNum}, '${colName}': ไม่พบชื่อครู "${t}" ในระบบ`,
            severity: 'error',
            suggestion: suggestion ?? undefined
          });
        }
      }
    });
  }

  return { ...scoutResult, errors, warnings, valid: errors.length === 0 };
}
