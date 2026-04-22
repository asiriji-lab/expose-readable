/**
 * scheduleAdapter.ts
 *
 * Converts the backend schedule JSON (produced by `json_exporter.py`) into the
 * frontend's FullDataset format used by TimetableGridV2.
 *
 * Backend shape (authoritative — see src/ga/json_exporter.py):
 * {
 *   config: { academic_year, semester, columns: [{ key, label, time }] },
 *   teachers: [{ id, name, department, rows: [{ day, columns: [{ "<period>": cell | null }] }] }],
 *   students: [{ id, name, class_group, rows: [...] }],
 *   rooms:    [{ id, name, rows: [...] }],
 *   unfilled_slots: [...],
 * }
 *
 * A teacher-row cell:  { subject_id, subject_name, class, room }
 * A student-row cell:  { subject_id, subject_name, teacher, room }
 * A room-row cell:     { subject_id, subject_name, teacher, class }
 */

import { FullDataset, ScheduleItem } from '../../app/(admin)/schedule/_types/schedule.types';

// ── Backend types ─────────────────────────────────────────────────────────────

interface BackendCell {
  subject_id:   string;
  subject_name: string;
  class?:       string | null;
  room?:        string | null;
  teacher?:     string | null;
}

interface BackendRow {
  day:     string;
  columns: Record<string, BackendCell | null>[];
}

interface BackendEntity {
  id:        string;
  name:      string;
  rows:      BackendRow[];
  // teacher-only
  department?: string | null;
  // student-only
  class_group?: string;
}

interface BackendSchedule {
  config?:         unknown;
  teachers:        BackendEntity[];
  students:        BackendEntity[];
  rooms:           BackendEntity[];
  unfilled_slots?: unknown[];
}

// ── Day name normalisation ────────────────────────────────────────────────────
// The backend uses full English weekday names already, but ensure we handle
// any short-form names gracefully.
const DAY_EXPAND: Record<string, string> = {
  // Title-case (just in case)
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
  // All-caps — what the backend actually sends (see OUTPUT_FORMAT.md)
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday',
};
function normaliseDay(day: string): string {
  return DAY_EXPAND[day] ?? day;
}

// ── Cell → ScheduleItem ───────────────────────────────────────────────────────
function cellToItem(
  cell:        BackendCell,
  entityId:    string,
  entityType:  'teacher' | 'student' | 'room',
  entityName?: string,          // full name from the entity object
): ScheduleItem {
  return {
    teacher:     entityType === 'teacher' ? entityId : (cell.teacher ?? ''),
    teacherName: entityType === 'teacher' ? (entityName ?? entityId) : (cell.teacher ?? ''),
    classCode:   cell.class  ?? '',
    room:        cell.room   ?? '',
    roomName:    cell.room   ?? '',
    subjectCode: cell.subject_id   ?? '',
    subject:     cell.subject_name ?? '',
    variant:     cell.subject_id?.[0] ?? '_activity',
  };
}

// ── Main adapter ──────────────────────────────────────────────────────────────
export function adaptBackendSchedule(
  backendSchedule: unknown,
): { dataset: FullDataset; unfilled: unknown[] } {
  const dataset: FullDataset = { teachers: {}, classes: {}, rooms: {} };

  if (!backendSchedule || typeof backendSchedule !== 'object') {
    console.warn('[scheduleAdapter] received empty or non-object schedule');
    return { dataset, unfilled: [] };
  }

  const sched = backendSchedule as BackendSchedule;

  // Guard against completely missing keys (e.g. null schedule from a failed job)
  if (!Array.isArray(sched.teachers)) {
    console.warn('[scheduleAdapter] schedule.teachers is not an array:', sched);
    return { dataset, unfilled: [] };
  }

  // ── Process Teachers ───────────────────────────────────────────────────────
  for (const teacher of sched.teachers) {
    const teacherId = teacher.id;
    if (!teacherId) continue;

    for (const row of teacher.rows ?? []) {
      const day = normaliseDay(row.day);
      for (const colObj of row.columns ?? []) {
        for (const [periodLabel, cell] of Object.entries(colObj)) {
          if (!cell) continue; // null = blocked/empty slot
          const slot = parseInt(periodLabel, 10);
          if (isNaN(slot)) continue;

          const item = cellToItem(cell, teacherId, 'teacher', teacher.name);

          dataset.teachers[teacherId] ??= {};
          dataset.teachers[teacherId][day] ??= {};
          dataset.teachers[teacherId][day][slot] = item;

          // Mirror into classes map
          if (item.classCode) {
            dataset.classes[item.classCode] ??= {};
            dataset.classes[item.classCode][day] ??= {};
            dataset.classes[item.classCode][day][slot] = item;
          }

          // Mirror into rooms map
          if (item.room) {
            dataset.rooms[item.room] ??= {};
            dataset.rooms[item.room][day] ??= {};
            dataset.rooms[item.room][day][slot] = item;
          }
        }
      }
    }
  }

  return {
    dataset,
    unfilled: sched.unfilled_slots ?? [],
  };
}
