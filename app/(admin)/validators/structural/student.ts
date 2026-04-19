import { TabData, ValidationError, ValidationResult } from '../types';
import { isValidClassId } from '../utils/parsers';

const REQUIRED_HEADERS = ['นักเรียน', 'ชั้น', 'ห้อง'];

/**
 * ST-1: Required columns present (นักเรียน, ชั้น, ห้อง).
 * ST-2: "นักเรียน" must be in G/S format (e.g. 1/1, 4/5).
 * ST-3: "ชั้น" must match ม.[1-6].
 * ST-4: "ห้อง" (section number) must be a positive integer.
 */
export function validateStudent(data: TabData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!data || data.length === 0) {
    return {
      tabName: 'student',
      valid: false,
      errors: [{ row: 0, col: 0, column: '', value: '', message: 'Tab "student" is empty.', severity: 'error' }],
      warnings: [],
      rowCount: 0,
      parsedRows: [],
    };
  }

  const headers = data[0].map((h) => h.trim());

  // ST-1
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ row: 1, col: 0, column: req, value: '', message: `Missing required column: "${req}"`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { tabName: 'student', valid: false, errors, warnings, rowCount: 0, parsedRows: [] };
  }

  const classIdx = headers.indexOf('นักเรียน');
  const gradeIdx = headers.indexOf('ชั้น');
  const sectionIdx = headers.indexOf('ห้อง');
  const parsedRows: Record<string, string>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowNum = r + 1;
    const classId = (row[classIdx] ?? '').trim();
    const grade = (row[gradeIdx] ?? '').trim();
    const section = (row[sectionIdx] ?? '').trim();

    if (row.every((c) => !c.trim())) continue;

    // ST-2: class ID format G/S (e.g. 1/1)
    // Fix Google Sheets Date Mangling: "1/1" -> "1/1/24" or "1-Jan"
    let cleanClassId = classId;
    if (classId) {
      if (/^\d+\/\d+\/\d+$/.test(classId)) {
        // "1/1/24" -> "1/1"
        cleanClassId = classId.split('/').slice(0, 2).join('/');
      } else if (/^\d+-[A-Za-z]+(-\d+)?$/.test(classId)) {
        // "1-Jan" -> "1/1"
        // Note: January = 1, February = 2, March = 3
        const parts = classId.split('-');
        const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const m = months[parts[1].toLowerCase().substring(0, 3) as keyof typeof months];
        if (m) cleanClassId = `${parts[0]}/${m}`;
      }
    }

    if (cleanClassId && !isValidClassId(cleanClassId)) {
      errors.push({
        row: rowNum, col: classIdx + 1, column: 'นักเรียน', value: classId,
        message: `Row ${rowNum}, 'นักเรียน': Class ID must be G/S format (e.g. 1/1) — got "${classId}"`,
        severity: 'error',
      });
    }

    // ST-3: grade must be ม.[1-6]
    if (grade && !/^ม\.[1-6]$/.test(grade)) {
      errors.push({ row: rowNum, col: gradeIdx + 1, column: 'ชั้น', value: grade, message: `Row ${rowNum}, 'ชั้น': Must be ม.1 through ม.6 — got "${grade}"`, severity: 'error' });
    }

    // ST-4: section is positive integer
    if (section && (!/^\d+$/.test(section) || parseInt(section) <= 0)) {
      errors.push({ row: rowNum, col: sectionIdx + 1, column: 'ห้อง', value: section, message: `Row ${rowNum}, 'ห้อง': Section must be a positive integer — got "${section}"`, severity: 'error' });
    }

    const rowMap: Record<string, string> = {};
    headers.forEach((h, i) => { 
      let val = (row[i] ?? '').trim();
      // Apply the same cleanClassId patch to the exported parsedRows so Phase 2 gets the clean "1/1"
      if (i === classIdx && cleanClassId !== classId) {
        val = cleanClassId;
      }
      rowMap[h] = val; 
    });
    parsedRows.push(rowMap);
  }

  return {
    tabName: 'student',
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}
