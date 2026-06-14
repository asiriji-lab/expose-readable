import type { FullDataset, ScheduleItem } from '../_types/schedule.types';

export type SlotKey = string; // `${teacherCode}|${day}|${period}`

export interface MergeConflict {
  key: SlotKey;
  teacherCode: string;
  day: string;
  period: number;
  base: ScheduleItem | null;
  server: ScheduleItem | null;
  local: ScheduleItem | null;
}

export interface AutoChange {
  key: SlotKey;
  teacherCode: string;
  day: string;
  period: number;
  oldItem: ScheduleItem | null;
  server: ScheduleItem | null;
}

export interface DiffResult {
  conflicts: MergeConflict[];
  autoChanges: AutoChange[];
  hasChanges: boolean;
}

function itemsEqual(a: ScheduleItem | null, b: ScheduleItem | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.teacher === b.teacher &&
    a.classCode === b.classCode &&
    a.room === b.room &&
    a.subjectCode === b.subjectCode
  );
}

function flattenTeacherSlots(dataset: FullDataset): Map<SlotKey, ScheduleItem> {
  const map = new Map<SlotKey, ScheduleItem>();
  for (const [teacherCode, schedData] of Object.entries(dataset.teachers)) {
    for (const [day, slots] of Object.entries(schedData)) {
      for (const [periodStr, item] of Object.entries(slots as Record<string, ScheduleItem>)) {
        map.set(`${teacherCode}|${day}|${periodStr}`, item);
      }
    }
  }
  return map;
}

export function diffDatasets(
  base: FullDataset,
  local: FullDataset,
  server: FullDataset,
): DiffResult {
  const baseFlat   = flattenTeacherSlots(base);
  const localFlat  = flattenTeacherSlots(local);
  const serverFlat = flattenTeacherSlots(server);

  const allKeys = new Set([...baseFlat.keys(), ...localFlat.keys(), ...serverFlat.keys()]);

  const conflicts: MergeConflict[] = [];
  const autoChanges: AutoChange[] = [];

  for (const key of allKeys) {
    const baseItem   = baseFlat.get(key)   ?? null;
    const localItem  = localFlat.get(key)  ?? null;
    const serverItem = serverFlat.get(key) ?? null;

    if (itemsEqual(baseItem, serverItem)) continue;

    const [teacherCode, day, periodStr] = key.split('|');
    const period = Number(periodStr);
    const localChanged = !itemsEqual(baseItem, localItem);

    if (localChanged) {
      conflicts.push({ key, teacherCode, day, period, base: baseItem, server: serverItem, local: localItem });
    } else {
      autoChanges.push({ key, teacherCode, day, period, oldItem: localItem, server: serverItem });
    }
  }

  return { conflicts, autoChanges, hasChanges: conflicts.length > 0 || autoChanges.length > 0 };
}

function applySlotChange(
  dataset: FullDataset,
  oldItem: ScheduleItem | null,
  newItem: ScheduleItem | null,
  day: string,
  period: number,
): FullDataset {
  const d = structuredClone(dataset) as FullDataset;

  if (oldItem) {
    const tMap = d.teachers[oldItem.teacher];
    if (tMap?.[day]) delete (tMap[day] as Record<number, unknown>)[period];
    const cMap = d.classes[oldItem.classCode];
    if (cMap?.[day]) delete (cMap[day] as Record<number, unknown>)[period];
    const rMap = d.rooms[oldItem.room];
    if (rMap?.[day]) delete (rMap[day] as Record<number, unknown>)[period];
  }

  if (newItem) {
    if (!d.teachers[newItem.teacher]) d.teachers[newItem.teacher] = {};
    if (!d.teachers[newItem.teacher][day]) d.teachers[newItem.teacher][day] = {};
    (d.teachers[newItem.teacher][day] as Record<number, ScheduleItem>)[period] = newItem;

    if (!d.classes[newItem.classCode]) d.classes[newItem.classCode] = {};
    if (!d.classes[newItem.classCode][day]) d.classes[newItem.classCode][day] = {};
    (d.classes[newItem.classCode][day] as Record<number, ScheduleItem>)[period] = newItem;

    if (!d.rooms[newItem.room]) d.rooms[newItem.room] = {};
    if (!d.rooms[newItem.room][day]) d.rooms[newItem.room][day] = {};
    (d.rooms[newItem.room][day] as Record<number, ScheduleItem>)[period] = newItem;
  }

  return d;
}

export function applyAutoMerge(local: FullDataset, autoChanges: AutoChange[]): FullDataset {
  let result = local;
  for (const { oldItem, server, day, period } of autoChanges) {
    result = applySlotChange(result, oldItem, server, day, period);
  }
  return result;
}

export function applyResolutions(
  local: FullDataset,
  conflicts: MergeConflict[],
  resolutions: Map<SlotKey, 'mine' | 'theirs'>,
): FullDataset {
  let result = local;
  for (const conflict of conflicts) {
    if (resolutions.get(conflict.key) === 'theirs') {
      result = applySlotChange(result, conflict.local, conflict.server, conflict.day, conflict.period);
    }
  }
  return result;
}
