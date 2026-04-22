import { TabData, ValidationError, ValidationResult } from '../types';
import { isMarkerRow, sanitize } from '../utils/parsers';

const REQUIRED_HEADERS = ['ห้องทั้งหมด'];

/**
 * RM-1: Required columns must be present.
 * RM-2: "ห้องทั้งหมด" (room ID) must be non-empty for every data row.
 * RM-3: No duplicate room IDs.
 */
export function validateRoom(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'room',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "room" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => sanitize(h));

  // RM-1: Required headers
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }

  if (errors.length > 0) {
    return { tabName: 'room', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const roomIdx = headers.indexOf('ห้องทั้งหมด');
  const parsedRows: Record<string, string>[] = [];
  const seen = new Map<string, number>(); // roomId → first row number

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;
    const roomId = sanitize(row[roomIdx]);

    if (!roomId && row.every((c) => !sanitize(c))) continue;
    if (isMarkerRow(row)) continue;

    // RM-2: room ID non-empty
    if (!roomId) {
      errors.push({ row: rowNum, col: roomIdx + 1, column: 'ห้องทั้งหมด', value: roomId, message: `Row ${rowNum}, 'ห้องทั้งหมด': Room ID is required.`, severity: 'error' });
      continue;
    }

    // RM-3: no duplicates
    if (seen.has(roomId)) {
      errors.push({
        row: rowNum,
        col: roomIdx + 1,
        column: 'ห้องทั้งหมด',
        value: roomId,
        message: `Row ${rowNum}, 'ห้องทั้งหมด': Duplicate room ID "${roomId}" (also row ${seen.get(roomId)}).`,
        severity: 'error',
      });
    } else {
      seen.set(roomId, rowNum);
    }

    // No warning for empty note

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = sanitize(row[i]); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'room',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
