import type { FullDataset, EntityMeta } from '../_types/schedule.types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaletteClassItem {
    teacherCode: string;
    teacherName: string;
    classCode: string;
    room: string;
    roomName: string;
    periodsPerWeek: number;
    placed: number;
    remaining: number;
    /** Short placement summary e.g. "จ.1,2 · อ.4" */
    placementSummary: string;
}

export interface PaletteSubjectGroup {
    subjectCode: string;
    subject: string;
    variant: string;
    classes: PaletteClassItem[];
    totalPeriods: number;
    totalPlaced: number;
    totalRemaining: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the best default room: specialist room first, then class homeroom. */
export function resolveDefaultRoom(
    subjectCode: string,
    classCode: string,
    entityMeta: EntityMeta | null,
): string {
    if (!entityMeta) return '';
    return entityMeta.subject_room_map[subjectCode]
        ?? entityMeta.class_meta[classCode]?.defaultRoom
        ?? '';
}

function buildTeacherName(teacherCode: string, entityMeta: EntityMeta | null): string {
    return entityMeta?.teacher_meta[teacherCode]?.name ?? teacherCode;
}

const DAY_ABBREV: Record<string, string> = {
    Monday: 'จ.', Tuesday: 'อ.', Wednesday: 'พ.', Thursday: 'พฤ.', Friday: 'ศ.',
};

interface PlacementInfo {
    count: number;
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

export function computePaletteData(
    teacherCode: string,
    dataset: FullDataset | null,
    entityMeta: EntityMeta | null,
): PaletteSubjectGroup[] {
    if (!entityMeta) return [];
    const workload = entityMeta.teacher_workload[teacherCode] ?? [];
    const teacherName = buildTeacherName(teacherCode, entityMeta);

    return workload.map(entry => {
        const classes: PaletteClassItem[] = entry.assignments.map(a => {
            const info = dataset
                ? getPlacementInfo(teacherCode, entry.subjectCode, a.classCode, dataset)
                : { count: 0, summary: '' };
            const room = resolveDefaultRoom(entry.subjectCode, a.classCode, entityMeta);
            return {
                teacherCode,
                teacherName,
                classCode: a.classCode,
                room,
                roomName: entityMeta.room_meta[room]?.name ?? room,
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

export function computeGlobalPaletteData(
    dataset: FullDataset | null,
    entityMeta: EntityMeta | null,
): PaletteSubjectGroup[] {
    if (!entityMeta) return [];
    const subjectMap = new Map<string, PaletteSubjectGroup>();

    for (const teacherCode of entityMeta.teacher_codes) {
        const workload = entityMeta.teacher_workload[teacherCode] ?? [];
        const teacherName = buildTeacherName(teacherCode, entityMeta);

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
                const room = resolveDefaultRoom(entry.subjectCode, a.classCode, entityMeta);
                group.classes.push({
                    teacherCode,
                    teacherName,
                    classCode: a.classCode,
                    room,
                    roomName: entityMeta.room_meta[room]?.name ?? room,
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
