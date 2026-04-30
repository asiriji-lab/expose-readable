'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScheduleItem, ScheduleData, OverlayData, OverlayCellData, DragPayload, EntityType } from '../_types/schedule.types';
import ThreeBandCell, { BAND_HEIGHT as ROW_HEIGHT } from './ThreeBandCell';
import { useScheduleDnd } from './ScheduleDndProvider';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const DAY_ABBREV: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimetableGridProps {
    scheduleData: ScheduleData;
    viewMode: 'all' | 'teacher' | 'class' | 'room';
    onCellClick?: (day: string, slot: number) => void;
    onBandClick?: (day: string, slot: number, entityType: EntityType, data: OverlayCellData) => void;
    overlayData?: OverlayData;
    onBandHover?: (entityType: EntityType, rect: DOMRect, item: ScheduleItem) => void;
    onBandHoverEnd?: () => void;
    /** Which entity is focused via filters — dims non-active bands */
    activeEntity?: EntityType;
}

// ─── Droppable Cell ──────────────────────────────────────────────────────────

function DroppableCell({ id, partiallyOccupied, children }: { id: string; partiallyOccupied?: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { conflictCells, activeDrag } = useScheduleDnd();
    const isBlocked = conflictCells.has(id);
    const isDragging = !!activeDrag;

    return (
        <div ref={setNodeRef} className="relative">
            {children}
            {/* Partial occupancy hint — class/room taken by someone else */}
            {!isDragging && partiallyOccupied && (
                <div className="absolute top-1 left-1 z-10 w-1.5 h-1.5 rounded-full bg-slate-400/50 pointer-events-none" />
            )}
            {/* Valid drop hover */}
            {isOver && !isBlocked && (
                <div className="absolute inset-0 pointer-events-none z-10 ring-2 ring-primary/50 bg-primary/5 rounded-sm" />
            )}
            {/* Conflict hover — dropping here ejects the occupant back to the sidebar palette */}
            {isOver && isBlocked && (
                <div className="absolute inset-0 pointer-events-none z-10 ring-2 ring-amber-400/80 bg-amber-50/50 rounded-sm flex items-center justify-center">
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 px-1 py-0.5 rounded leading-tight">↩ eject</span>
                </div>
            )}
        </div>
    );
}

// DraggableWrapper removed — drag is now self-managed inside ThreeBandCell's green band.
// This keeps drag events isolated to the teacher band only.

// ─── Preplace cell ───────────────────────────────────────────────────────────

function PreplaceCellWidget({ label, bandHeight }: { label: string; bandHeight: number }) {
    return (
        <div
            style={{ height: bandHeight * 3 }}
            className="w-full flex flex-col overflow-hidden border-l-[3px] border-l-violet-400 bg-violet-50 dark:bg-violet-900/20 relative select-none divide-y divide-violet-50 dark:divide-violet-900/20"
        >
            <span className="absolute top-1 right-1 z-10 text-amber-400 pointer-events-none">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </span>
            {/* top — empty */}
            <div style={{ height: bandHeight }} />
            {/* middle — label only */}
            <div style={{ height: bandHeight }} className="flex items-center justify-center px-4">
                <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 truncate">{label}</span>
            </div>
            {/* bottom — empty */}
            <div style={{ height: bandHeight }} />
        </div>
    );
}

// ─── Helpers for individual entity views ─────────────────────────────────────

const ALL_FREE_OVERLAY: OverlayCellData = {
    teacherBand: { kind: 'free' },
    classBand: { kind: 'free' },
    roomBand: { kind: 'free' },
    conflictCount: 0,
    allFree: true,
    partiallyOccupied: false,
    isSynchronized: false,
};

function buildIndividualOverlay(item: ScheduleItem | undefined): OverlayCellData {
    if (!item) return ALL_FREE_OVERLAY;
    return {
        teacherBand: { kind: 'busy', occupyingItem: item },
        classBand:   { kind: 'busy', occupyingItem: item },
        roomBand:    { kind: 'busy', occupyingItem: item },
        teacher: item,
        class:   item,
        room:    item,
        conflictCount: 0,
        allFree: false,
        partiallyOccupied: false,
        isSynchronized: true,
    };
}

function getBandTexts(
    viewMode: 'teacher' | 'class' | 'room',
    item: ScheduleItem,
): [string | null, string | null, string | null] {
    if (viewMode === 'teacher') return [item.subjectCode || null, item.classCode || null, item.room || null];
    if (viewMode === 'class')   return [item.teacherName || null, item.subjectCode || null, item.room || null];
    /* room */                  return [item.teacherName || null, item.classCode   || null, item.subjectCode || null];
}

// ─── Main Grid ───────────────────────────────────────────────────────────────

export default function TimetableGridV2({
    scheduleData,
    viewMode,
    onCellClick,
    onBandClick,
    overlayData,
    onBandHover,
    onBandHoverEnd,
    activeEntity,
}: TimetableGridProps) {
    const cellHeight = 3 * ROW_HEIGHT;

    const visibleLabels = useMemo(() => {
        if (viewMode === 'all')     return ['Teacher', 'Class', 'Room'];
        if (viewMode === 'teacher') return ['Subject', 'Class',   'Room'];
        if (viewMode === 'class')   return ['Teacher', 'Subject', 'Room'];
        if (viewMode === 'room')    return ['Teacher', 'Class',   'Subject'];
        return ['Teacher', 'Class', 'Room'];
    }, [viewMode]);

    return (
        <div className="overflow-hidden rounded-xl border border-border-strong shadow-sm bg-surface">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: `${76 * SLOTS.length + 134}px` }}>
                    {/* ── Header ── */}
                    <thead>
                        <tr className="bg-surface-alt">
                            <th className="sticky left-0 z-20 bg-surface-alt w-[72px] min-w-[72px] border-b border-r border-border-strong">
                                <div className="h-9 flex items-center justify-center text-[9px] font-bold text-foreground-muted uppercase tracking-wider">Day</div>
                            </th>
                            <th className="sticky left-[72px] z-20 bg-surface-alt w-[62px] min-w-[62px] border-b border-r border-border-strong">
                                <div className="h-9 flex items-center justify-center text-[9px] font-bold text-foreground-muted uppercase tracking-wider">Info</div>
                            </th>
                            {SLOTS.map(slot => (
                                <th key={slot} className="border-b border-border-strong min-w-[76px]">
                                    <div className="h-9 flex items-center justify-center">
                                        <span className="text-sm font-bold text-primary">{slot}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {DAYS.map((day, di) => (
                            <tr key={day} className={di < DAYS.length - 1 ? 'border-b border-border' : ''}>
                                {/* Day label */}
                                <td className="sticky left-0 z-10 bg-surface-alt border-r border-border-strong">
                                    <div className="flex items-center justify-center font-bold text-foreground text-xs" style={{ height: `${cellHeight}px` }}>
                                        <span className="hidden lg:inline">{day}</span>
                                        <span className="lg:hidden">{DAY_ABBREV[day]}</span>
                                    </div>
                                </td>
                                {/* Row labels */}
                                <td className="sticky left-[72px] z-10 bg-surface border-r border-border-strong">
                                    <div className="flex flex-col" style={{ height: `${cellHeight}px` }}>
                                        {visibleLabels.map((label, li) => (
                                            <div
                                                key={label}
                                                className={`flex items-center justify-center text-[9px] text-foreground-muted/70 ${li > 0 ? 'border-t border-border/40' : ''}`}
                                                style={{ height: `${ROW_HEIGHT}px` }}
                                            >
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                {/* Cells */}
                                {SLOTS.map((slot, si) => {
                                    const cellId = `cell-${day}-${slot}`;
                                    const cellData = scheduleData[day]?.[slot];
                                    const overlayCell = overlayData?.[day]?.[slot];
                                    const isViewAll = viewMode === 'all';

                                    // ── Preplace detection ────────────────────────────────────────────────
                                    // View-all: per-band preplace rendered via BandStatus 'preplace' kind.
                                    // Individual views: whole cell becomes PreplaceCellWidget when the
                                    // selected entity's slot is a preplace activity.
                                    const preplaceLabel = isViewAll
                                        ? null
                                        : (cellData?.isPreplace ? cellData.subjectCode : null);

                                    if (preplaceLabel !== null) {
                                        return (
                                            <td key={slot} className={`p-0 relative ${si < SLOTS.length - 1 ? 'border-r border-border/30' : ''}`}>
                                                <PreplaceCellWidget label={preplaceLabel} bandHeight={ROW_HEIGHT} />
                                            </td>
                                        );
                                    }

                                    // ── Regular cell ──────────────────────────────────────────────────────

                                    // View All: use real overlay; individual: build synthetic overlay
                                    const cellOverlay = isViewAll
                                        ? (overlayCell ?? ALL_FREE_OVERLAY)
                                        : buildIndividualOverlay(cellData);

                                    // bandTexts only for individual views with data
                                    const bandTexts = !isViewAll && cellData
                                        ? getBandTexts(viewMode as 'teacher' | 'class' | 'room', cellData)
                                        : undefined;

                                    // Drag only in View All mode
                                    const teacherItem = isViewAll ? (overlayCell?.teacher ?? null) : null;
                                    const dragPayload: DragPayload = {
                                        source: 'GRID',
                                        item: teacherItem ?? { teacher: '', teacherName: '', classCode: '', room: '', roomName: '', subjectCode: '', subject: '', variant: 'green' },
                                        day,
                                        slot,
                                    };

                                    return (
                                        <td key={slot} className={`p-0 relative ${si < SLOTS.length - 1 ? 'border-r border-border/30' : ''}`}>
                                            <DroppableCell id={cellId} partiallyOccupied={cellOverlay.partiallyOccupied}>
                                                <ThreeBandCell
                                                    data={cellOverlay}
                                                    onBandClick={(entityType) =>
                                                        onBandClick?.(day, slot, entityType, cellOverlay)
                                                    }
                                                    onEmptyClick={() => onCellClick?.(day, slot)}
                                                    dragId={teacherItem ? cellId : undefined}
                                                    dragPayload={teacherItem ? dragPayload : undefined}
                                                    onBandHover={isViewAll ? onBandHover : undefined}
                                                    onBandHoverEnd={isViewAll ? onBandHoverEnd : undefined}
                                                    activeEntity={activeEntity}
                                                    bandTexts={bandTexts}
                                                    individualMode={!isViewAll}
                                                />
                                            </DroppableCell>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}

                    </tbody>
                </table>
            </div>
        </div>
    );
}
