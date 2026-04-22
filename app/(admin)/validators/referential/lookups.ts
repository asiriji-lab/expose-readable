import { LookupTables, ValidationResult } from '../types';
import { sanitize } from '../utils/parsers';

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
    const id = sanitize(row['ห้องทั้งหมด']);
    const note = sanitize(row['หมายเหตุ']);
    const type = sanitize(row['ประเภท']);
    if (id) roomIds.add(id);
    if (note) roomNotes.add(note);
    if (type) roomTypes.add(type);
  }

  // ── Teacher lookups ─────────────────────────────────────────────────────
  const teacherIds  = new Set<string>();
  const teacherNames: string[] = [];
  for (const row of teacherResult?.parsedRows ?? []) {
    const id = sanitize(row['teacher_id']);
    const name = sanitize(row['ชื่อ']);
    if (id) teacherIds.add(id);
    // Other files cross-reference teachers by first name (ชื่อ) only
    if (name) teacherNames.push(name);
  }

  // ── Student class lookups ───────────────────────────────────────────────
  const classIds = new Set<string>();
  /** grade (e.g. "ม.1") → set of section numbers */
  const gradeToSections = new Map<string, Set<number>>();
  for (const row of studentResult?.parsedRows ?? []) {
    const classId = sanitize(row['นักเรียน']);  // e.g. "1/1"
    const grade   = sanitize(row['ชั้น']);      // e.g. "ม.1"
    const section = parseInt(sanitize(row['ห้อง'] ?? ''), 10);
    if (classId) classIds.add(classId);
    if (grade && !isNaN(section) && section > 0) {
      if (!gradeToSections.has(grade)) gradeToSections.set(grade, new Set());
      gradeToSections.get(grade)!.add(section);
    }
  }

  // ── Period labels ───────────────────────────────────────────────────────
  const periodLabels = new Set<string>();
  for (const row of periodResult?.parsedRows ?? []) {
    const p = sanitize(row['คาบ']);
    if (p) periodLabels.add(p);
  }

  // ── Preplace slot names (ชื่อ column) ───────────────────────────────────
  const preplaceSlots = new Set<string>();
  for (const row of preplaceResult?.parsedRows ?? []) {
    const name = sanitize(row['ชื่อ']);
    if (name) preplaceSlots.add(name);
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
  const v = sanitize(ref);
  return lookups.roomIds.has(v) || lookups.roomNotes.has(v) || lookups.roomTypes.has(v);
}
