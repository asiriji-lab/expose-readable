import { TabData, ValidationError, ValidationResult } from '../types';
import { isMarkerRow, sanitize } from '../utils/parsers';

const REQUIRED_HEADERS = ['room_id'];
const INVALID_TAGS = new Set(['homeroom']); // reserved word moved to class_id column

/**
 * RM-1: Required columns must be present.
 * RM-2: "room_id" must be non-empty for every data row.
 * RM-3: No duplicate room IDs.
 * RM-4: 'ประเภท' must not contain reserved tag "homeroom" (use ชั้นเรียนประจำ instead).
 * RM-5: 'ชั้นเรียนประจำ' and 'ประเภท' should not both be filled.
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

  const roomIdx  = headers.indexOf('room_id');
  const classIdx = headers.indexOf('ชั้นเรียนประจำ');
  const tagsIdx  = headers.indexOf('ประเภท');
  const parsedRows: Record<string, string>[] = [];
  const seen = new Map<string, number>();

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;
    const roomId = sanitize(row[roomIdx]);

    if (!roomId && row.every((c) => !sanitize(c))) continue;
    if (isMarkerRow(row)) continue;

    // RM-2: room ID non-empty
    if (!roomId) {
      errors.push({ row: rowNum, col: roomIdx + 1, column: 'room_id', value: roomId, message: `Row ${rowNum}, 'room_id': ต้องระบุroom_id`, severity: 'error' });
      continue;
    }

    // RM-3: no duplicates
    if (seen.has(roomId)) {
      errors.push({
        row: rowNum, col: roomIdx + 1, column: 'room_id', value: roomId,
        message: `Row ${rowNum}, 'room_id': รหัสซ้ำ "${roomId}" (แถว ${seen.get(roomId)})`,
        severity: 'error',
      });
    } else {
      seen.set(roomId, rowNum);
    }

    const tagsVal  = tagsIdx  !== -1 ? sanitize(row[tagsIdx])  : '';
    const classVal = classIdx !== -1 ? sanitize(row[classIdx]) : '';

    // RM-4: warn if 'ประเภท' contains reserved tag 'homeroom'
    if (tagsVal) {
      for (const tag of tagsVal.split(',').map((t) => t.trim()).filter(Boolean)) {
        if (INVALID_TAGS.has(tag.toLowerCase())) {
          warnings.push({
            row: rowNum, col: tagsIdx + 1, column: 'ประเภท', value: tagsVal,
            message: `Row ${rowNum}, 'ประเภท': แท็ก "${tag}" ไม่ถูกต้อง — ใช้คอลัมน์ 'ชั้นเรียนประจำ' แทน`,
            severity: 'warning',
          });
        }
      }
    }

    // RM-5: homeroom room should not also have tags
    if (classVal && tagsVal) {
      warnings.push({
        row: rowNum, col: tagsIdx + 1, column: 'ประเภท', value: tagsVal,
        message: `Row ${rowNum}: ห้อง homeroom ไม่ควรมี 'ประเภท' — ระบุ 'ชั้นเรียนประจำ' อย่างเดียว`,
        severity: 'warning',
      });
    }

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
