import { ValidationError, ValidationResult, LookupTables } from '../types';
import { fuzzyMatch } from '../utils/levenshtein';

/**
 * SC-2: Every non-empty cell in the scout matrix is a teacher first name.
 * Checks ALL cells across ALL columns (sparse matrix — no fixed "teacher column").
 * Uses fuzzy matching for "Did you mean?" suggestions.
 */
export function validateScoutRefs(
  scoutResult: ValidationResult,
  lookups: LookupTables
): ValidationResult {
  const errors: ValidationError[] = [...scoutResult.errors];
  const warnings: ValidationError[] = [...scoutResult.warnings];

  for (let i = 0; i < scoutResult.parsedRows.length; i++) {
    const row = scoutResult.parsedRows[i];
    const rowNum = i + 2;

    for (const [colHeader, cellValue] of Object.entries(row)) {
      const name = cellValue.trim();
      if (!name) continue;

      const matchById   = lookups.teacherIds.has(name);
      const matchByName = lookups.teacherNames.some((n) => n === name);

      if (!matchById && !matchByName) {
        const suggestion = fuzzyMatch(name, lookups.teacherNames);
        errors.push({
          row: rowNum,
          col: -1,
          column: colHeader,
          value: name,
          message: `Row ${rowNum}, '${colHeader}': Teacher "${name}" not found in teacher tab.`,
          severity: 'error',
          suggestion: suggestion ?? undefined,
        });
      }
    }
  }

  return { ...scoutResult, errors, warnings, valid: errors.length === 0 };
}
