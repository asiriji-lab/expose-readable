import { TabData, ValidationError, ValidationResult } from '../types';
import { isGradeHeader } from '../utils/parsers';

const REQUIRED_HEADERS = ['รหัสวิชา', 'ครู', 'คาบ/สัปดาห์'];

/**
 * CU-1: Required columns present (รหัสวิชา, ครู, คาบ/สัปดาห์).
 * CU-2: Grade-header rows (ม.1–ม.6) are structural — skipped.
 * CU-3: "คาบ/สัปดาห์" must be a positive integer on data rows.
 * _grade is injected into each parsedRow for use in Phase 2 (CU-4 class range validation).
 */
export function validateCurriculum(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'curriculum',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "curriculum" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => h.trim());

  // CU-1: Required headers
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { tabName: 'curriculum', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const subjectIdx = headers.indexOf('รหัสวิชา');
  const periodsIdx = headers.indexOf('คาบ/สัปดาห์');
  const parsedRows: Record<string, string>[] = [];
  let currentGrade = '';

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row.every((c) => !c.trim())) continue;

    const firstCell = (row[0] ?? '').trim();

    // CU-2: detect and skip grade header rows (e.g. "ม.1")
    if (isGradeHeader(firstCell)) {
      currentGrade = firstCell;
      continue;
    }

    const subject = (row[subjectIdx] ?? '').trim();
    const periods = (row[periodsIdx] ?? '').trim();

    // Skip rows where subject is empty (forward-fill continuation rows — validated server-side)
    if (!subject) continue;

    // CU-3: คาบ/สัปดาห์ must be a positive number (integer or decimal)
    // Only strictly enforce this on main subject rows (continuation rows might have empty periods)
    if (subject && periods && (!/^\d+(\.\d+)?$/.test(periods) || parseFloat(periods) <= 0)) {
      errors.push({
        row: r + 1, col: periodsIdx + 1, column: 'คาบ/สัปดาห์', value: periods,
        message: `Row ${r + 1}, 'คาบ/สัปดาห์': Must be a positive integer — got "${periods}"`,
        severity: 'error',
      });
    }

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = (row[i] ?? '').trim(); });
    // Inject current grade for Phase 2 class-range validation
    rowMap['_grade'] = currentGrade;
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'curriculum',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
