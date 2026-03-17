/**
 * Unit tests for schedule data integrity and conflict detection.
 *
 * Tests cover:
 *  1. Initial dataset has zero integrity violations
 *  2. isSameLesson correctly compares items
 *  3. findConflictsAtSlot detects real conflicts
 *  4. hasConflict accounts for source-slot clearing
 *  5. moveItem: basic move to empty slot
 *  6. moveItem: move to conflicting slot → auto-eject
 *  7. removeItemFromDataset clears all 3 maps
 *  8. placeItemInDataset writes to all 3 maps
 *  9. validateDatasetIntegrity catches cross-map mismatches
 * 10. countLessons returns consistent counts
 * 11. Multiple moves keep data consistent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateFullScheduleDataset } from '../dummyData';
import {
    isSameLesson,
    findConflictsAtSlot,
    hasConflict,
    moveItem,
    removeItemFromDataset,
    placeItemInDataset,
    validateDatasetIntegrity,
    countLessons,
} from '../scheduleLogic';
import type { FullDataset, ScheduleItem } from '../../_types/schedule.types';

// ─── Fixture ─────────────────────────────────────────────────────────────────

let dataset: FullDataset;

const makeItem = (overrides: Partial<ScheduleItem> = {}): ScheduleItem => ({
    teacher: '0301',
    teacherName: 'นาย ธนาโชค',
    classCode: '6/15',
    room: '7401',
    roomName: 'Computer room',
    subjectCode: 'อ21345',
    subject: 'ภาษาอังกฤษ',
    variant: 'green',
    ...overrides,
});

beforeEach(() => {
    dataset = generateFullScheduleDataset();
});

// ─── 1. Initial data integrity ───────────────────────────────────────────────

describe('Initial dataset integrity', () => {
    it('has zero integrity violations', () => {
        const violations = validateDatasetIntegrity(dataset);
        expect(violations).toEqual([]);
    });

    it('has equal lesson counts across all 3 maps', () => {
        const counts = countLessons(dataset);
        expect(counts.teachers).toBe(counts.classes);
        expect(counts.teachers).toBe(counts.rooms);
    });

    it('has 69 total lessons', () => {
        const counts = countLessons(dataset);
        expect(counts.teachers).toBe(69);
    });

    it('no teacher is double-booked', () => {
        for (const [teacherCode, schedule] of Object.entries(dataset.teachers)) {
            for (const [day, slots] of Object.entries(schedule)) {
                const slotNumbers = Object.keys(slots).map(Number);
                const unique = new Set(slotNumbers);
                expect(unique.size, `Teacher ${teacherCode} has duplicate slot on ${day}`).toBe(slotNumbers.length);
            }
        }
    });

    it('no class is double-booked', () => {
        for (const [classCode, schedule] of Object.entries(dataset.classes)) {
            for (const [day, slots] of Object.entries(schedule)) {
                const slotNumbers = Object.keys(slots).map(Number);
                const unique = new Set(slotNumbers);
                expect(unique.size, `Class ${classCode} has duplicate slot on ${day}`).toBe(slotNumbers.length);
            }
        }
    });

    it('no room is double-booked', () => {
        for (const [roomCode, schedule] of Object.entries(dataset.rooms)) {
            for (const [day, slots] of Object.entries(schedule)) {
                const slotNumbers = Object.keys(slots).map(Number);
                const unique = new Set(slotNumbers);
                expect(unique.size, `Room ${roomCode} has duplicate slot on ${day}`).toBe(slotNumbers.length);
            }
        }
    });

    it('every lesson in teachers map exists in classes and rooms maps', () => {
        for (const [tCode, schedule] of Object.entries(dataset.teachers)) {
            for (const [day, slots] of Object.entries(schedule)) {
                for (const [slotStr, item] of Object.entries(slots)) {
                    const slot = Number(slotStr);
                    const classItem = dataset.classes[item.classCode]?.[day]?.[slot];
                    expect(classItem, `Missing in classes[${item.classCode}][${day}][${slot}] for teacher ${tCode}`).toBeTruthy();
                    expect(isSameLesson(classItem!, item)).toBe(true);

                    const roomItem = dataset.rooms[item.room]?.[day]?.[slot];
                    expect(roomItem, `Missing in rooms[${item.room}][${day}][${slot}] for teacher ${tCode}`).toBeTruthy();
                    expect(isSameLesson(roomItem!, item)).toBe(true);
                }
            }
        }
    });
});

// ─── 2. isSameLesson ─────────────────────────────────────────────────────────

describe('isSameLesson', () => {
    it('returns true for identical items', () => {
        const a = makeItem();
        const b = makeItem();
        expect(isSameLesson(a, b)).toBe(true);
    });

    it('returns false if teacher differs', () => {
        const a = makeItem();
        const b = makeItem({ teacher: '9301' });
        expect(isSameLesson(a, b)).toBe(false);
    });

    it('returns false if classCode differs', () => {
        const a = makeItem();
        const b = makeItem({ classCode: '6/16' });
        expect(isSameLesson(a, b)).toBe(false);
    });

    it('returns false if room differs', () => {
        const a = makeItem();
        const b = makeItem({ room: '7402' });
        expect(isSameLesson(a, b)).toBe(false);
    });

    it('returns false if subjectCode differs', () => {
        const a = makeItem();
        const b = makeItem({ subjectCode: 'ว30101' });
        expect(isSameLesson(a, b)).toBe(false);
    });

    it('ignores variant and names for equality', () => {
        const a = makeItem({ variant: 'green', teacherName: 'A' });
        const b = makeItem({ variant: 'red', teacherName: 'B' });
        // Same teacher/class/room/subject → same lesson
        expect(isSameLesson(a, b)).toBe(true);
    });
});

// ─── 3. findConflictsAtSlot ──────────────────────────────────────────────────

describe('findConflictsAtSlot', () => {
    it('returns empty for an empty slot', () => {
        // Slot 12 on Monday is empty for teacher 0301
        const item = makeItem();
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 12, item);
        expect(conflicts).toEqual([]);
    });

    it('returns empty when placing the same lesson (idempotent)', () => {
        // Mon slot 1 already has {0301, 6/15, 7401}
        const existing = dataset.teachers['0301']['Monday'][1];
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 1, existing);
        expect(conflicts).toEqual([]);
    });

    it('detects teacher conflict', () => {
        // Mon slot 2: teacher 0301 teaches {0301, 7/1, 7403}
        // Try placing a DIFFERENT lesson for 0301 at Mon 2
        const newItem = makeItem({ classCode: '6/16', room: '7402', subjectCode: 'ว30101' });
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 2, newItem);
        const teacherConflict = conflicts.find(c => c.entity === 'teacher');
        expect(teacherConflict).toBeTruthy();
        expect(teacherConflict!.key).toBe('0301');
    });

    it('detects room conflict', () => {
        // Mon slot 1: room 7401 has {0301, 6/15, 7401}
        // Try placing a different lesson in room 7401
        const newItem = makeItem({ teacher: '9999', classCode: '9/9', room: '7401', subjectCode: 'X' });
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 1, newItem);
        const roomConflict = conflicts.find(c => c.entity === 'room');
        expect(roomConflict).toBeTruthy();
        expect(roomConflict!.key).toBe('7401');
    });

    it('detects class conflict', () => {
        // Mon slot 1: class 6/15 has {0301, 6/15, 7401}
        // Try placing a different teacher's lesson with class 6/15
        const newItem = makeItem({ teacher: '9999', classCode: '6/15', room: '7777', subjectCode: 'X' });
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 1, newItem);
        const classConflict = conflicts.find(c => c.entity === 'class');
        expect(classConflict).toBeTruthy();
        expect(classConflict!.key).toBe('6/15');
    });

    it('can detect multiple simultaneous conflicts', () => {
        // Mon slot 1: {0301, 6/15, 7401} — try placing different lesson with same teacher+class+room
        const newItem = makeItem({ subjectCode: 'DIFFERENT' });
        const conflicts = findConflictsAtSlot(dataset, 'Monday', 1, newItem);
        // teacher 0301, class 6/15, and room 7401 all conflict
        expect(conflicts.length).toBe(3);
    });
});

// ─── 4. hasConflict ──────────────────────────────────────────────────────────

describe('hasConflict', () => {
    it('returns false for empty target slot', () => {
        const item = makeItem();
        expect(hasConflict(dataset, 'Monday', 12, item)).toBe(false);
    });

    it('returns true when target slot has conflicting entity', () => {
        // Mon slot 2: 0301 is already teaching there
        const item = makeItem({ classCode: '6/16', room: '7402' });
        expect(hasConflict(dataset, 'Monday', 2, item)).toBe(true);
    });

    it('returns false when moving same cell onto itself', () => {
        const item = dataset.teachers['0301']['Monday'][1];
        expect(hasConflict(dataset, 'Monday', 1, item, 'Monday', 1)).toBe(false);
    });

    it('accounts for source-slot clearing in grid-to-grid moves', () => {
        // Mon slot 1: {0301, 6/15, 7401}
        // Move to Mon slot 9 (empty) — should be fine
        const item = dataset.teachers['0301']['Monday'][1];
        expect(hasConflict(dataset, 'Monday', 9, item, 'Monday', 1)).toBe(false);
    });

    it('detects conflict even after source clearing if target has different lesson', () => {
        // Mon slot 1: {0301, 6/15, 7401}
        // Mon slot 2: room 7403 has {0301, 7/1, 7403}
        // Try moving Mon 1 item to Mon 2 — teacher 0301 at Mon 2 conflicts
        const item = dataset.teachers['0301']['Monday'][1];
        expect(hasConflict(dataset, 'Monday', 2, item, 'Monday', 1)).toBe(true);
    });
});

// ─── 5. moveItem — basic move to empty slot ──────────────────────────────────

describe('moveItem — basic (no conflict)', () => {
    it('grid-to-grid move to empty slot', () => {
        const item = dataset.teachers['0301']['Monday'][1]; // {0301, 6/15, 7401}
        const { dataset: result, ejected } = moveItem(dataset, item, 'Monday', 9, 'Monday', 1);

        expect(ejected).toEqual([]);

        // Source cleared
        expect(result.teachers['0301']['Monday'][1]).toBeUndefined();
        expect(result.classes['6/15']['Monday'][1]).toBeUndefined();
        expect(result.rooms['7401']['Monday'][1]).toBeUndefined();

        // Target set
        expect(result.teachers['0301']['Monday'][9]).toEqual(item);
        expect(result.classes['6/15']['Monday'][9]).toEqual(item);
        expect(result.rooms['7401']['Monday'][9]).toEqual(item);

        // Integrity preserved
        expect(validateDatasetIntegrity(result)).toEqual([]);
    });

    it('sidebar-to-grid move (no source to clear)', () => {
        const item = makeItem();
        const { dataset: result, ejected } = moveItem(dataset, item, 'Monday', 12);

        expect(ejected).toEqual([]);
        expect(result.teachers['0301']['Monday'][12]).toEqual(item);
        expect(result.classes['6/15']['Monday'][12]).toEqual(item);
        expect(result.rooms['7401']['Monday'][12]).toEqual(item);

        expect(validateDatasetIntegrity(result)).toEqual([]);
    });

    it('lesson count stays consistent after a basic move', () => {
        const item = dataset.teachers['0301']['Monday'][1];
        const { dataset: result } = moveItem(dataset, item, 'Monday', 9, 'Monday', 1);
        const counts = countLessons(result);
        expect(counts.teachers).toBe(counts.classes);
        expect(counts.teachers).toBe(counts.rooms);
        expect(counts.teachers).toBe(69); // same count, just relocated
    });
});

// ─── 6. moveItem — auto-eject on conflict ────────────────────────────────────

describe('moveItem — conflict + auto-eject', () => {
    it('ejects conflicting item when room overlaps', () => {
        // Place a custom item at Mon slot 10 in room 7401
        const occupant = makeItem({ teacher: '9999', classCode: '9/9', room: '7401', subjectCode: 'X', subject: 'X' });
        let current = placeItemInDataset(dataset, occupant, 'Monday', 10);

        // Move {0301, 6/15, 7401} to Mon slot 10 — room 7401 conflicts
        const mover = makeItem();
        const { dataset: result, ejected } = moveItem(current, mover, 'Monday', 10);

        expect(ejected.length).toBe(1);
        expect(ejected[0].teacher).toBe('9999');

        // Mover is at target
        expect(result.teachers['0301']['Monday'][10]).toEqual(mover);
        expect(result.rooms['7401']['Monday'][10]).toEqual(mover);

        // Occupant is gone from all maps at that slot
        expect(result.teachers['9999']?.['Monday']?.[10]).toBeUndefined();
        expect(result.rooms['7401']['Monday'][10]).toEqual(mover);

        // Integrity preserved
        expect(validateDatasetIntegrity(result)).toEqual([]);
    });

    it('ejects multiple conflicting items when teacher and room overlap', () => {
        // Create a dataset with two conflicting items at Mon 11
        const itemA = makeItem({ teacher: '9301', classCode: '6/16', room: '7401', subjectCode: 'A' });
        const itemB = makeItem({ teacher: '0301', classCode: '7/2', room: '7402', subjectCode: 'B' });
        let current = placeItemInDataset(dataset, itemA, 'Monday', 11);
        current = placeItemInDataset(current, itemB, 'Monday', 11);

        // Move a new item with teacher=0301, room=7401 → conflicts with both
        const mover = makeItem({ teacher: '0301', classCode: '6/15', room: '7401' });
        const { dataset: result, ejected } = moveItem(current, mover, 'Monday', 11);

        // Both itemA (room 7401) and itemB (teacher 0301) should be ejected
        expect(ejected.length).toBe(2);
        expect(ejected.map(e => e.teacher).sort()).toEqual(['0301', '9301']);

        // Mover is at target
        expect(result.teachers['0301']['Monday'][11]).toEqual(mover);
        expect(result.rooms['7401']['Monday'][11]).toEqual(mover);
        expect(result.classes['6/15']['Monday'][11]).toEqual(mover);

        expect(validateDatasetIntegrity(result)).toEqual([]);
    });
});

// ─── 7. removeItemFromDataset ────────────────────────────────────────────────

describe('removeItemFromDataset', () => {
    it('clears item from all 3 maps', () => {
        const item = dataset.teachers['0301']['Monday'][1];
        const result = removeItemFromDataset(dataset, item, 'Monday', 1);

        expect(result.teachers['0301']['Monday'][1]).toBeUndefined();
        expect(result.classes['6/15']['Monday'][1]).toBeUndefined();
        expect(result.rooms['7401']['Monday'][1]).toBeUndefined();
    });

    it('does not mutate original dataset', () => {
        const original = dataset.teachers['0301']['Monday'][1];
        removeItemFromDataset(dataset, original, 'Monday', 1);

        // Original unchanged
        expect(dataset.teachers['0301']['Monday'][1]).toEqual(original);
    });

    it('lesson count decreases by 1', () => {
        const item = dataset.teachers['0301']['Monday'][1];
        const result = removeItemFromDataset(dataset, item, 'Monday', 1);
        const counts = countLessons(result);
        expect(counts.teachers).toBe(68);
        expect(counts.classes).toBe(68);
        expect(counts.rooms).toBe(68);
    });
});

// ─── 8. placeItemInDataset ───────────────────────────────────────────────────

describe('placeItemInDataset', () => {
    it('writes item to all 3 maps', () => {
        const item = makeItem();
        const result = placeItemInDataset(dataset, item, 'Friday', 12);

        expect(result.teachers['0301']['Friday'][12]).toEqual(item);
        expect(result.classes['6/15']['Friday'][12]).toEqual(item);
        expect(result.rooms['7401']['Friday'][12]).toEqual(item);
    });

    it('does not mutate original dataset', () => {
        const item = makeItem();
        placeItemInDataset(dataset, item, 'Friday', 12);

        expect(dataset.teachers['0301']['Friday']?.[12]).toBeUndefined();
    });
});

// ─── 9. validateDatasetIntegrity ─────────────────────────────────────────────

describe('validateDatasetIntegrity', () => {
    it('clean data has no violations', () => {
        expect(validateDatasetIntegrity(dataset)).toEqual([]);
    });

    it('detects cross-map mismatch if teacher map entry disagrees with class map', () => {
        // Corrupt the class map: change class entry at Mon 1 to a different lesson
        const corrupted = {
            teachers: { ...dataset.teachers },
            classes: JSON.parse(JSON.stringify(dataset.classes)),
            rooms: { ...dataset.rooms },
        } as FullDataset;

        // Change class 6/15's Mon 1 entry to have different teacher
        corrupted.classes['6/15']['Monday'][1] = makeItem({ teacher: '9999' });

        const violations = validateDatasetIntegrity(corrupted);
        expect(violations.length).toBeGreaterThan(0);
        expect(violations.some(v => v.type === 'cross_map_mismatch')).toBe(true);
    });

    it('detects cross-map mismatch if room map entry is missing', () => {
        const corrupted = {
            teachers: { ...dataset.teachers },
            classes: { ...dataset.classes },
            rooms: JSON.parse(JSON.stringify(dataset.rooms)),
        } as FullDataset;

        // Delete room entry
        delete corrupted.rooms['7401']['Monday'][1];

        const violations = validateDatasetIntegrity(corrupted);
        expect(violations.length).toBeGreaterThan(0);
    });
});

// ─── 10. countLessons ────────────────────────────────────────────────────────

describe('countLessons', () => {
    it('all 3 maps have the same count', () => {
        const counts = countLessons(dataset);
        expect(counts.teachers).toBe(counts.classes);
        expect(counts.teachers).toBe(counts.rooms);
    });
});

// ─── 11. Chain of moves keeps data consistent ────────────────────────────────

describe('Multiple sequential moves', () => {
    it('5 consecutive moves maintain integrity', () => {
        let current = dataset;

        // Move 1: Mon 1 → Mon 9
        const item1 = current.teachers['0301']['Monday'][1];
        let result = moveItem(current, item1, 'Monday', 9, 'Monday', 1);
        current = result.dataset;
        expect(validateDatasetIntegrity(current)).toEqual([]);

        // Move 2: Mon 9 → Fri 12
        const item2 = current.teachers['0301']['Monday'][9];
        result = moveItem(current, item2, 'Friday', 12, 'Monday', 9);
        current = result.dataset;
        expect(validateDatasetIntegrity(current)).toEqual([]);

        // Move 3: a different teacher's item Tue 1 → Tue 10
        const item3 = current.teachers['9301']['Tuesday'][1];
        result = moveItem(current, item3, 'Tuesday', 10, 'Tuesday', 1);
        current = result.dataset;
        expect(validateDatasetIntegrity(current)).toEqual([]);

        // Move 4: move item to a slot that has a conflict (auto-eject)
        const item4 = current.teachers['0301']['Friday'][12]; // the item we moved earlier
        const targetItem = current.teachers['9302']?.['Monday']?.[8]; // 9302 at Mon 8
        if (targetItem) {
            result = moveItem(current, item4, 'Monday', 8, 'Friday', 12);
            current = result.dataset;
            // If there was a room conflict, ejected should have the old item
            expect(validateDatasetIntegrity(current)).toEqual([]);
        }

        // Move 5: sidebar insert (no source)
        const sidebarItem = makeItem({ teacher: '9304', classCode: '7/2', room: '7402', subjectCode: 'พ30101', subject: 'พลศึกษา' });
        result = moveItem(current, sidebarItem, 'Wednesday', 12);
        current = result.dataset;
        expect(validateDatasetIntegrity(current)).toEqual([]);

        // Final counts should still be consistent
        const counts = countLessons(current);
        expect(counts.teachers).toBe(counts.classes);
        expect(counts.teachers).toBe(counts.rooms);
    });
});
