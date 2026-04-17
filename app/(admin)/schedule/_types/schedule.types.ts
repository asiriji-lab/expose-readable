// ─── Core Entity ────────────────────────────────────────────────────────────

export interface ScheduleItem {
    teacher: string;        // teacher code e.g. "0301"
    teacherName: string;    // full Thai name
    classCode: string;      // e.g. "6/15"
    room: string;           // room code e.g. "7401"
    roomName: string;       // e.g. "Computer room"
    subjectCode: string;    // e.g. "อ21345"
    subject: string;        // Thai subject name
    variant: 'red' | 'green';
}

// ─── Schedule Maps ───────────────────────────────────────────────────────────

/** day → slot → ScheduleItem */
export type ScheduleData = Record<string, Record<number, ScheduleItem>>;

/** entityId → ScheduleData */
export type EntityScheduleMap = Record<string, ScheduleData>;

export interface FullDataset {
    teachers: EntityScheduleMap;  // keyed by teacher code
    classes: EntityScheduleMap;   // keyed by class code
    rooms: EntityScheduleMap;     // keyed by room code
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

export type BandStatusKind = 'free' | 'busy' | 'your-session';

export interface BandStatus {
    kind: BandStatusKind;
    /** The lesson occupying this entity at this slot (undefined when free) */
    occupyingItem?: ScheduleItem;
}

export interface OverlayCellData {
    // Per-band availability status (drives View All rendering)
    teacherBand: BandStatus;
    classBand: BandStatus;
    roomBand: BandStatus;

    // Legacy fields (used by popover, drag payload, summary)
    teacher?: ScheduleItem;
    class?: ScheduleItem;
    room?: ScheduleItem;
    /** 0 = all free or synced, 1..3 = N entities busy with different lessons */
    conflictCount: number;
    allFree: boolean;
    /** true when teacher is free but the class OR room is already taken by another teacher */
    partiallyOccupied: boolean;
    /**
     * true when all 3 bands contain the SAME lesson (teacher+class+room all refer to identical item).
     * false when bands are occupied by different independent lessons.
     */
    isSynchronized: boolean;
}

/** day → slot → OverlayCellData */
export type OverlayData = Record<string, Record<number, OverlayCellData>>;

// ─── UI ──────────────────────────────────────────────────────────────────────

export type ViewMode = 'all' | 'teacher' | 'class' | 'room';
export type EntityType = 'teacher' | 'class' | 'room';

export interface DragPayload {
    source: 'SIDEBAR' | 'GRID';
    item: ScheduleItem;
    day?: string;
    slot?: number;
    index?: number;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface SubjectSummaryEntry {
    subjectCode: string;
    subject: string;
    classCode: string;
    periods: number;
}

export interface EntitySummary {
    totalFilled: number;
    totalCapacity: number;
    breakdown: SubjectSummaryEntry[];
}
