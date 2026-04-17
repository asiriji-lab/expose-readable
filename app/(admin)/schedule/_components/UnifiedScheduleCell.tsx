'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { OverlayCellData, ScheduleItem } from '../_types/schedule.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CellMode = 'overlay' | 'individual';

export interface CellRow {
    label: string;        // 'Subject' | 'Teacher' | 'Class' | 'Room'
    value: string | null; // display text, null → shows dash
    weight: 'primary' | 'secondary' | 'tertiary';
}

interface UnifiedScheduleCellProps {
    /** 'overlay' = View All mode, 'individual' = teacher/class/room view */
    mode: CellMode;
    /** Rows to render, ordered top→bottom */
    rows: CellRow[];
    /** Variant color for individual mode */
    variant?: 'red' | 'green' | null;
    /** Conflict count for overlay mode (0-3) */
    conflictCount?: number;
    /** Whether all entities are free (overlay mode) */
    allFree?: boolean;
    /** Is this cell currently a drop target? */
    isDropTarget?: boolean;
    /** Is this cell an invalid drop target (conflict)? */
    isConflictTarget?: boolean;
    /** Is this cell being dragged? */
    isDragging?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Extra className */
    className?: string;
}

// ─── Row height ──────────────────────────────────────────────────────────────

const ROW_HEIGHT = 32; // px per row — tighter than before (was 40)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeightStyles(weight: CellRow['weight']): string {
    switch (weight) {
        case 'primary':
            return 'font-semibold text-foreground text-[11px]';
        case 'secondary':
            return 'font-medium text-foreground text-[10px]';
        case 'tertiary':
            return 'text-foreground-muted text-[10px]';
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UnifiedScheduleCell({
    mode,
    rows,
    variant = null,
    conflictCount = 0,
    allFree = false,
    isDropTarget = false,
    isConflictTarget = false,
    isDragging = false,
    onClick,
    className = '',
}: UnifiedScheduleCellProps) {
    const hasContent = rows.some(r => r.value !== null);

    // ── Background logic ──────────────────────────────────────────────────
    let bgClass: string;
    let borderClass = '';

    if (isConflictTarget) {
        // Drag hover → conflict
        bgClass = 'bg-red-100';
        borderClass = 'ring-2 ring-red-400 ring-inset';
    } else if (isDropTarget) {
        // Drag hover → valid drop
        bgClass = 'bg-primary-light';
        borderClass = 'ring-2 ring-primary ring-inset';
    } else if (mode === 'overlay') {
        if (allFree) {
            bgClass = 'bg-surface';
            borderClass = 'border border-dashed border-border';
        } else if (conflictCount >= 1) {
            // Real conflict: an entity is double-booked
            bgClass = 'bg-red-50';
            borderClass = 'border border-red-300';
        } else {
            bgClass = 'bg-emerald-50';
            borderClass = 'border-l-[3px] border-l-emerald-400';
        }
    } else {
        // Individual mode
        if (!hasContent) {
            bgClass = 'bg-surface';
            borderClass = 'border border-dashed border-border';
        } else if (variant === 'red') {
            bgClass = 'bg-pink-50';
            borderClass = 'border-l-[3px] border-l-pink-400';
        } else if (variant === 'green') {
            bgClass = 'bg-emerald-50';
            borderClass = 'border-l-[3px] border-l-emerald-400';
        } else {
            bgClass = 'bg-surface';
        }
    }

    // ── Drag state ────────────────────────────────────────────────────────
    const dragOpacity = isDragging ? 'opacity-40' : '';
    const dropScale = isDropTarget ? 'scale-[1.02]' : '';

    // ── Clickable ─────────────────────────────────────────────────────────
    const clickStyles = onClick
        ? 'cursor-pointer hover:brightness-[0.97] active:brightness-95 transition-all duration-100'
        : '';

    return (
        <motion.div
            layout
            className={[
                'relative flex flex-col w-full overflow-hidden transition-shadow duration-150',
                bgClass,
                borderClass,
                dragOpacity,
                dropScale,
                clickStyles,
                className,
            ].filter(Boolean).join(' ')}
            style={{ height: `${rows.length * ROW_HEIGHT}px` }}
            onClick={onClick}
        >
            {/* Conflict badge (overlay mode) — only for REAL double-bookings */}
            {mode === 'overlay' && conflictCount >= 1 && (
                <span className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                    <svg className="w-2 h-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {conflictCount}
                </span>
            )}

            {/* Variant dot (individual mode) */}
            {mode === 'individual' && hasContent && variant && (
                <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${variant === 'red' ? 'bg-pink-400' : 'bg-emerald-400'}`} />
            )}

            {/* Rows */}
            <AnimatePresence mode="popLayout">
                {rows.map((row, i) => (
                    <motion.div
                        key={row.label}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15, delay: i * 0.03 }}
                        className={[
                            'flex items-center justify-center px-1.5 overflow-hidden',
                            getWeightStyles(row.weight),
                            i > 0 ? 'border-t border-border/50' : '',
                        ].join(' ')}
                        style={{ height: `${ROW_HEIGHT}px` }}
                    >
                        <span className="truncate w-full text-center leading-tight">
                            {row.value ?? (
                                <span className="text-foreground-muted/40">—</span>
                            )}
                        </span>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Empty state center text */}
            {!hasContent && mode === 'individual' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-foreground-muted/30 uppercase tracking-wider font-medium">empty</span>
                </div>
            )}
        </motion.div>
    );
}

// ─── Builder helpers ─────────────────────────────────────────────────────────

/** Build rows for View All mode from OverlayCellData.
 *  Shows ONE lesson (the teacher's) — all 3 rows come from the same ScheduleItem. */
export function buildOverlayRows(data: OverlayCellData): CellRow[] {
    const item = data.teacher; // teacher's lesson is the primary source
    return [
        { label: 'Subject', value: item?.subjectCode ?? null, weight: 'primary' },
        { label: 'Class', value: item?.classCode ?? null, weight: 'secondary' },
        { label: 'Room', value: item?.room ?? null, weight: 'tertiary' },
    ];
}

/** Build rows for individual Teacher view */
export function buildTeacherRows(item: ScheduleItem | undefined): CellRow[] {
    return [
        { label: 'Subject', value: item?.subjectCode ?? null, weight: 'primary' },
        { label: 'Class', value: item?.classCode ?? null, weight: 'secondary' },
        { label: 'Room', value: item?.room ?? null, weight: 'tertiary' },
    ];
}

/** Build rows for individual Class view */
export function buildClassRows(item: ScheduleItem | undefined): CellRow[] {
    return [
        { label: 'Subject', value: item?.subjectCode ?? null, weight: 'primary' },
        { label: 'Teacher', value: item?.teacherName ?? null, weight: 'secondary' },
        { label: 'Room', value: item?.room ?? null, weight: 'tertiary' },
    ];
}

/** Build rows for individual Room view */
export function buildRoomRows(item: ScheduleItem | undefined): CellRow[] {
    return [
        { label: 'Subject', value: item?.subjectCode ?? null, weight: 'primary' },
        { label: 'Teacher', value: item?.teacherName ?? null, weight: 'secondary' },
        { label: 'Class', value: item?.classCode ?? null, weight: 'tertiary' },
    ];
}

/** Build rows based on view mode */
export function buildRowsForMode(
    viewMode: 'all' | 'teacher' | 'class' | 'room',
    item?: ScheduleItem,
    overlayData?: OverlayCellData,
): CellRow[] {
    if (viewMode === 'all' && overlayData) return buildOverlayRows(overlayData);
    if (viewMode === 'teacher') return buildTeacherRows(item);
    if (viewMode === 'class') return buildClassRows(item);
    if (viewMode === 'room') return buildRoomRows(item);
    return buildTeacherRows(item); // fallback
}

// ─── Constants ───────────────────────────────────────────────────────────────

export { ROW_HEIGHT };
