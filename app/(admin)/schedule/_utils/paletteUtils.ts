import type { FullDataset, EntityMeta, TeacherGroup } from '../_types/schedule.types';

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
    room?: string,
): PlacementInfo {
    const teacherSchedule = dataset.teachers[teacherCode];
    if (!teacherSchedule) return { count: 0, summary: '' };

    const daySlots: Record<string, number[]> = {};
    let count = 0;

    for (const day of DAYS) {
        const slots = teacherSchedule[day];
        if (!slots) continue;
        for (const [slotStr, item] of Object.entries(slots)) {
            if (item.subjectCode !== subjectCode || item.classCode !== classCode) continue;
            // When a room is specified, use it to disambiguate two assignments
            // that share the same (teacher, subject, class) but use different rooms.
            if (room && item.room && item.room !== room) continue;
            count++;
            (daySlots[day] ??= []).push(Number(slotStr));
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
            const room = resolveDefaultRoom(entry.subjectCode, a.classCode, entityMeta);
            const info = dataset
                ? getPlacementInfo(teacherCode, entry.subjectCode, a.classCode, dataset, a.room || room)
                : { count: 0, summary: '' };
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

// ─── Team Group Palette ───────────────────────────────────────────────────────

export interface TeamGroupPaletteItem {
    group: TeacherGroup;
    placed: number;
    remaining: number;
}

function countTeamGroupPlaced(group: TeacherGroup, dataset: FullDataset): number {
    const primaryCode = group.teachers[0]?.code;
    if (!primaryCode) return 0;
    const sched = dataset.teachers[primaryCode];
    if (!sched) return 0;

    let count = 0;
    for (const day of DAYS) {
        const slots = sched[day];
        if (!slots) continue;
        for (const item of Object.values(slots)) {
            if (item.subjectCode !== group.subjectCode) continue;
            // Match by class membership for both team types.
            // classCode in the dataset may be a comma-joined multi-class string
            // (e.g. "5/1, 5/2") when multiple classes share one slot — split and
            // check overlap against group.classCodes so two groups that share the
            // same primary teacher and room are counted independently.
            const itemClasses = item.classCode.split(',').map(c => c.trim());
            if (group.classCodes.some(cc => itemClasses.includes(cc))) count++;
        }
    }
    return count;
}

export function computeTeamGroupPaletteData(
    dataset: FullDataset | null,
    entityMeta: EntityMeta | null,
): TeamGroupPaletteItem[] {
    if (!entityMeta?.teacher_groups?.length) return [];
    return entityMeta.teacher_groups.map(group => {
        const placed = dataset ? countTeamGroupPlaced(group, dataset) : 0;
        return { group, placed, remaining: group.periodsPerWeek - placed };
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
                const room = resolveDefaultRoom(entry.subjectCode, a.classCode, entityMeta);
                const info = dataset
                    ? getPlacementInfo(teacherCode, entry.subjectCode, a.classCode, dataset, a.room || room)
                    : { count: 0, summary: '' };
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
