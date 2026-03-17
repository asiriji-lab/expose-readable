import type { FullDataset } from '../_types/schedule.types';
import {
    TEACHER_WORKLOAD,
    TEACHER_CODES,
    TEACHER_META,
    CLASS_META,
    ROOM_META,
    SUBJECT_ROOM_MAP,
} from './dummyData';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaletteClassItem {
    teacherCode: string;
    teacherName: string;
    classCode: string;
    room: string;           // resolved default room
    roomName: string;
    periodsPerWeek: number;
    placed: number;
    remaining: number;
}

export interface PaletteSubjectGroup {
    subjectCode: string;
    subject: string;
    variant: 'red' | 'green';
    classes: PaletteClassItem[];
    totalPeriods: number;
    totalPlaced: number;
    totalRemaining: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the best default room: specialist room first, then class homeroom. */
export function resolveDefaultRoom(subjectCode: string, classCode: string): string {
    return SUBJECT_ROOM_MAP[subjectCode] ?? CLASS_META[classCode]?.defaultRoom ?? '';
}

function buildTeacherName(teacherCode: string): string {
    const meta = TEACHER_META[teacherCode];
    return meta ? `${meta.firstName} ${meta.lastName}` : teacherCode;
}

function countPlacedForAssignment(
    teacherCode: string,
    subjectCode: string,
    classCode: string,
    dataset: FullDataset,
): number {
    const teacherSchedule = dataset.teachers[teacherCode];
    if (!teacherSchedule) return 0;
    let count = 0;
    for (const day of DAYS) {
        const daySlots = teacherSchedule[day];
        if (!daySlots) continue;
        for (const item of Object.values(daySlots)) {
            if (item.subjectCode === subjectCode && item.classCode === classCode) count++;
        }
    }
    return count;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute palette data for a single teacher.
 * Returns subject groups with their class items (including placed/remaining counts).
 */
export function computePaletteData(
    teacherCode: string,
    dataset: FullDataset | null,
): PaletteSubjectGroup[] {
    const workload = TEACHER_WORKLOAD[teacherCode] ?? [];
    const teacherName = buildTeacherName(teacherCode);

    return workload.map(entry => {
        const classes: PaletteClassItem[] = entry.assignments.map(a => {
            const placed = dataset
                ? countPlacedForAssignment(teacherCode, entry.subjectCode, a.classCode, dataset)
                : 0;
            const room = resolveDefaultRoom(entry.subjectCode, a.classCode);
            return {
                teacherCode,
                teacherName,
                classCode: a.classCode,
                room,
                roomName: ROOM_META[room]?.name ?? room,
                periodsPerWeek: a.periodsPerWeek,
                placed,
                remaining: a.periodsPerWeek - placed,
            };
        });

        const totalPlaced = classes.reduce((s, c) => s + c.placed, 0);
        const totalPeriods = classes.reduce((s, c) => s + c.periodsPerWeek, 0);

        return {
            subjectCode: entry.subjectCode,
            subject: entry.subject,
            variant: entry.variant,
            classes,
            totalPeriods,
            totalPlaced,
            totalRemaining: totalPeriods - totalPlaced,
        };
    });
}

/**
 * Compute palette data across ALL teachers.
 * Merges items under shared subject codes; each PaletteClassItem carries
 * its own teacherCode so drag payloads remain correct.
 */
export function computeGlobalPaletteData(
    dataset: FullDataset | null,
): PaletteSubjectGroup[] {
    const subjectMap = new Map<string, PaletteSubjectGroup>();

    for (const teacherCode of TEACHER_CODES) {
        const workload = TEACHER_WORKLOAD[teacherCode] ?? [];
        const teacherName = buildTeacherName(teacherCode);

        for (const entry of workload) {
            let group = subjectMap.get(entry.subjectCode);
            if (!group) {
                group = {
                    subjectCode: entry.subjectCode,
                    subject: entry.subject,
                    variant: entry.variant,
                    classes: [],
                    totalPeriods: 0,
                    totalPlaced: 0,
                    totalRemaining: 0,
                };
                subjectMap.set(entry.subjectCode, group);
            }

            for (const a of entry.assignments) {
                const placed = dataset
                    ? countPlacedForAssignment(teacherCode, entry.subjectCode, a.classCode, dataset)
                    : 0;
                const room = resolveDefaultRoom(entry.subjectCode, a.classCode);
                group.classes.push({
                    teacherCode,
                    teacherName,
                    classCode: a.classCode,
                    room,
                    roomName: ROOM_META[room]?.name ?? room,
                    periodsPerWeek: a.periodsPerWeek,
                    placed,
                    remaining: a.periodsPerWeek - placed,
                });
                group.totalPeriods += a.periodsPerWeek;
                group.totalPlaced += placed;
                group.totalRemaining += a.periodsPerWeek - placed;
            }
        }
    }

    return Array.from(subjectMap.values());
}
