#!/usr/bin/env node
/**
 * Reads cleaned CSV files and generates app/(admin)/schedule/_utils/dummyData.ts
 * Run: node scripts/generateScheduleData.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = resolve(__dirname, '../.agent/solver_something/cleaned');
const OUT = resolve(__dirname, '../app/(admin)/schedule/_utils/dummyData.ts');

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSV(file) {
    const raw = readFileSync(resolve(CSV_DIR, file), 'utf-8');
    const lines = raw.trim().split('\n');
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map(line => {
        const vals = parseCsvLine(line);
        const obj = {};
        headers.forEach((h, i) => obj[h] = (vals[i] ?? '').trim());
        return obj;
    });
}

/** Simple CSV line parser that handles quoted fields with commas */
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
        current += ch;
    }
    result.push(current);
    return result;
}

// ─── Load CSVs ───────────────────────────────────────────────────────────────

const teachers = parseCSV('teacher_cleaned.csv');
const rooms = parseCSV('room_cleaned.csv');
const students = parseCSV('student_cleaned.csv');
const curriculum = parseCSV('curriculum_cleaned.csv');

// ─── Build TEACHER_META ──────────────────────────────────────────────────────

const teacherCodes = teachers.map(t => t.teacher_id);
const teacherMeta = {};
for (const t of teachers) {
    teacherMeta[t.teacher_id] = {
        prefix: '',
        firstName: t.teacher_name,
        lastName: '',
        department: '',
    };
}

// ─── Build CLASS_META ────────────────────────────────────────────────────────

const classCodes = students.map(s => s.class_id);
const classMeta = {};
for (const s of students) {
    classMeta[s.class_id] = {
        defaultRoom: s.default_room || '',
        level: s.grade,
    };
}

// ─── Build ROOM_META ─────────────────────────────────────────────────────────

const roomCodes = rooms.map(r => r.room_id);
const roomMeta = {};
for (const r of rooms) {
    const tag = r.tag || '';
    const note = r.note || '';
    const name = tag || note || r.room_id;
    // Rooms with a note like "ม.3/1" are homerooms; those with tag are specialist
    const type = note.startsWith('ม.') || (!tag && !note) ? 'homeroom' : 'specialist';
    roomMeta[r.room_id] = { name, type };
}

// ─── Build SUBJECTS + SUBJECT_ROOM_MAP ───────────────────────────────────────

const subjects = {};      // subjectCode → { code, name, variant }
const subjectRoomMap = {}; // subjectCode → roomCode

/** Variant heuristic: codes with odd last digit or core subjects = green, else red */
function inferVariant(code, name) {
    if (!code) return 'green';
    // "เพิ่มเติม" (additional/elective) subjects are red
    if (name.includes('เพิ่มเติม')) return 'red';
    // Codes ending in even hundreds digit for electives
    const lastDigit = parseInt(code.slice(-1), 10);
    if (!isNaN(lastDigit) && lastDigit % 2 === 0 && code.length > 4) return 'red';
    return 'green';
}

// ─── Parse Curriculum → TEACHER_WORKLOAD + SUBJECTS ──────────────────────────

// WorkloadEntry: { subjectCode, subject, variant, assignments: [{classCode, room, periodsPerWeek}], totalPeriods }
// We build: teacherWorkload[teacherCode] = WorkloadEntry[]

const teacherWorkload = {}; // teacherCode → Map<subjectCode, { ...entry, assignmentsMap: Map<classCode, periodsPerWeek> }>

let currentGrade = '';
let prevSubjectCode = '';
let prevSubjectName = '';

for (const row of curriculum) {
    // Grade header row: "ม.1", "ม.2", etc.
    if (row.subject_id && row.subject_id.startsWith('ม.') && !row.subject_name) {
        currentGrade = row.subject_id;
        prevSubjectCode = '';
        prevSubjectName = '';
        continue;
    }

    // Skip empty rows
    const periodsStr = row.periods_per_week;
    if (!periodsStr || periodsStr === '0' || periodsStr === '0.0') continue;

    const periods = parseFloat(periodsStr);
    if (isNaN(periods) || periods <= 0) continue;

    // Resolve subject code/name (continuation rows inherit from previous)
    let subjectCode = row.subject_id || prevSubjectCode;
    let subjectName = row.subject_name || prevSubjectName;
    if (row.subject_id) prevSubjectCode = row.subject_id;
    if (row.subject_name) prevSubjectName = row.subject_name;

    // If no code, use name as code (e.g. "กิจกรรมแนะแนว", "EFF1")
    if (!subjectCode && subjectName) subjectCode = subjectName;
    if (!subjectCode) continue;

    // Parse teacher(s)
    let teacherIds = [];
    const rawTeacher = row.teacher || '';
    if (rawTeacher.startsWith('[') || rawTeacher.startsWith("'")) {
        // Parse list like "['T005', 'T010']"
        teacherIds = rawTeacher.replace(/[\[\]']/g, '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (rawTeacher) {
        teacherIds = [rawTeacher];
    }
    if (teacherIds.length === 0) continue;

    // Parse student classes
    let classIds = [];
    const rawClasses = row.student_class || '';
    if (rawClasses.startsWith('[')) {
        // Parse "[1, 2, 3, 4]" → sections within current grade
        const gradeNum = currentGrade.replace('ม.', '');
        const sections = rawClasses.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
        classIds = sections.map(sec => `${gradeNum}/${sec}`);
    }
    if (classIds.length === 0) continue;

    // Resolve room
    const rawRoom = row.room || '';
    let roomCode = '';
    if (rawRoom && !rawRoom.includes('นอกสถานที่')) {
        // Could be "['D203', 'D204']" or plain "C108-109"
        if (rawRoom.startsWith('[') || rawRoom.startsWith("'")) {
            roomCode = rawRoom.replace(/[\[\]']/g, '').split(',')[0].trim();
        } else {
            roomCode = rawRoom;
        }
    }

    // Register subject
    const variant = inferVariant(subjectCode, subjectName);
    if (!subjects[subjectCode]) {
        subjects[subjectCode] = { code: subjectCode, name: subjectName, variant };
    }
    if (roomCode && !subjectRoomMap[subjectCode]) {
        subjectRoomMap[subjectCode] = roomCode;
    }

    // Constraint parsing for team teaching
    const constraint = row.constraint || '';
    const isTeam = constraint.includes('type=TEAM') || constraint.includes('type=MULTI_CLASS_TEAM');

    // For team teaching, all teachers share the same slot — treat as single assignment per teacher
    // For regular: each teacher teaches their assigned classes
    for (const tid of teacherIds) {
        if (!teacherWorkload[tid]) teacherWorkload[tid] = new Map();
        const wMap = teacherWorkload[tid];

        if (!wMap.has(subjectCode)) {
            wMap.set(subjectCode, {
                subjectCode,
                subject: subjectName,
                variant,
                assignmentsMap: new Map(),
            });
        }

        const entry = wMap.get(subjectCode);
        for (const cid of classIds) {
            // For team teaching with multiple teachers, each gets the full periods
            // (they co-teach the same slot)
            const existing = entry.assignmentsMap.get(cid) || 0;
            if (isTeam) {
                // Team teaching: periods are shared, don't double-count
                entry.assignmentsMap.set(cid, Math.max(existing, periods));
            } else {
                // Normal: if same teacher+subject+class appears again (continuation row for different sections),
                // the periods should be the same, not additive
                entry.assignmentsMap.set(cid, Math.max(existing, periods));
            }
        }
    }
}

// ─── Generate Output ─────────────────────────────────────────────────────────

function q(s) { return `'${s.replace(/'/g, "\\'")}'`; }

let out = `// AUTO-GENERATED by scripts/generateScheduleData.mjs — DO NOT EDIT MANUALLY
// Re-run: node scripts/generateScheduleData.mjs

import {
    ScheduleItem,
    ScheduleData,
    FullDataset,
    DragPayload,
    EntityScheduleMap,
} from '../_types/schedule.types';

// Re-export for backward compatibility
export type { ScheduleItem, ScheduleData, DragPayload };

// ─── Dataset singleton ──────────────────────────────────────────────────────

let _dataset: FullDataset | null = null;
export function getFullDataset(): FullDataset {
    if (!_dataset) _dataset = generateFullScheduleDataset();
    return _dataset;
}
export function getTeacherSchedule(teacherCode: string): ScheduleData {
    return getFullDataset().teachers[teacherCode] ?? {};
}
export function getClassSchedule(classCode: string): ScheduleData {
    return getFullDataset().classes[classCode] ?? {};
}
export function getRoomSchedule(roomCode: string): ScheduleData {
    return getFullDataset().rooms[roomCode] ?? {};
}

// ─── Metadata ────────────────────────────────────────────────────────────────

`;

// TEACHER_CODES
out += `export const TEACHER_CODES = [\n`;
for (let i = 0; i < teacherCodes.length; i += 8) {
    const chunk = teacherCodes.slice(i, i + 8).map(q).join(', ');
    out += `    ${chunk},\n`;
}
out += `];\n\n`;

// CLASS_CODES
out += `export const CLASS_CODES = [\n`;
for (let i = 0; i < classCodes.length; i += 8) {
    const chunk = classCodes.slice(i, i + 8).map(q).join(', ');
    out += `    ${chunk},\n`;
}
out += `];\n\n`;

// ROOM_CODES
out += `export const ROOM_CODES = [\n`;
for (let i = 0; i < roomCodes.length; i += 8) {
    const chunk = roomCodes.slice(i, i + 8).map(q).join(', ');
    out += `    ${chunk},\n`;
}
out += `];\n\n`;

// TEACHER_META
out += `export const TEACHER_META: Record<string, { prefix: string; firstName: string; lastName: string; department: string }> = {\n`;
for (const [code, meta] of Object.entries(teacherMeta)) {
    out += `    ${q(code)}: { prefix: '', firstName: ${q(meta.firstName)}, lastName: '', department: '' },\n`;
}
out += `};\n\n`;

// CLASS_META
out += `export const CLASS_META: Record<string, { defaultRoom: string; level: string }> = {\n`;
for (const [code, meta] of Object.entries(classMeta)) {
    out += `    ${q(code)}: { defaultRoom: ${q(meta.defaultRoom)}, level: ${q(meta.level)} },\n`;
}
out += `};\n\n`;

// ROOM_META
out += `export const ROOM_META: Record<string, { name: string; type: 'homeroom' | 'specialist' }> = {\n`;
for (const [code, meta] of Object.entries(roomMeta)) {
    out += `    ${q(code)}: { name: ${q(meta.name)}, type: ${q(meta.type)} },\n`;
}
out += `};\n\n`;

// SUBJECTS
out += `export interface SubjectInfo {\n    code: string;\n    name: string;\n    variant: 'green' | 'red';\n}\n\n`;
out += `export const SUBJECTS: Record<string, SubjectInfo> = {\n`;
for (const [code, info] of Object.entries(subjects)) {
    out += `    ${q(code)}: { code: ${q(code)}, name: ${q(info.name)}, variant: ${q(info.variant)} },\n`;
}
out += `};\n\n`;

// SUBJECT_ROOM_MAP
out += `export const SUBJECT_ROOM_MAP: Record<string, string> = {\n`;
for (const [code, room] of Object.entries(subjectRoomMap)) {
    out += `    ${q(code)}: ${q(room)},\n`;
}
out += `};\n\n`;

// Legacy helper
out += `export const generateScheduleItem = (): ScheduleItem => ({
    teacher: ${q(teacherCodes[0])},
    teacherName: ${q(teacherMeta[teacherCodes[0]].firstName)},
    classCode: ${q(classCodes[0])},
    room: ${q(classMeta[classCodes[0]]?.defaultRoom || roomCodes[0])},
    roomName: ${q(roomMeta[classMeta[classCodes[0]]?.defaultRoom || roomCodes[0]]?.name || '')},
    subjectCode: ${q(Object.keys(subjects)[0])},
    subject: ${q(Object.values(subjects)[0].name)},
    variant: 'green',
});\n\n`;

// LESSONS — empty, admin fills via palette drag
out += `type RawLesson = [teacher: string, subject: string, cls: string, room: string, day: string, slot: number];\n`;
out += `const LESSONS: RawLesson[] = [];\n\n`;

// generateFullScheduleDataset
out += `export function generateFullScheduleDataset(): FullDataset {
    const teachers: EntityScheduleMap = {};
    const classes: EntityScheduleMap = {};
    const roomsMap: EntityScheduleMap = {};

    for (const [teacher, subject, cls, room, day, slot] of LESSONS) {
        const subjectInfo = SUBJECTS[subject];
        const item: ScheduleItem = {
            teacher,
            teacherName: TEACHER_META[teacher]?.firstName ?? teacher,
            classCode: cls,
            room,
            roomName: ROOM_META[room]?.name ?? room,
            subjectCode: subject,
            subject: subjectInfo?.name ?? subject,
            variant: subjectInfo?.variant ?? 'green',
        };
        if (!teachers[teacher]) teachers[teacher] = {};
        if (!teachers[teacher][day]) teachers[teacher][day] = {};
        teachers[teacher][day][slot] = item;
        if (!classes[cls]) classes[cls] = {};
        if (!classes[cls][day]) classes[cls][day] = {};
        classes[cls][day][slot] = item;
        if (!roomsMap[room]) roomsMap[room] = {};
        if (!roomsMap[room][day]) roomsMap[room][day] = {};
        roomsMap[room][day][slot] = item;
    }
    return { teachers, classes, rooms: roomsMap };
}\n\n`;

// WorkloadEntry + TEACHER_WORKLOAD
out += `export interface WorkloadEntry {
    subjectCode: string;
    subject: string;
    variant: 'green' | 'red';
    assignments: { classCode: string; room: string; periodsPerWeek: number }[];
    totalPeriods: number;
}\n\n`;

out += `export function computeTeacherWorkload(teacherCode: string): WorkloadEntry[] {
    return TEACHER_WORKLOAD[teacherCode] ?? [];
}\n\n`;

// Build TEACHER_WORKLOAD data
out += `export const TEACHER_WORKLOAD: Record<string, WorkloadEntry[]> = {\n`;
for (const [tid, wMap] of Object.entries(teacherWorkload).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (wMap.size === 0) continue;
    out += `    ${q(tid)}: [\n`;
    for (const [, entry] of wMap) {
        const assignments = [];
        let totalPeriods = 0;
        for (const [classCode, ppw] of entry.assignmentsMap) {
            const room = subjectRoomMap[entry.subjectCode] || classMeta[classCode]?.defaultRoom || '';
            assignments.push({ classCode, room, periodsPerWeek: ppw });
            totalPeriods += ppw;
        }
        out += `        {\n`;
        out += `            subjectCode: ${q(entry.subjectCode)},\n`;
        out += `            subject: ${q(entry.subject)},\n`;
        out += `            variant: ${q(entry.variant)},\n`;
        out += `            assignments: [\n`;
        for (const a of assignments) {
            out += `                { classCode: ${q(a.classCode)}, room: ${q(a.room)}, periodsPerWeek: ${a.periodsPerWeek} },\n`;
        }
        out += `            ],\n`;
        out += `            totalPeriods: ${totalPeriods},\n`;
        out += `        },\n`;
    }
    out += `    ],\n`;
}
out += `};\n`;

writeFileSync(OUT, out, 'utf-8');
console.log(`Generated ${OUT}`);
console.log(`  Teachers: ${teacherCodes.length}`);
console.log(`  Classes:  ${classCodes.length}`);
console.log(`  Rooms:    ${roomCodes.length}`);
console.log(`  Subjects: ${Object.keys(subjects).length}`);
console.log(`  Teachers with workload: ${Object.keys(teacherWorkload).length}`);
