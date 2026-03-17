'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScheduleItem, ScheduleData, OverlayData, OverlayCellData, DragPayload, EntityType } from '../_types/schedule.types';
import UnifiedScheduleCell, { buildRowsForMode, ROW_HEIGHT } from './UnifiedScheduleCell';
import ThreeBandCell from './ThreeBandCell';
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

// ─── Summary Cell ────────────────────────────────────────────────────────────

function SummaryCell({ slot, scheduleData, overlayData, isOverlay, viewMode }: {
    slot: number;
    scheduleData: ScheduleData;
    overlayData?: OverlayData;
    isOverlay: boolean;
    viewMode: 'all' | 'teacher' | 'class' | 'room';
}) {
    const days = [...DAYS];

    if (isOverlay && overlayData) {
        const overlayItems = days.map(d => overlayData[d]?.[slot]).filter(Boolean) as OverlayCellData[];
        const uniqueSubjects = new Set(overlayItems.map(c => c.teacher?.subjectCode).filter(Boolean));
        const uniqueClasses = new Set(overlayItems.map(c => c.class?.classCode).filter(Boolean));
        const filledCount = overlayItems.filter(c => !c.allFree).length;

        return (
            <div className="flex flex-col w-full">
                <SummaryRow value={uniqueSubjects.size > 0 ? String(uniqueSubjects.size) : '—'} />
                <SummaryRow value={uniqueClasses.size > 0 ? String(uniqueClasses.size) : '—'} border />
                <SummaryRow value={`${filledCount}/${days.length}`} border bold />
            </div>
        );
    }

    const items = days.map(d => scheduleData[d]?.[slot]).filter(Boolean) as ScheduleItem[];
    const uniqueSubjects = new Set(items.map(i => i.subjectCode).filter(Boolean));
    const uniqueSecondary = viewMode === 'teacher'
        ? new Set(items.map(i => i.classCode).filter(Boolean))
        : new Set(items.map(i => i.teacher).filter(Boolean));

    return (
        <div className="flex flex-col w-full">
            <SummaryRow value={uniqueSubjects.size > 0 ? String(uniqueSubjects.size) : '—'} />
            <SummaryRow value={uniqueSecondary.size > 0 ? String(uniqueSecondary.size) : '—'} border />
            <SummaryRow value={`${items.length}/${days.length}`} border bold />
        </div>
    );
}

function SummaryRow({ value, border, bold }: { value: string; border?: boolean; bold?: boolean }) {
    return (
        <div
            className={`flex items-center justify-center text-[10px] text-foreground-muted ${border ? 'border-t border-border' : ''}`}
            style={{ height: `${ROW_HEIGHT}px` }}
        >
            <span className={bold ? 'font-semibold text-foreground' : 'font-medium'}>{value}</span>
        </div>
    );
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
}: TimetableGridProps) {
    const isOverlay = viewMode === 'all' && !!overlayData;
    const cellHeight = 3 * ROW_HEIGHT;

    const visibleLabels = useMemo(() => {
        if (viewMode === 'all') return ['Teacher', 'Class', 'Room'];
        if (viewMode === 'teacher') return ['Subject', 'Class', 'Room'];
        if (viewMode === 'class') return ['Subject', 'Teacher', 'Room'];
        if (viewMode === 'room') return ['Subject', 'Teacher', 'Class'];
        return ['Teacher', 'Class', 'Room'];
    }, [viewMode]);

    const summaryLabels = useMemo(() => {
        if (viewMode === 'all') return ['Teacher', 'Class', 'Total'];
        if (viewMode === 'teacher') return ['Subject', 'Class', 'Total'];
        if (viewMode === 'class') return ['Subject', 'Teacher', 'Total'];
        if (viewMode === 'room') return ['Subject', 'Teacher', 'Total'];
        return ['Teacher', 'Class', 'Total'];
    }, [viewMode]);

    return (
        <div className="flex flex-col gap-2">
        {/* Read-only notice for individual views */}
        {!isOverlay && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border border-border rounded-lg text-xs text-foreground-muted">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-foreground-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Read-only view — switch to <strong>View All</strong> to drag and rearrange slots</span>
            </div>
        )}
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

                                    // In View All mode the drag is self-managed by ThreeBandCell's
                                    // green band — we just pass the id/payload down.
                                    const teacherItem = overlayCell?.teacher ?? null;

                                    const dragPayload: DragPayload = {
                                        source: 'GRID',
                                        item: teacherItem ?? { teacher: '', teacherName: '', classCode: '', room: '', roomName: '', subjectCode: '', subject: '', variant: 'green' },
                                        day,
                                        slot,
                                    };

                                    const cellContent = isOverlay && overlayCell
                                        ? (
                                            <ThreeBandCell
                                                data={overlayCell}
                                                onBandClick={(entityType) =>
                                                    onBandClick?.(day, slot, entityType, overlayCell)
                                                }
                                                onEmptyClick={() => onCellClick?.(day, slot)}
                                                dragId={teacherItem ? cellId : undefined}
                                                dragPayload={teacherItem ? dragPayload : undefined}
                                                onBandHover={onBandHover}
                                                onBandHoverEnd={onBandHoverEnd}
                                            />
                                        )
                                        : (
                                            <UnifiedScheduleCell
                                                mode="individual"
                                                rows={buildRowsForMode(viewMode, cellData)}
                                                variant={cellData?.variant}
                                                onClick={() => onCellClick?.(day, slot)}
                                            />
                                        );

                                    return (
                                        <td key={slot} className={`p-0 relative ${si < SLOTS.length - 1 ? 'border-r border-border/30' : ''}`}>
                                            <DroppableCell id={cellId} partiallyOccupied={overlayCell?.partiallyOccupied}>
                                                {cellContent}
                                            </DroppableCell>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}

                        {/* Summary row */}
                        <tr className="border-t-2 border-border-strong bg-surface-alt/60">
                            <td className="sticky left-0 z-10 bg-surface-alt border-r border-border-strong">
                                <div className="flex items-center justify-center font-bold text-foreground text-[9px] uppercase tracking-wider" style={{ height: `${cellHeight}px` }}>
                                    Summary
                                </div>
                            </td>
                            <td className="sticky left-[72px] z-10 bg-surface-alt border-r border-border-strong">
                                <div className="flex flex-col" style={{ height: `${cellHeight}px` }}>
                                    {summaryLabels.map((label, i) => (
                                        <div
                                            key={label}
                                            className={`flex items-center justify-center text-[9px] text-foreground-muted/70 ${i > 0 ? 'border-t border-border' : ''}`}
                                            style={{ height: `${ROW_HEIGHT}px` }}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </td>
                            {SLOTS.map((slot, si) => (
                                <td key={slot} className={`p-0 ${si < SLOTS.length - 1 ? 'border-r border-border/30' : ''}`}>
                                    <div style={{ height: `${cellHeight}px` }}>
                                        <SummaryCell
                                            slot={slot}
                                            scheduleData={scheduleData}
                                            overlayData={isOverlay ? overlayData : undefined}
                                            isOverlay={isOverlay}
                                            viewMode={viewMode}
                                        />
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        </div>
    );
}
