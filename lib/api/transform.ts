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

import { ScheduleItem, ScheduleData, FullDataset, EntityMeta, WorkloadEntry, TeachingType, GroupedSlots, SlotGroup } from '@/app/(admin)/schedule/_types/schedule.types';

// ---------------------------------------------------------------------------
// Backend types
// ---------------------------------------------------------------------------

interface BackendCell {
  subject_id:    string;
  subject_name:  string;
  class?:        string | null;
  room?:         string | null;
  teacher?:      string | null;   // only in room cells
  teaching_type?: 'team' | 'split' | null;  // set by json_exporter post-pass
  slot_type?:    'preplace' | null;          // set for pre-placed activity slots
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
 * Convert the backend's completed schedule JSON into a FullDataset plus
 * a GroupedSlots map for SPLIT-teaching slots.
 *
 * Each entity map is built from its own perspective in the backend JSON:
 *   teachers  → schedule.teachers cells  { subject_id, class, room }
 *   classes   → schedule.students cells  { subject_id, teacher(name), room }
 *   rooms     → schedule.rooms cells     { subject_id, teacher(name), class }
 *
 * A post-pass over the teachers map detects TEAM (multiple teachers, same room)
 * and SPLIT (multiple teachers, different rooms) by grouping (day, slot,
 * classCode, subjectCode) tuples, then stamps `teachingType` on the items and
 * builds the GroupedSlots index for SPLIT slots.
 */
export function transformToFullDataset(schedule: BackendSchedule): { dataset: FullDataset; groupedSlots: GroupedSlots } {
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
          ...(cell.slot_type === 'preplace' ? { isPreplace: true } : {}),
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
          ...(cell.slot_type === 'preplace' ? { isPreplace: true } : {}),
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
          ...(cell.slot_type === 'preplace' ? { isPreplace: true } : {}),
        };
      }
    }
  }

  // ── Post-pass: detect TEAM / SPLIT teaching ──────────────────────────────
  // Group (day, slot) buckets by (classCode, subjectCode).
  // Any bucket with >1 teacher is either TEAM (same room) or SPLIT (diff rooms).
  type BucketEntry = { tid: string; item: ScheduleItem; day: string; slot: number };
  const buckets = new Map<string, BucketEntry[]>();

  for (const [tid, daySlots] of Object.entries(teachers)) {
    for (const [day, slots] of Object.entries(daySlots)) {
      for (const [slotStr, item] of Object.entries(slots)) {
        const slot = Number(slotStr);
        const key = `${day}|${slot}|${item.classCode}|${item.subjectCode}`;
        const bucket = buckets.get(key);
        if (bucket) { bucket.push({ tid, item, day, slot }); }
        else         { buckets.set(key, [{ tid, item, day, slot }]); }
      }
    }
  }

  const groupedSlots: GroupedSlots = {};

  for (const entries of buckets.values()) {
    if (entries.length <= 1) continue;

    const uniqueRooms = new Set(entries.map(e => e.item.room));
    const type: TeachingType = uniqueRooms.size === 1 ? 'team' : 'split';

    for (const { tid, item, day, slot } of entries) {
      teachers[tid][day][slot] = { ...item, teachingType: type };
    }

    if (type === 'split') {
      const { item: { classCode }, day, slot } = entries[0];
      groupedSlots[classCode]         ??= {};
      groupedSlots[classCode][day]    ??= {};
      groupedSlots[classCode][day][slot] = entries.map(e => ({
        teacherCode: e.tid,
        teacherName: e.item.teacherName,
        room:        e.item.room,
        roomName:    e.item.roomName,
      } satisfies SlotGroup));
    }
  }

  return { dataset: { teachers, classes, rooms }, groupedSlots };
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

// ---------------------------------------------------------------------------
// Derive EntityMeta from a BackendSchedule response
// ---------------------------------------------------------------------------

/**
 * Computes EntityMeta from the already-available BackendSchedule data.
 * Used to populate sessionStorage and the database when the backend doesn't
 * return entity_meta (e.g. on first load after generation).
 */
export function deriveEntityMetaFromSchedule(schedule: BackendSchedule): EntityMeta {
  const teacher_codes: string[] = [];
  const teacher_meta: Record<string, { name: string; department: string }> = {};
  const class_codes: string[] = [];
  const class_meta: Record<string, { defaultRoom: string; level: string }> = {};
  const room_codes: string[] = [];
  const room_meta: Record<string, { name: string; type: 'homeroom' | 'specialist' }> = {};
  const subjects: Record<string, { code: string; name: string; variant: string }> = {};
  const subjectRoomFreq: Record<string, Record<string, number>> = {};
  const teacher_workload: Record<string, WorkloadEntry[]> = {};

  // Rooms
  for (const r of schedule.rooms ?? []) {
    room_codes.push(r.id);
    room_meta[r.id] = { name: r.name || r.id, type: 'homeroom' };
  }

  // Teachers + workload from placed lessons
  for (const t of schedule.teachers ?? []) {
    teacher_codes.push(t.id);
    teacher_meta[t.id] = { name: t.name || t.id, department: t.department || '' };

    const assignmentMap: Record<string, { classCode: string; room: string; count: number }> = {};
    const subjectInfoMap: Record<string, { name: string; variant: string }> = {};

    for (const row of t.rows ?? []) {
      for (const colEntry of row.columns ?? []) {
        const parsed = parseColumn(colEntry);
        if (!parsed) continue;
        const [, cell] = parsed;
        if (!cell.subject_id) continue;

        const sid = cell.subject_id;
        const classCode = cell.class || '';
        const roomCode  = cell.room  || '';

        subjectInfoMap[sid] ??= { name: cell.subject_name, variant: subjectVariant(sid) };
        subjects[sid] ??= { code: sid, name: cell.subject_name, variant: subjectVariant(sid) };

        if (roomCode) {
          subjectRoomFreq[sid] ??= {};
          subjectRoomFreq[sid][roomCode] = (subjectRoomFreq[sid][roomCode] ?? 0) + 1;
        }

        const key = `${sid}|||${classCode}`;
        assignmentMap[key] ??= { classCode, room: roomCode, count: 0 };
        assignmentMap[key].count++;
        if (!assignmentMap[key].room && roomCode) assignmentMap[key].room = roomCode;
      }
    }

    const bySubject: Record<string, WorkloadEntry> = {};
    for (const [key, asgn] of Object.entries(assignmentMap)) {
      const sid = key.split('|||')[0];
      bySubject[sid] ??= {
        subjectCode: sid,
        subject: subjectInfoMap[sid]?.name ?? sid,
        variant: subjectInfoMap[sid]?.variant ?? '_activity',
        assignments: [],
        totalPeriods: 0,
      };
      bySubject[sid].assignments.push({
        classCode: asgn.classCode,
        room: asgn.room,
        periodsPerWeek: asgn.count,
      });
      bySubject[sid].totalPeriods += asgn.count;
    }
    teacher_workload[t.id] = Object.values(bySubject);
  }

  // Classes + infer defaultRoom from most frequent room in the student's schedule
  for (const s of schedule.students ?? []) {
    class_codes.push(s.id);
    const level = s.id.split('/')[0] || '';
    const roomCounts: Record<string, number> = {};

    for (const row of s.rows ?? []) {
      for (const colEntry of row.columns ?? []) {
        const parsed = parseColumn(colEntry);
        if (!parsed) continue;
        const [, cell] = parsed;
        if (cell.room) roomCounts[cell.room] = (roomCounts[cell.room] ?? 0) + 1;
        if (cell.subject_id) {
          subjects[cell.subject_id] ??= {
            code: cell.subject_id,
            name: cell.subject_name,
            variant: subjectVariant(cell.subject_id),
          };
        }
      }
    }

    const defaultRoom = Object.entries(roomCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    class_meta[s.id] = { defaultRoom, level };
  }

  // subject_room_map: only map subjects that always use the same specialist room
  const subject_room_map: Record<string, string> = {};
  for (const [sid, roomFreq] of Object.entries(subjectRoomFreq)) {
    const entries = Object.entries(roomFreq);
    if (entries.length === 1) {
      subject_room_map[sid] = entries[0][0];
    }
  }

  // Mark rooms referenced in subject_room_map as 'specialist'
  const specialistRooms = new Set(Object.values(subject_room_map));
  for (const rid of room_codes) {
    room_meta[rid] = { ...room_meta[rid], type: specialistRooms.has(rid) ? 'specialist' : 'homeroom' };
  }

  return {
    teacher_codes,
    teacher_meta,
    class_codes,
    class_meta,
    room_codes,
    room_meta,
    subjects,
    subject_room_map,
    teacher_workload,
  };
}
