import { ScheduleData, OverlayData, EntitySummary, SubjectSummaryEntry } from '../_types/schedule.types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const TOTAL_CAPACITY = DAYS.length * SLOTS.length; // 60

export function computeEntitySummary(schedule: ScheduleData | null): EntitySummary {
    if (!schedule) return { totalFilled: 0, totalCapacity: TOTAL_CAPACITY, breakdown: [] };

    const breakdownMap: Map<string, SubjectSummaryEntry> = new Map();
    let totalFilled = 0;

    DAYS.forEach(day => {
        SLOTS.forEach(slot => {
            const item = schedule[day]?.[slot];
            if (!item) return;
            totalFilled++;

            const key = `${item.subjectCode}|${item.classCode}`;
            const existing = breakdownMap.get(key);
            if (existing) {
                existing.periods++;
            } else {
                breakdownMap.set(key, {
                    subjectCode: item.subjectCode,
                    subject: item.subject,
                    classCode: item.classCode,
                    periods: 1,
                });
            }
        });
    });

    const breakdown = Array.from(breakdownMap.values()).sort((a, b) => b.periods - a.periods);
    return { totalFilled, totalCapacity: TOTAL_CAPACITY, breakdown };
}

export interface OverlaySummary {
    teacherStats: { filled: number; capacity: number } | null;
    classStats:   { filled: number; capacity: number } | null;
    roomStats:    { filled: number; capacity: number } | null;
    conflictCount: number;
    freeCount: number;
}

export function computeOverlaySummary(overlay: OverlayData): OverlaySummary {
    let teacherFilled = 0;
    let classFilled = 0;
    let roomFilled = 0;
    let conflictCount = 0;
    let freeCount = 0;

    DAYS.forEach(day => {
        SLOTS.forEach(slot => {
            const cell = overlay[day]?.[slot];
            if (!cell) return;
            if (cell.teacher) teacherFilled++;
            if (cell.class) classFilled++;
            if (cell.room) roomFilled++;
            if (cell.allFree) freeCount++;
            if (cell.conflictCount >= 2) conflictCount++;
        });
    });

    return {
        teacherStats:  { filled: teacherFilled, capacity: TOTAL_CAPACITY },
        classStats:    { filled: classFilled,   capacity: TOTAL_CAPACITY },
        roomStats:     { filled: roomFilled,    capacity: TOTAL_CAPACITY },
        conflictCount,
        freeCount,
    };
}
