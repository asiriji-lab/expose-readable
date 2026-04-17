import { TabData, ValidationError, ValidationResult } from '../types';
import { isValidApplyTo, getInvalidPreplaceSlotTokens } from '../utils/parsers';

const REQUIRED_HEADERS = ['ชื่อ', 'คาบ', 'apply_to'];

/**
 * PP-1: Required columns present (ชื่อ, คาบ, apply_to).
 * PP-2: "ชื่อ" (slot name) must be non-empty.
 * PP-3: "คาบ" each token must match DAY_N, DAY_N-DAY_M, or Everyday_N.
 * PP-4: "apply_to" must be "All", "ม.X", or comma-list of "ม.X".
 */
export function validatePreplace(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'preplace',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "preplace" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => h.trim());

  // PP-1
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { tabName: 'preplace', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const nameIdx = headers.indexOf('ชื่อ');
  const slotIdx = headers.indexOf('คาบ');
  const applyIdx = headers.indexOf('apply_to');
  const parsedRows: Record<string, string>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;

    if (row.every((c) => !c.trim())) continue;

    const slotName = (row[nameIdx] ?? '').trim();
    const period = (row[slotIdx] ?? '').trim();
    const applyTo = (row[applyIdx] ?? '').trim();

    // PP-2: slot name required
    if (!slotName) {
      errors.push({ row: rowNum, col: nameIdx + 1, column: 'ชื่อ', value: slotName, message: `Row ${rowNum}, 'ชื่อ': Slot name is required.`, severity: 'error' });
    }

    // PP-3: period slot format
    if (period) {
      const invalid = getInvalidPreplaceSlotTokens(period);
      for (const token of invalid) {
        errors.push({
          row: rowNum, col: slotIdx + 1, column: 'คาบ', value: token,
          message: `Row ${rowNum}, 'คาบ': Invalid slot token "${token}". Expected MON_2, MON_2-MON_10, or Everyday_1.`,
          severity: 'error',
        });
      }
    }

    // PP-4: apply_to format
    if (applyTo && !isValidApplyTo(applyTo)) {
      errors.push({
        row: rowNum, col: applyIdx + 1, column: 'apply_to', value: applyTo,
        message: `Row ${rowNum}, 'apply_to': Must be "All", "ม.X" (e.g. ม.1), or comma-list of grades — got "${applyTo}"`,
        severity: 'error',
      });
    }

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = (row[i] ?? '').trim(); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'preplace',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
