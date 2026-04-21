/**
 * Transforms the backend's schedule.json output format into the frontend
 * FullDataset structure consumed by the timetable viewer and editor.
 *
 * Backend format (from json_exporter.py):
 *   {
 *     config:   { academic_year, semester, columns: [{key, label, time?}] },
 *     teachers: [{ id, name, department, rows: [{day, columns: [{<slot>: cell|null}]}] }],
 *     students: [{ id, name, class_group, rows: [...] }],
 *     rooms:    [{ id, name, rows: [...] }],
 *   }
 *   where teacher cell = { subject_id, subject_name, class, room }
 *
 * Frontend FullDataset:
 *   {
 *     teachers: Record<code, Record<day, Record<slot, ScheduleItem>>>,
 *     classes:  Record<code, Record<day, Record<slot, ScheduleItem>>>,
 *     rooms:    Record<code, Record<day, Record<slot, ScheduleItem>>>,
 *   }
 *
 * Strategy: derive ALL three entity maps from the teacher perspective, since
 * teacher rows contain the most complete data (class AND room in every cell).
 */

import { ScheduleItem, ScheduleData, FullDataset } from '@/app/(admin)/schedule/_types/schedule.types';

// ---------------------------------------------------------------------------
// Backend types
// ---------------------------------------------------------------------------

interface BackendCell {
  subject_id:   string;
  subject_name: string;
  class?:       string | null;
  room?:        string | null;
  teacher?:     string | null;  // only in room cells
}

interface BackendRow {
  day:     string;
  columns: Array<Record<string, BackendCell | null>>;
}

interface BackendTeacher {
  id:         string;
  name:       string;
  department: string | null;
  rows:       BackendRow[];
}

interface BackendRoom {
  id:   string;
  name: string;
  rows: BackendRow[];
}

export interface BackendSchedule {
  config: {
    academic_year: string;
    semester:      number;
    columns:       Array<{ key: string; label: string; time?: string }>;
  };
  teachers: BackendTeacher[];
  students: Array<{ id: string; name: string; class_group: string; rows: BackendRow[] }>;
  rooms:    BackendRoom[];
  unfilled_slots?: unknown[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Backend uses abbreviated day keys (MON, TUE, WED, THU, FRI, SAT, SUN).
 * The timetable grid iterates full English names (Monday, Tuesday, …).
 * This map normalises whatever the backend sends into the grid's expected format.
 */
const DAY_NORMALIZE: Record<string, string> = {
  MON: 'Monday',  MONDAY:    'Monday',
  TUE: 'Tuesday', TUESDAY:   'Tuesday',
  WED: 'Wednesday', WEDNESDAY: 'Wednesday',
  THU: 'Thursday', THURSDAY:  'Thursday',
  FRI: 'Friday',  FRIDAY:    'Friday',
  SAT: 'Saturday', SATURDAY:  'Saturday',
  SUN: 'Sunday',  SUNDAY:    'Sunday',
};

function normalizeDay(raw: string): string {
  return DAY_NORMALIZE[raw.toUpperCase()] ?? raw;
}


function subjectVariant(subjectId: string): string {
  if (!subjectId) return '_activity';
  return subjectId[0];
}

/** Safely extract [slotLabel, cell] from a column entry `{"1": {...}}`. */
function parseColumn(entry: Record<string, BackendCell | null>): [number, BackendCell] | null {
  const keys = Object.keys(entry);
  if (keys.length === 0) return null;
  const label = keys[0];
  const cell  = entry[label];
  if (!cell) return null;
  const slot = parseInt(label, 10);
  if (isNaN(slot)) return null;
  return [slot, cell];
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Convert the backend's completed schedule JSON into a FullDataset.
 *
 * Each entity map is built from its own perspective in the backend JSON:
 *   teachers  → schedule.teachers cells  { subject_id, class, room }
 *   classes   → schedule.students cells  { subject_id, teacher(name), room }
 *   rooms     → schedule.rooms cells     { subject_id, teacher(name), class }
 *
 * This gives each individual view the correct cross-entity fields directly
 * (e.g. class view gets teacherName from the student cell, not teacher metadata).
 */
export function transformToFullDataset(schedule: BackendSchedule): FullDataset {
  const teachers: FullDataset['teachers'] = {};
  const classes:  FullDataset['classes']  = {};
  const rooms:    FullDataset['rooms']    = {};

  // Build a room-id → display name lookup from the rooms array.
  const roomNameMap: Record<string, string> = {};
  for (const r of schedule.rooms ?? []) {
    roomNameMap[r.id] = r.name || r.id;
  }

  // ── Teachers map (from teacher-perspective cells) ──────────────────────────
  for (const teacher of schedule.teachers ?? []) {
    const tid   = teacher.id;
    const tName = teacher.name || tid;

    teachers[tid] ??= {};

    for (const row of teacher.rows ?? []) {
      const day = normalizeDay(row.day);
      teachers[tid][day] ??= {};

      for (const colEntry of row.columns ?? []) {
        const parsed = parseColumn(colEntry);
        if (!parsed) continue;
        const [slot, cell] = parsed;

        const classCode = cell.class || '';
        const roomCode  = cell.room  || '';

        teachers[tid][day][slot] = {
          teacher:     tid,
          teacherName: tName,
          classCode,
          room:        roomCode,
          roomName:    roomNameMap[roomCode] || roomCode,
          subjectCode: cell.subject_id   || '',
          subject:     cell.subject_name || '',
          variant:     subjectVariant(cell.subject_id || ''),
        };
      }
    }
  }

  // ── Classes map (from student-perspective cells) ───────────────────────────
  // Student cells: { subject_id, subject_name, teacher (name), room }
  for (const student of schedule.students ?? []) {
    const cid = student.id;

    classes[cid] ??= {};

    for (const row of student.rows ?? []) {
      const day = normalizeDay(row.day);
      classes[cid][day] ??= {};

      for (const colEntry of row.columns ?? []) {
        const parsed = parseColumn(colEntry);
        if (!parsed) continue;
        const [slot, cell] = parsed;

        const roomCode = cell.room || '';

        classes[cid][day][slot] = {
          teacher:     '',          // teacher code not in student cells
          teacherName: cell.teacher || '',
          classCode:   cid,
          room:        roomCode,
          roomName:    roomNameMap[roomCode] || roomCode,
          subjectCode: cell.subject_id   || '',
          subject:     cell.subject_name || '',
          variant:     subjectVariant(cell.subject_id || ''),
        };
      }
    }
  }

  // ── Rooms map (from room-perspective cells) ────────────────────────────────
  // Room cells: { subject_id, subject_name, teacher (name), class }
  for (const room of schedule.rooms ?? []) {
    const rid = room.id;

    rooms[rid] ??= {};

    for (const row of room.rows ?? []) {
      const day = normalizeDay(row.day);
      rooms[rid][day] ??= {};

      for (const colEntry of row.columns ?? []) {
        const parsed = parseColumn(colEntry);
        if (!parsed) continue;
        const [slot, cell] = parsed;

        rooms[rid][day][slot] = {
          teacher:     '',          // teacher code not in room cells
          teacherName: cell.teacher || '',
          classCode:   cell.class  || '',
          room:        rid,
          roomName:    roomNameMap[rid] || rid,
          subjectCode: cell.subject_id   || '',
          subject:     cell.subject_name || '',
          variant:     subjectVariant(cell.subject_id || ''),
        };
      }
    }
  }

  return { teachers, classes, rooms };
}


// ---------------------------------------------------------------------------
// Utility: derive sorted lists of entity codes from a FullDataset
// ---------------------------------------------------------------------------

export function getTeacherCodes(dataset: FullDataset): string[] {
  return Object.keys(dataset.teachers).sort();
}

export function getClassCodes(dataset: FullDataset): string[] {
  return Object.keys(dataset.classes).sort((a, b) => {
    // Sort "1/1" before "1/2" etc.
    const [ga, ra] = a.split('/').map(Number);
    const [gb, rb] = b.split('/').map(Number);
    return ga !== gb ? ga - gb : ra - rb;
  });
}

export function getRoomCodes(dataset: FullDataset): string[] {
  return Object.keys(dataset.rooms).sort();
}

// ---------------------------------------------------------------------------
// Utility: per-teacher total period count
// ---------------------------------------------------------------------------

export function countTeacherPeriods(dataset: FullDataset, teacherCode: string): number {
  const sched = dataset.teachers[teacherCode];
  if (!sched) return 0;
  return Object.values(sched).reduce((sum, daySlots) => sum + Object.keys(daySlots).length, 0);
}

export function countClassPeriods(dataset: FullDataset, classCode: string): number {
  const sched = dataset.classes[classCode];
  if (!sched) return 0;
  return Object.values(sched).reduce((sum, daySlots) => sum + Object.keys(daySlots).length, 0);
}

// ---------------------------------------------------------------------------
// Empty dataset fallback
// ---------------------------------------------------------------------------

export function emptyDataset(): FullDataset {
  return { teachers: {}, classes: {}, rooms: {} };
}

// ---------------------------------------------------------------------------
// Convenience: extract a single entity's ScheduleData
// ---------------------------------------------------------------------------

export function getEntitySchedule(
  dataset: FullDataset,
  type: 'teachers' | 'classes' | 'rooms',
  code: string,
): ScheduleData {
  return (dataset[type]?.[code]) ?? {};
}
