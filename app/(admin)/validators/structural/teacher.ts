import { TabData, ValidationError, ValidationResult } from '../types';
import { isValidTeacherId, isSkipRow, getInvalidSlotTokens } from '../utils/parsers';

const REQUIRED_HEADERS = ['teacher_id', 'ชื่อ'];

/**
 * TC-1: Required columns present (teacher_id, ชื่อ).
 * TC-2: Skip section-header rows (ครูในโรงเรียน, อาจารย์นอก).
 * TC-3: "teacher_id" must match T### or E### pattern.
 * TC-4: "ชื่อ" (first name) must be non-empty.
 * TC-5: No duplicate teacher_id values.
 * TC-6: "available_slots" / "unavailable_slots", if present, must use valid DAY_N or DAY_N-DAY_M tokens.
 */
export function validateTeacher(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'teacher',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "teacher" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => h.trim());

  // TC-1
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { tabName: 'teacher', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const idIdx = headers.indexOf('teacher_id');
  const nameIdx = headers.indexOf('ชื่อ');
  const availIdx = headers.indexOf('available_slots');   // optional
  const unavailIdx = headers.indexOf('unavailable_slots'); // optional
  const parsedRows: Record<string, string>[] = [];
  const seen = new Map<string, number>();

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;
    const idVal = (row[idIdx] ?? '').trim();
    const nameVal = (row[nameIdx] ?? '').trim();

    if (row.every((c) => !c.trim())) continue;

    // TC-2: skip header-repetition rows
    if (isSkipRow(idVal)) continue;

    // TC-3: ID format
    if (!isValidTeacherId(idVal)) {
      errors.push({
        row: rowNum, col: idIdx + 1, column: 'teacher_id', value: idVal,
        message: `Row ${rowNum}, 'teacher_id': Teacher ID must be T### or E### — got "${idVal}"`,
        severity: 'error',
      });
    }

    // TC-4: first name required
    if (!nameVal) {
      errors.push({ row: rowNum, col: nameIdx + 1, column: 'ชื่อ', value: '', message: `Row ${rowNum}, 'ชื่อ': Teacher first name is required.`, severity: 'error' });
    }

    // TC-5: duplicate ID
    if (seen.has(idVal)) {
      errors.push({
        row: rowNum, col: idIdx + 1, column: 'teacher_id', value: idVal,
        message: `Row ${rowNum}, 'teacher_id': Duplicate teacher ID "${idVal}" (also row ${seen.get(idVal)}).`,
        severity: 'error',
      });
    } else if (idVal) {
      seen.set(idVal, rowNum);
    }

    // TC-6: available_slots and unavailable_slots format
    for (const [colIdx, colName] of [[availIdx, 'available_slots'], [unavailIdx, 'unavailable_slots']] as [number, string][]) {
      if (colIdx === -1) continue;
      const slotVal = (row[colIdx] ?? '').trim();
      if (!slotVal) continue;
      const invalid = getInvalidSlotTokens(slotVal);
      for (const token of invalid) {
        errors.push({
          row: rowNum, col: colIdx + 1, column: colName, value: token,
          message: `Row ${rowNum}, '${colName}': Invalid slot token "${token}". Expected DAY_N or DAY_N-DAY_M (e.g. MON_2, MON_2-MON_10).`,
          severity: 'error',
        });
      }
    }

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { rowMap[h] = (row[i] ?? '').trim(); });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'teacher',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
