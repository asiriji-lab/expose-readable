import { TabData, ValidationError, ValidationResult } from '../types';
import { isMarkerRow, sanitize } from '../utils/parsers';

const REQUIRED_HEADERS = ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน'];

/** Section-header rows in elective.csv (e.g. "เสรีม.ต้น", "เสรีม.ปลาย") are structural dividers. */
const ELECTIVE_SECTION_HEADER = /^เสรีม\.(ต้น|ปลาย)$/;

/**
 * EL-1: Required columns present (รหัสวิชา, ชื่อวิชา (เสรี), ครูผู้สอน, ห้องเรียน).
 * EL-2: Skip rows where รหัสวิชา matches section-header pattern.
 * Referential checks (EL-3/4/5) run in Phase 2.
 */
export function validateElective(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'elective',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "elective" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => sanitize(h));

  // EL-1: Required headers
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { tabName: 'elective', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const subjectIdx = headers.indexOf('รหัสวิชา');
  const parsedRows: Record<string, string>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row.every((c) => !sanitize(c))) continue;
    if (isMarkerRow(row)) continue;

    const subjectId = sanitize(row[subjectIdx]);

    // EL-2: skip section header rows e.g. "เสรีม.ต้น"
    if (ELECTIVE_SECTION_HEADER.test(subjectId)) continue;

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = sanitize(row[i]); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'elective',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
