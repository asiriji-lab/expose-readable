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
    /** Short placement summary e.g. "จ.1,2 · อ.4" — only populated when placed > 0 */
    placementSummary: string;
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

const DAY_ABBREV: Record<string, string> = {
    Monday: 'จ.', Tuesday: 'อ.', Wednesday: 'พ.', Thursday: 'พฤ.', Friday: 'ศ.',
};

interface PlacementInfo {
    count: number;
    /** e.g. "จ.1,2 · อ.4" */
    summary: string;
}

function getPlacementInfo(
    teacherCode: string,
    subjectCode: string,
    classCode: string,
    dataset: FullDataset,
): PlacementInfo {
    const teacherSchedule = dataset.teachers[teacherCode];
    if (!teacherSchedule) return { count: 0, summary: '' };

    const daySlots: Record<string, number[]> = {};
    let count = 0;

    for (const day of DAYS) {
        const slots = teacherSchedule[day];
        if (!slots) continue;
        for (const [slotStr, item] of Object.entries(slots)) {
            if (item.subjectCode === subjectCode && item.classCode === classCode) {
                count++;
                (daySlots[day] ??= []).push(Number(slotStr));
            }
        }
    }

    if (count === 0) return { count: 0, summary: '' };

    const parts: string[] = [];
    for (const day of DAYS) {
        const slots = daySlots[day];
        if (!slots) continue;
        slots.sort((a, b) => a - b);
        parts.push(`${DAY_ABBREV[day]}${slots.join(',')}`);
    }

    return { count, summary: parts.join(' · ') };
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
            const info = dataset
                ? getPlacementInfo(teacherCode, entry.subjectCode, a.classCode, dataset)
                : { count: 0, summary: '' };
            const room = resolveDefaultRoom(entry.subjectCode, a.classCode);
            return {
                teacherCode,
                teacherName,
                classCode: a.classCode,
                room,
                roomName: ROOM_META[room]?.name ?? room,
                periodsPerWeek: a.periodsPerWeek,
                placed: info.count,
                remaining: a.periodsPerWeek - info.count,
                placementSummary: info.summary,
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
                const info = dataset
                    ? getPlacementInfo(teacherCode, entry.subjectCode, a.classCode, dataset)
                    : { count: 0, summary: '' };
                const room = resolveDefaultRoom(entry.subjectCode, a.classCode);
                group.classes.push({
                    teacherCode,
                    teacherName,
                    classCode: a.classCode,
                    room,
                    roomName: ROOM_META[room]?.name ?? room,
                    periodsPerWeek: a.periodsPerWeek,
                    placed: info.count,
                    remaining: a.periodsPerWeek - info.count,
                    placementSummary: info.summary,
                });
                group.totalPeriods += a.periodsPerWeek;
                group.totalPlaced += info.count;
                group.totalRemaining += a.periodsPerWeek - info.count;
            }
        }
    }

    return Array.from(subjectMap.values());
}
