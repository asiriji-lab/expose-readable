import { LookupTables, ValidationResult } from '../types';

/**
 * Builds lookup tables from Phase 1 parsedRows.
 * Called once after all Phase 1 validators pass.
 */
export function buildLookups(phase1Results: ValidationResult[]): LookupTables {
  const roomResult    = phase1Results.find((r) => r.tabName === 'room');
  const teacherResult = phase1Results.find((r) => r.tabName === 'teacher');
  const studentResult = phase1Results.find((r) => r.tabName === 'student');
  const periodResult  = phase1Results.find((r) => r.tabName === 'period');
  const preplaceResult = phase1Results.find((r) => r.tabName === 'preplace');

  // ── Room lookups (3-way: ID | alias/note | category/type) ──────────────
  const roomIds   = new Set<string>();
  const roomNotes = new Set<string>();
  const roomTypes = new Set<string>();
  for (const row of roomResult?.parsedRows ?? []) {
    if (row['ห้องทั้งหมด']) roomIds.add(row['ห้องทั้งหมด']);
    if (row['หมายเหตุ'])    roomNotes.add(row['หมายเหตุ']);
    if (row['ประเภท'])      roomTypes.add(row['ประเภท']);
  }

  // ── Teacher lookups ─────────────────────────────────────────────────────
  const teacherIds  = new Set<string>();
  const teacherNames: string[] = [];
  for (const row of teacherResult?.parsedRows ?? []) {
    if (row['teacher_id']) teacherIds.add(row['teacher_id']);
    // Other files cross-reference teachers by first name (ชื่อ) only
    if (row['ชื่อ']) teacherNames.push(row['ชื่อ']);
  }

  // ── Student class lookups ───────────────────────────────────────────────
  const classIds = new Set<string>();
  /** grade (e.g. "ม.1") → set of section numbers */
  const gradeToSections = new Map<string, Set<number>>();
  for (const row of studentResult?.parsedRows ?? []) {
    const classId = row['นักเรียน'];  // e.g. "1/1"
    const grade   = row['ชั้น'];      // e.g. "ม.1"
    const section = parseInt(row['ห้อง'] ?? '', 10);
    if (classId) classIds.add(classId);
    if (grade && !isNaN(section) && section > 0) {
      if (!gradeToSections.has(grade)) gradeToSections.set(grade, new Set());
      gradeToSections.get(grade)!.add(section);
    }
  }

  // ── Period labels ───────────────────────────────────────────────────────
  const periodLabels = new Set<string>();
  for (const row of periodResult?.parsedRows ?? []) {
    if (row['คาบ']) periodLabels.add(row['คาบ']);
  }

  // ── Preplace slot names (ชื่อ column) ───────────────────────────────────
  const preplaceSlots = new Set<string>();
  for (const row of preplaceResult?.parsedRows ?? []) {
    if (row['ชื่อ']) preplaceSlots.add(row['ชื่อ']);
  }

  return {
    roomIds,
    roomNotes,
    roomTypes,
    teacherIds,
    teacherNames: [...new Set(teacherNames)],
    classIds,
    gradeToSections,
    periodLabels,
    preplaceSlots,
  };
}

/**
 * Resolves a room reference via 3-way lookup (room ID | alias/note | category/type).
 */
export function resolveRoom(ref: string, lookups: LookupTables): boolean {
  const v = ref.trim();
  return lookups.roomIds.has(v) || lookups.roomNotes.has(v) || lookups.roomTypes.has(v);
}
