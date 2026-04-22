import { TabData, ValidationError, ValidationResult } from '../types';
import { isMarkerRow, isValidTimeFormat, sanitize } from '../utils/parsers';

const REQUIRED_HEADERS = ['คาบ', 'เวลา'];

/**
 * PR-1: Both "คาบ" and "เวลา" headers must be present.
 * PR-2: "คาบ" must be non-empty for every data row.
 * PR-3: "เวลา" must be either HH.MM-HH.MM or a plain integer (duration).
 */
export function validatePeriod(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'period',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "period" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => sanitize(h));

  // PR-1: Required headers
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({
        row: 1,
        col: 0,
        column: req,
        value: '',
        message: `Missing required column: "${req}"`,
        severity: 'error',
      });
    }
  }

  if (errors.length > 0) {
    return { tabName: 'period', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const periodIdx = headers.indexOf('คาบ');
  const timeIdx = headers.indexOf('เวลา');
  const parsedRows: Record<string, string>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1; // 1-based, 1 = header
    const period = sanitize(row[periodIdx]);
    const time = sanitize(row[timeIdx]);

    // skip fully empty rows
    if (!period && !time) continue;
    if (isMarkerRow(row)) continue;

    // PR-2: period label required
    if (!period) {
      errors.push({ row: rowNum, col: periodIdx + 1, column: 'คาบ', value: period, message: `Row ${rowNum}, 'คาบ': Period label is required.`, severity: 'error' });
    }

    // PR-3: time format
    if (time && !isValidTimeFormat(time)) {
      errors.push({
        row: rowNum,
        col: timeIdx + 1,
        column: 'เวลา',
        value: time,
        message: `Row ${rowNum}, 'เวลา': Expected HH.MM-HH.MM or a number (minutes) — got "${time}"`,
        severity: 'error',
      });
    }

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = sanitize(row[i]); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'period',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
