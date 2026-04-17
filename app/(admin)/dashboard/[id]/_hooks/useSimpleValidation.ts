'use client';

import { useState, useCallback } from 'react';
import {
  TabName,
  TabData,
  TabState,
  AllTabStates,
  ValidationError,
  ValidationResult,
  SheetData,
} from '../../../validators/types';
import { isSkipRow, isGradeHeader } from '../../../validators/utils/parsers';

// Curriculum columns that use merged cells in Google Sheets — forward-fill their values from CSV
const CURRICULUM_MERGE_COLS = ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'ครู'];

const ALL_TABS: TabName[] = [
  'period', 'room', 'teacher', 'student',
  'preplace', 'scout', 'elective', 'curriculum',
];

/** Required fields per tab — empty cell = error */
const REQUIRED_FIELDS: Record<TabName, string[]> = {
  period:     ['คาบ', 'เวลา'],
  room:       ['ห้องทั้งหมด'],
  teacher:    ['teacher_id', 'ชื่อ'],
  student:    ['นักเรียน', 'ชั้น', 'ห้อง'],
  preplace:   ['ชื่อ', 'คาบ', 'apply_to'],
  scout:      [], // special: at least one column non-empty per row
  elective:   ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน'],
  curriculum: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'ครู', 'ห้อง (นักเรียน) ที่สอน'],
};

/** Optional fields per tab — empty cell = warning */
const OPTIONAL_FIELDS: Record<TabName, string[]> = {
  period:     [],
  room:       ['หมายเหตุ', 'ประเภท'],
  teacher:    ['ตำแหน่ง', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ'],
  student:    ['ห้องประจำ', 'หลักสูตร'],
  preplace:   [],
  scout:      [],
  elective:   ['ห้องเรียน'],
  curriculum: ['การแบ่งคาบสอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน'],
};

function initialStates(): AllTabStates {
  return Object.fromEntries(
    ALL_TABS.map((t) => [t, { status: 'pending', result: null } as TabState])
  ) as AllTabStates;
}

function validateTab(tabName: TabName, data: TabData | undefined): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const parsedRows: Record<string, string>[] = [];

  if (!data || data.length === 0) {
    errors.push({
      row: 0, col: 0, column: '', value: '',
      message: `ไม่พบข้อมูลในแท็บ ${tabName}`,
      severity: 'error',
    });
    return { tabName, valid: false, errors, warnings, rowCount: 0, parsedRows };
  }

  const headers = data[0].map((h) => h.trim());
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => headerIndex.set(h, i));

  // Check for missing required headers (once, not per-row)
  const requiredFields = REQUIRED_FIELDS[tabName];
  const missingHeaders = requiredFields.filter((f) => !headerIndex.has(f));
  for (const col of missingHeaders) {
    errors.push({
      row: 1, col: 0, column: col, value: '',
      message: `ไม่พบคอลัมน์ "${col}" ในแท็บ ${tabName}`,
      severity: 'error',
    });
  }

  if (data.length <= 1) {
    errors.push({
      row: 0, col: 0, column: '', value: '',
      message: `ไม่มีข้อมูล (มีเฉพาะหัวตาราง) ในแท็บ ${tabName}`,
      severity: 'error',
    });
    return { tabName, valid: false, errors, warnings, rowCount: 0, parsedRows };
  }

  const optionalFields = OPTIONAL_FIELDS[tabName];

  // Curriculum: forward-fill merged-cell columns so continuation rows aren't flagged as empty
  let resolvedData = data;
  if (tabName === 'curriculum') {
    const fillIndices = CURRICULUM_MERGE_COLS.map((f) => headerIndex.get(f) ?? -1).filter((i) => i >= 0);
    const lastVals: string[] = [];
    resolvedData = data.map((row, ri) => {
      if (ri === 0) return row;
      const newRow = [...row];
      for (const ci of fillIndices) {
        const val = row[ci]?.trim();
        if (!val) {
          if (lastVals[ci]) newRow[ci] = lastVals[ci];
        } else {
          lastVals[ci] = val;
        }
      }
      return newRow;
    });
  }

  for (let ri = 1; ri < resolvedData.length; ri++) {
    const row = resolvedData[ri];

    // Teacher: skip section-header rows (ครูในโรงเรียน, อาจารย์นอก)
    if (tabName === 'teacher') {
      const idIdx = headerIndex.get('teacher_id');
      if (idIdx !== undefined && isSkipRow(row[idIdx]?.trim() ?? '')) continue;
    }

    // Curriculum: skip grade-header rows (ม.1–ม.6) and fully empty rows
    if (tabName === 'curriculum') {
      const firstCell = row[0]?.trim() ?? '';
      if (isGradeHeader(firstCell) || row.every((c) => !c?.trim())) continue;
    }

    const parsed: Record<string, string> = {};
    headers.forEach((h, ci) => {
      parsed[h] = row[ci]?.trim() ?? '';
    });
    parsedRows.push(parsed);

    // Required field checks
    for (const field of requiredFields) {
      const ci = headerIndex.get(field);
      if (ci === undefined) continue; // already reported as missing header
      const val = row[ci]?.trim() ?? '';
      if (!val) {
        errors.push({
          row: ri + 1, // 1-based, header is row 1
          col: ci + 1,
          column: field,
          value: '',
          message: `ข้อมูล "${field}" ว่างเปล่า (แถวที่ ${ri})`,
          severity: 'error',
        });
      }
    }

    // Optional field checks
    for (const field of optionalFields) {
      const ci = headerIndex.get(field);
      if (ci === undefined) continue;
      const val = row[ci]?.trim() ?? '';
      if (!val) {
        warnings.push({
          row: ri + 1,
          col: ci + 1,
          column: field,
          value: '',
          message: `ข้อมูล "${field}" ว่างเปล่า (แถวที่ ${ri})`,
          severity: 'warning',
        });
      }
    }

    // Scout special case: at least one column non-empty
    if (tabName === 'scout') {
      const allEmpty = row.every((cell) => !(cell?.trim()));
      if (allEmpty) {
        errors.push({
          row: ri + 1,
          col: 1,
          column: headers[0] ?? '',
          value: '',
          message: `แถวที่ ${ri} ไม่มีข้อมูลเลย`,
          severity: 'error',
        });
      }
    }
  }

  return {
    tabName,
    valid: errors.length === 0,
    errors,
    warnings,
    rowCount: parsedRows.length,
    parsedRows,
  };
}

function deriveStatus(result: ValidationResult): TabState['status'] {
  if (result.errors.length > 0) return 'errors';
  if (result.warnings.length > 0) return 'warnings';
  return 'passed';
}

export function useSimpleValidation(sheetData: SheetData) {
  const [tabStates, setTabStates] = useState<AllTabStates>(initialStates);
  const [isRunning, setIsRunning] = useState(false);

  const runValidation = useCallback((data?: SheetData) => {
    const source = data ?? sheetData;
    setIsRunning(true);

    const newStates = { ...initialStates() };

    for (const tab of ALL_TABS) {
      const tabData = source[tab];
      if (!tabData) {
        newStates[tab] = { status: 'missing', result: null };
        continue;
      }
      const result = validateTab(tab, tabData);
      newStates[tab] = { status: deriveStatus(result), result };
    }

    setTabStates(newStates as AllTabStates);
    setIsRunning(false);
  }, [sheetData]);

  const resetStates = useCallback(() => {
    setTabStates(initialStates());
  }, []);

  const allPassed = ALL_TABS.every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings';
  });

  const hasAnyErrors = ALL_TABS.some((t) => tabStates[t].status === 'errors' || tabStates[t].status === 'missing');

  const hasAnyWarnings = ALL_TABS.some((t) => tabStates[t].status === 'warnings');

  const totalWarnings = Object.values(tabStates).reduce(
    (sum, t) => sum + (t.result?.warnings.length ?? 0), 0
  );

  return { tabStates, isRunning, runValidation, resetStates, allPassed, hasAnyErrors, hasAnyWarnings, totalWarnings };
}
