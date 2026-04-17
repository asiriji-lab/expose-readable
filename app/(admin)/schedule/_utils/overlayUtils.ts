import { ScheduleData, OverlayData, FullDataset, BandStatus, ScheduleItem } from '../_types/schedule.types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Derive per-band availability status. */
function computeBandStatus(
    entityItem: ScheduleItem | undefined,
    isSynchronized: boolean,
): BandStatus {
    if (!entityItem) return { kind: 'free' };
    if (isSynchronized) return { kind: 'your-session', occupyingItem: entityItem };
    return { kind: 'busy', occupyingItem: entityItem };
}

/** Returns true when two items represent the exact same lesson. */
function sameLessonItem(
    a: import('../_types/schedule.types').ScheduleItem | undefined,
    b: import('../_types/schedule.types').ScheduleItem | undefined,
): boolean {
    if (!a || !b) return false;
    return a.teacher === b.teacher && a.classCode === b.classCode && a.room === b.room && a.subjectCode === b.subjectCode;
}

/**
 * Compute overlay data for the View All grid.
 *
 * Each cell carries the independent lesson for each filtered entity.
 * `conflictCount` = number of entities that are busy in CONFLICTING ways (0–3).
 * `allFree` = true only when ALL THREE entities are free simultaneously.
 * `isSynchronized` = true when all 3 occupied bands refer to the same lesson.
 */
export function computeOverlayData(
    teacherSchedule: ScheduleData | null,
    classSchedule: ScheduleData | null,
    roomSchedule: ScheduleData | null,
    dataset?: FullDataset | null,
): OverlayData {
    const result: OverlayData = {};

    for (const day of DAYS) {
        result[day] = {};
        for (const slot of SLOTS) {
            const teacherItem = teacherSchedule?.[day]?.[slot];
            const classItem = classSchedule?.[day]?.[slot];
            const roomItem = roomSchedule?.[day]?.[slot];
            const hasTeacher = !!teacherItem;
            const hasClass = !!classItem;
            const hasRoom = !!roomItem;
            const busyCount = [hasTeacher, hasClass, hasRoom].filter(Boolean).length;

            // Partial occupancy: teacher is free but class or room is taken by someone else
            const partiallyOccupied = !hasTeacher && busyCount > 0;

            // Synchronized: all present bands contain the SAME lesson
            // (teacher's lesson is the same as what the class and room show for this slot)
            const teacherClassSync = hasTeacher && hasClass ? sameLessonItem(teacherItem, classItem) : true;
            const teacherRoomSync = hasTeacher && hasRoom ? sameLessonItem(teacherItem, roomItem) : true;
            const isSynchronized = busyCount > 0 && teacherClassSync && teacherRoomSync;

            // conflictCount: how many bands are occupied with DIFFERENT lessons
            // (non-synchronized entities that are busy)
            const conflictCount = isSynchronized
                ? 0
                : busyCount; // if not all the same, each busy band is a potential conflict

            result[day][slot] = {
                teacherBand: computeBandStatus(teacherItem, isSynchronized),
                classBand: computeBandStatus(classItem, isSynchronized),
                roomBand: computeBandStatus(roomItem, isSynchronized),
                teacher: teacherItem,
                class: classItem,
                room: roomItem,
                conflictCount,
                allFree: busyCount === 0,
                partiallyOccupied,
                isSynchronized,
            };
        }
    }

    return result;
}
