import { TabData, ValidationResult } from '../types';
import { isMarkerRow, sanitize } from '../utils/parsers';

/**
 * SC-1: No structural rules — scout is a sparse matrix.
 *   - Header row: scout group names (e.g. ลูกเสือม.1, ลูกเสือม.2).
 *   - Each non-empty cell is a teacher first name.
 *   - Referential validation (SC-2) checks all cell values against teacher tab.
 */
export function validateScout(data: TabData): ValidationResult {
  if (!data || data.length === 0) {
    return {
      tabName: 'scout',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "scout" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => sanitize(h));
  const parsedRows: Record<string, string>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row.every((c) => !sanitize(c))) continue;
    if (isMarkerRow(row)) continue;

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = sanitize(row[i]); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'scout',
    valid: true,
    errors: [],
    warnings: [],
    rowCount: parsedRows.length,
    parsedRows,
  };
}
