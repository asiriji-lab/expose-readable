// ─── Core Entity ────────────────────────────────────────────────────────────

/**
 * 'team'  — multiple teachers co-teach ALL students in the same room simultaneously.
 * 'split' — students are divided into groups; each group studies with a different
 *           teacher in a different room at the same slot for the same subject.
 */
export type TeachingType = 'standard' | 'team' | 'split' | 'multi_class_team';

export interface ScheduleItem {
    teacher: string;        // teacher code e.g. "0301"
    teacherName: string;    // full Thai name
    classCode: string;      // e.g. "6/15"
    room: string;           // room code e.g. "7401"
    roomName: string;       // e.g. "Computer room"
    subjectCode: string;    // e.g. "อ21345"
    subject: string;        // Thai subject name
    variant: string;        // first char of subjectCode, or '_activity'
    /** Populated by the transform post-pass when multiple teachers share a slot. */
    teachingType?: TeachingType;
    /** True for pre-placed activity slots (Homeroom, Lunch, Bridging, ลูกเสือ, etc.). */
    isPreplace?: boolean;
    /** For TEAM/MULTI_CLASS_TEAM drag boxes: all co-teachers including primary. */
    teamTeachers?: { code: string; name: string }[];
    /** For MULTI_CLASS_TEAM drag boxes: all class codes taught together. */
    teamClassCodes?: string[];
}

// ─── Entity Metadata (computed from input CSVs, stored in DB) ────────────────

export interface TeacherMetaEntry {
    name: string;
    department: string;
}

export interface ClassMetaEntry {
    defaultRoom: string;
    level: string;
}

export interface RoomMetaEntry {
    name: string;
    type: 'homeroom' | 'specialist';
}

export interface SubjectInfo {
    code: string;
    name: string;
    variant: string;
}

export interface WorkloadAssignment {
    classCode: string;
    room: string;
    periodsPerWeek: number;
    /** Backend-provided MULTI_CLASS_TEAM fields */
    studentClasses?: string[];
    isMultiClass?: boolean;
    coTeacherIds?: string[];
}

export interface WorkloadEntry {
    subjectCode: string;
    subject: string;
    variant: string;
    assignments: WorkloadAssignment[];
    totalPeriods: number;
}

export interface TeacherGroup {
    id: string;
    type: 'team' | 'multi_class_team';
    teachers: { code: string; name: string }[];
    subjectCode: string;
    subject: string;
    variant: string;
    classCodes: string[];
    room: string;
    periodsPerWeek: number;
}

export interface EntityMeta {
    teacher_codes: string[];
    teacher_meta: Record<string, TeacherMetaEntry>;
    class_codes: string[];
    class_meta: Record<string, ClassMetaEntry>;
    room_codes: string[];
    room_meta: Record<string, RoomMetaEntry>;
    subjects: Record<string, SubjectInfo>;
    subject_room_map: Record<string, string>;
    teacher_workload: Record<string, WorkloadEntry[]>;
    teacher_groups?: TeacherGroup[];
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

// ─── Grouped Slots (SPLIT teaching) ──────────────────────────────────────────

/** One teacher+room group within a SPLIT-teaching slot. */
export interface SlotGroup {
    teacherCode: string;
    teacherName: string;
    room: string;
    roomName: string;
}

/**
 * Maps SPLIT lessons to their constituent groups.
 * Indexed: classCode → day → slot → SlotGroup[]
 */
export type GroupedSlots = Record<string, Record<string, Record<number, SlotGroup[]>>>;

// ─── Overlay ─────────────────────────────────────────────────────────────────

export type BandStatusKind = 'free' | 'busy' | 'your-session' | 'preplace';

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
