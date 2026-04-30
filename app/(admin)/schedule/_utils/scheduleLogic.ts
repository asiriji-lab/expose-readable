/**
 * Pure helper functions for schedule data mutations and conflict detection.
 * All functions are side-effect-free — they return new objects.
 * This file is the single source of truth for schedule integrity rules.
 */

import type {
    ScheduleItem,
    EntityScheduleMap,
    FullDataset,
} from '../_types/schedule.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConflictInfo {
    entity: 'teacher' | 'class' | 'room';
    key: string;           // entity code (e.g. '9301', '6/15', '7401')
    day: string;
    slot: number;
    existingItem: ScheduleItem;
}

export interface MoveResult {
    dataset: FullDataset;
    /** Items that were ejected due to conflicts at the target slot */
    ejected: ScheduleItem[];
}

// ─── Immutable helpers ───────────────────────────────────────────────────────

function cloneEntityMap(map: EntityScheduleMap): EntityScheduleMap {
    return structuredClone(map);
}

function deleteSlot(map: EntityScheduleMap, key: string, day: string, slot: number): void {
    if (map[key]?.[day]) {
        const dayMap = { ...map[key][day] };
        delete dayMap[slot];
        map[key] = { ...map[key], [day]: dayMap };
    }
}

function setSlot(map: EntityScheduleMap, key: string, day: string, slot: number, item: ScheduleItem): void {
    if (!map[key]) map[key] = {};
    map[key] = { ...map[key], [day]: { ...(map[key][day] ?? {}), [slot]: item } };
}

// ─── Conflict detection ──────────────────────────────────────────────────────

/**
 * Find items at `(day, slot)` that would conflict with `item` being placed there.
 * A conflict means: an entity (teacher/class/room) referenced by `item`
 * already has a DIFFERENT lesson at that slot.
 */
export function findConflictsAtSlot(
    dataset: FullDataset,
    day: string,
    slot: number,
    item: ScheduleItem,
): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    const tExisting = dataset.teachers[item.teacher]?.[day]?.[slot];
    if (tExisting && !isSameLesson(tExisting, item)) {
        conflicts.push({ entity: 'teacher', key: item.teacher, day, slot, existingItem: tExisting });
    }

    const cExisting = dataset.classes[item.classCode]?.[day]?.[slot];
    if (cExisting && !isSameLesson(cExisting, item) && !isTeamCoLesson(cExisting, item)) {
        conflicts.push({ entity: 'class', key: item.classCode, day, slot, existingItem: cExisting });
    }

    const rExisting = dataset.rooms[item.room]?.[day]?.[slot];
    if (rExisting && !isSameLesson(rExisting, item) && !isTeamCoLesson(rExisting, item)) {
        conflicts.push({ entity: 'room', key: item.room, day, slot, existingItem: rExisting });
    }

    return conflicts;
}

/**
 * Returns true if two ScheduleItems represent the same lesson.
 */
export function isSameLesson(a: ScheduleItem, b: ScheduleItem): boolean {
    return (
        a.teacher === b.teacher &&
        a.classCode === b.classCode &&
        a.room === b.room &&
        a.subjectCode === b.subjectCode
    );
}

/**
 * Returns true if two items are co-teachers of the same team lesson.
 * Allows TEAM/MULTI_CLASS_TEAM teachers to co-exist at the same class/room slot.
 */
function isTeamCoLesson(existing: ScheduleItem, incoming: ScheduleItem): boolean {
    const existingIsTeam = existing.teachingType === 'team' || existing.teachingType === 'multi_class_team';
    const incomingIsTeam = incoming.teachingType === 'team' || incoming.teachingType === 'multi_class_team';
    if (!existingIsTeam || !incomingIsTeam) return false;
    return existing.subjectCode === incoming.subjectCode && existing.room === incoming.room;
}

export function isTeamItem(item: ScheduleItem): boolean {
    return (item.teachingType === 'team' || item.teachingType === 'multi_class_team') &&
        !!(item.teamTeachers && item.teamTeachers.length > 1);
}

/**
 * Check if placing `item` at `(day, slot)` is conflict-free.
 * Optionally exclude a source slot (for grid-to-grid moves: the source will be cleared).
 */
export function hasConflict(
    dataset: FullDataset,
    day: string,
    slot: number,
    item: ScheduleItem,
    sourceDay?: string,
    sourceSlot?: number,
): boolean {
    // For grid-to-grid moves, temporarily pretend source is clear
    if (sourceDay && sourceSlot !== undefined) {
        if (sourceDay === day && sourceSlot === slot) return false; // same cell
        // Build a view of dataset without the source slot
        const virtualDataset = removeItemFromDataset(dataset, item, sourceDay, sourceSlot);
        return findConflictsAtSlot(virtualDataset, day, slot, item).length > 0;
    }
    return findConflictsAtSlot(dataset, day, slot, item).length > 0;
}

// ─── Data mutations ──────────────────────────────────────────────────────────

/**
 * Remove an item from all 3 entity maps at (day, slot).
 * Returns a new dataset (immutable).
 */
export function removeItemFromDataset(
    dataset: FullDataset,
    item: ScheduleItem,
    day: string,
    slot: number,
): FullDataset {
    const teachers = cloneEntityMap(dataset.teachers);
    const classes = cloneEntityMap(dataset.classes);
    const rooms = cloneEntityMap(dataset.rooms);

    deleteSlot(teachers, item.teacher, day, slot);
    deleteSlot(classes, item.classCode, day, slot);
    deleteSlot(rooms, item.room, day, slot);

    return { teachers, classes, rooms };
}

/**
 * Place an item in all 3 entity maps at (day, slot).
 * Returns a new dataset (immutable).
 */
export function placeItemInDataset(
    dataset: FullDataset,
    item: ScheduleItem,
    day: string,
    slot: number,
): FullDataset {
    const teachers = cloneEntityMap(dataset.teachers);
    const classes = cloneEntityMap(dataset.classes);
    const rooms = cloneEntityMap(dataset.rooms);

    setSlot(teachers, item.teacher, day, slot, item);
    setSlot(classes, item.classCode, day, slot, item);
    setSlot(rooms, item.room, day, slot, item);

    return { teachers, classes, rooms };
}

/**
 * Move a lesson from source to target. If the target has conflicting lessons,
 * they are ejected (removed from all maps and returned in `ejected`).
 *
 * This is the core "safe move" operation.
 */
export function moveItem(
    dataset: FullDataset,
    item: ScheduleItem,
    targetDay: string,
    targetSlot: number,
    sourceDay?: string,
    sourceSlot?: number,
): MoveResult {
    let current = dataset;
    const ejected: ScheduleItem[] = [];

    // 1. Clear source (for GRID→GRID moves)
    if (sourceDay && sourceSlot !== undefined) {
        current = removeItemFromDataset(current, item, sourceDay, sourceSlot);
    }

    // 2. Find and eject conflicting items at target
    const conflicts = findConflictsAtSlot(current, targetDay, targetSlot, item);
    const ejectedItems = new Set<string>(); // dedup by lesson identity

    for (const conflict of conflicts) {
        const key = `${conflict.existingItem.teacher}|${conflict.existingItem.classCode}|${conflict.existingItem.room}`;
        if (ejectedItems.has(key)) continue;
        ejectedItems.add(key);

        // Remove the conflicting lesson from ALL its entity slots at (day, slot)
        current = removeItemFromDataset(current, conflict.existingItem, targetDay, targetSlot);
        ejected.push(conflict.existingItem);
    }

    // 3. Place the moved item at target
    current = placeItemInDataset(current, item, targetDay, targetSlot);

    return { dataset: current, ejected };
}

// ─── Integrity validation ────────────────────────────────────────────────────

export interface IntegrityViolation {
    type: 'teacher_double_book' | 'class_double_book' | 'room_double_book' | 'cross_map_mismatch';
    message: string;
    day: string;
    slot: number;
    keys: string[];
}

/**
 * Validate that a FullDataset has no integrity violations:
 *   1. No entity appears twice at the same (day, slot) — guaranteed by map structure
 *   2. Cross-map consistency: if teachers[T][d][s] = item referencing class C and room R,
 *      then classes[C][d][s] and rooms[R][d][s] must hold the same item.
 *
 * Returns an empty array if data is clean.
 */
export function validateDatasetIntegrity(dataset: FullDataset): IntegrityViolation[] {
    const violations: IntegrityViolation[] = [];
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Check from teachers' perspective: every teacher lesson must exist in classes + rooms
    for (const [teacherCode, schedule] of Object.entries(dataset.teachers)) {
        for (const day of DAYS) {
            const daySlots = schedule[day];
            if (!daySlots) continue;
            for (const [slotStr, item] of Object.entries(daySlots)) {
                const slot = Number(slotStr);

                // Teacher item says classCode = C → classes[C][day][slot] must match
                const classItem = dataset.classes[item.classCode]?.[day]?.[slot];
                if (!classItem) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `teachers[${teacherCode}][${day}][${slot}] refs class ${item.classCode}, but classes map has no item there`,
                        day, slot, keys: [teacherCode, item.classCode],
                    });
                } else if (!isSameLesson(classItem, item) && !isTeamCoLesson(classItem, item)) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `teachers[${teacherCode}][${day}][${slot}] and classes[${item.classCode}][${day}][${slot}] are different lessons`,
                        day, slot, keys: [teacherCode, item.classCode],
                    });
                }

                // Teacher item says room = R → rooms[R][day][slot] must match
                const roomItem = dataset.rooms[item.room]?.[day]?.[slot];
                if (!roomItem) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `teachers[${teacherCode}][${day}][${slot}] refs room ${item.room}, but rooms map has no item there`,
                        day, slot, keys: [teacherCode, item.room],
                    });
                } else if (!isSameLesson(roomItem, item) && !isTeamCoLesson(roomItem, item)) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `teachers[${teacherCode}][${day}][${slot}] and rooms[${item.room}][${day}][${slot}] are different lessons`,
                        day, slot, keys: [teacherCode, item.room],
                    });
                }
            }
        }
    }

    // Also verify classes → teachers and rooms → teachers (reverse direction)
    for (const [classCode, schedule] of Object.entries(dataset.classes)) {
        for (const day of DAYS) {
            const daySlots = schedule[day];
            if (!daySlots) continue;
            for (const [slotStr, item] of Object.entries(daySlots)) {
                const slot = Number(slotStr);
                const teacherItem = dataset.teachers[item.teacher]?.[day]?.[slot];
                if (!teacherItem || (!isSameLesson(teacherItem, item) && !isTeamCoLesson(teacherItem, item))) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `classes[${classCode}][${day}][${slot}] refs teacher ${item.teacher}, but teachers map doesn't match`,
                        day, slot, keys: [classCode, item.teacher],
                    });
                }
            }
        }
    }

    for (const [roomCode, schedule] of Object.entries(dataset.rooms)) {
        for (const day of DAYS) {
            const daySlots = schedule[day];
            if (!daySlots) continue;
            for (const [slotStr, item] of Object.entries(daySlots)) {
                const slot = Number(slotStr);
                const teacherItem = dataset.teachers[item.teacher]?.[day]?.[slot];
                if (!teacherItem || (!isSameLesson(teacherItem, item) && !isTeamCoLesson(teacherItem, item))) {
                    violations.push({
                        type: 'cross_map_mismatch',
                        message: `rooms[${roomCode}][${day}][${slot}] refs teacher ${item.teacher}, but teachers map doesn't match`,
                        day, slot, keys: [roomCode, item.teacher],
                    });
                }
            }
        }
    }

    return violations;
}

/**
 * Scan the dataset on load and eject conflicting lessons (FCFS).
 *
 * Iterates Monday→Friday, slot 1→12. For each slot, the first lesson to claim
 * a (room, slot) or (classCode, slot) key wins; later conflicting lessons are
 * ejected from all 3 entity maps and returned in `ejected`.
 *
 * Current dummy data is conflict-free, so this is a no-op safety net for
 * when real backend-imported schedules are loaded.
 */
export function autoEjectConflicts(dataset: FullDataset): {
    dataset: FullDataset;
    ejected: { item: ScheduleItem; day: string; slot: number }[];
} {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Track which item first occupied each key so we can check TEAM/SPLIT.
    const seenItems = new Map<string, ScheduleItem>();
    let current = dataset;
    const ejected: { item: ScheduleItem; day: string; slot: number }[] = [];

    const isGroupedTeachingPair = (a: ScheduleItem, b: ScheduleItem) =>
        (a.teachingType === 'team' || a.teachingType === 'split') &&
        (b.teachingType === 'team' || b.teachingType === 'split') &&
        a.subjectCode === b.subjectCode &&
        a.classCode   === b.classCode;

    for (const day of DAYS) {
        for (const slot of SLOTS) {
            // Snapshot items at this (day, slot) across all teachers before any ejection.
            // Skip preplace items: they share empty classCode/room and would falsely conflict.
            const items: ScheduleItem[] = Object.values(current.teachers)
                .map(s => s[day]?.[slot])
                .filter((x): x is ScheduleItem => !!x && !x.isPreplace);

            for (const item of items) {
                const roomKey  = `${day}-${slot}-room-${item.room}`;
                const classKey = `${day}-${slot}-class-${item.classCode}`;

                const seenRoom  = seenItems.get(roomKey);
                const seenClass = seenItems.get(classKey);

                // Allow TEAM (same room) or SPLIT (different room, same class) through.
                const roomConflict  = seenRoom  && !isGroupedTeachingPair(item, seenRoom);
                const classConflict = seenClass && !isGroupedTeachingPair(item, seenClass);

                if (roomConflict || classConflict) {
                    current = removeItemFromDataset(current, item, day, slot);
                    ejected.push({ item, day, slot });
                } else {
                    if (!seenRoom)  seenItems.set(roomKey,  item);
                    if (!seenClass) seenItems.set(classKey, item);
                }
            }
        }
    }

    return { dataset: current, ejected };
}

/**
 * Check whether itemA (being moved from slotA) and itemB (currently at slotB / the target)
 * can be cleanly swapped: itemA → slotB, itemB → slotA, with no conflicts for either.
 * Assumes itemA is being moved from (dayA, slotA) to (dayB, slotB).
 */
export function checkSwapFeasibility(
    dataset: FullDataset,
    itemA: ScheduleItem, dayA: string, slotA: number,
    itemB: ScheduleItem, dayB: string, slotB: number,
): boolean {
    // Remove both items from the dataset
    let temp = removeItemFromDataset(dataset, itemA, dayA, slotA);
    temp = removeItemFromDataset(temp, itemB, dayB, slotB);
    // Can itemB go to itemA's old slot?
    return findConflictsAtSlot(temp, dayA, slotA, itemB).length === 0;
}

/**
 * Atomically swap two items between slots.
 * itemA moves from (dayA, slotA) to (dayB, slotB) and vice-versa.
 * Returns a new dataset — no side effects.
 */
export function swapItems(
    dataset: FullDataset,
    itemA: ScheduleItem, dayA: string, slotA: number,
    itemB: ScheduleItem, dayB: string, slotB: number,
): FullDataset {
    let current = removeItemFromDataset(dataset, itemA, dayA, slotA);
    current = removeItemFromDataset(current, itemB, dayB, slotB);
    current = placeItemInDataset(current, itemA, dayB, slotB);
    current = placeItemInDataset(current, itemB, dayA, slotA);
    return current;
}

// ─── Team item placement ─────────────────────────────────────────────────────

/**
 * Find conflicts for a team box being placed.
 * Checks each teacher, each class code, and the room.
 */
export function findConflictsForTeamItem(
    dataset: FullDataset,
    day: string,
    slot: number,
    item: ScheduleItem,
): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const seen = new Set<string>();

    const allTeachers = item.teamTeachers ?? [{ code: item.teacher, name: item.teacherName }];
    const allClasses = item.teamClassCodes ?? [item.classCode];

    for (const t of allTeachers) {
        const tExisting = dataset.teachers[t.code]?.[day]?.[slot];
        if (tExisting && !isSameLesson(tExisting, { ...item, teacher: t.code })) {
            const key = `teacher:${t.code}`;
            if (!seen.has(key)) {
                seen.add(key);
                conflicts.push({ entity: 'teacher', key: t.code, day, slot, existingItem: tExisting });
            }
        }
    }

    for (const cc of allClasses) {
        const cExisting = dataset.classes[cc]?.[day]?.[slot];
        if (cExisting && !isTeamCoLesson(cExisting, item)) {
            const key = `class:${cc}`;
            if (!seen.has(key)) {
                seen.add(key);
                conflicts.push({ entity: 'class', key: cc, day, slot, existingItem: cExisting });
            }
        }
    }

    const rExisting = dataset.rooms[item.room]?.[day]?.[slot];
    if (rExisting && !isTeamCoLesson(rExisting, item)) {
        const key = `room:${item.room}`;
        if (!seen.has(key)) {
            seen.add(key);
            conflicts.push({ entity: 'room', key: item.room, day, slot, existingItem: rExisting });
        }
    }

    return conflicts;
}

/**
 * Place a team item in all entity maps at (day, slot).
 * Each teacher gets their own entry; class(es) and room get a representative entry.
 */
export function placeTeamItemInDataset(
    dataset: FullDataset,
    item: ScheduleItem,
    day: string,
    slot: number,
): FullDataset {
    const teachers = cloneEntityMap(dataset.teachers);
    const classes = cloneEntityMap(dataset.classes);
    const rooms = cloneEntityMap(dataset.rooms);

    const allTeachers = item.teamTeachers ?? [{ code: item.teacher, name: item.teacherName }];
    const allClasses = item.teamClassCodes ?? [item.classCode];
    const repCode = allTeachers[0].code;
    const repName = allTeachers[0].name;

    for (const t of allTeachers) {
        setSlot(teachers, t.code, day, slot, { ...item, teacher: t.code, teacherName: t.name });
    }

    const repItem = { ...item, teacher: repCode, teacherName: repName };
    for (const cc of allClasses) {
        setSlot(classes, cc, day, slot, { ...repItem, classCode: cc });
    }

    setSlot(rooms, item.room, day, slot, repItem);

    return { teachers, classes, rooms };
}

/**
 * Remove a team item from all entity maps at (day, slot).
 */
export function removeTeamItemFromDataset(
    dataset: FullDataset,
    item: ScheduleItem,
    day: string,
    slot: number,
): FullDataset {
    const teachers = cloneEntityMap(dataset.teachers);
    const classes = cloneEntityMap(dataset.classes);
    const rooms = cloneEntityMap(dataset.rooms);

    const allTeachers = item.teamTeachers ?? [{ code: item.teacher, name: item.teacherName }];
    const allClasses = item.teamClassCodes ?? [item.classCode];

    for (const t of allTeachers) {
        deleteSlot(teachers, t.code, day, slot);
    }
    for (const cc of allClasses) {
        deleteSlot(classes, cc, day, slot);
    }
    deleteSlot(rooms, item.room, day, slot);

    return { teachers, classes, rooms };
}

/**
 * Move a team box from source to target. Ejects conflicting lessons and keeps eject warning.
 */
export function moveTeamItem(
    dataset: FullDataset,
    item: ScheduleItem,
    targetDay: string,
    targetSlot: number,
    sourceDay?: string,
    sourceSlot?: number,
): MoveResult {
    let current = dataset;
    const ejected: ScheduleItem[] = [];

    if (sourceDay && sourceSlot !== undefined) {
        current = removeTeamItemFromDataset(current, item, sourceDay, sourceSlot);
    }

    const conflicts = findConflictsForTeamItem(current, targetDay, targetSlot, item);
    const ejectedKeys = new Set<string>();

    for (const conflict of conflicts) {
        const key = `${conflict.existingItem.teacher}|${conflict.existingItem.classCode}|${conflict.existingItem.room}`;
        if (ejectedKeys.has(key)) continue;
        ejectedKeys.add(key);
        current = removeItemFromDataset(current, conflict.existingItem, targetDay, targetSlot);
        ejected.push(conflict.existingItem);
    }

    current = placeTeamItemInDataset(current, item, targetDay, targetSlot);
    return { dataset: current, ejected };
}

/**
 * Count total lessons across all entities (should be consistent).
 */
export function countLessons(dataset: FullDataset): { teachers: number; classes: number; rooms: number } {
    const count = (map: EntityScheduleMap) =>
        Object.values(map).reduce(
            (sum, schedule) =>
                sum + Object.values(schedule).reduce((s, day) => s + Object.keys(day).length, 0),
            0,
        );
    return {
        teachers: count(dataset.teachers),
        classes: count(dataset.classes),
        rooms: count(dataset.rooms),
    };
}
