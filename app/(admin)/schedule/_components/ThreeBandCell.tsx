'use client';

import { useDraggable } from '@dnd-kit/core';
import { OverlayCellData, EntityType, ScheduleItem, DragPayload, BandStatus } from '../_types/schedule.types';
import { useScheduleDnd } from './ScheduleDndProvider';

// ─── Constants ───────────────────────────────────────────────────────────────

export const BAND_HEIGHT = 32; // matches ROW_HEIGHT in UnifiedScheduleCell

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThreeBandCellProps {
    data: OverlayCellData;
    /** Called when a band is clicked. entityType identifies which band. */
    onBandClick?: (entityType: EntityType) => void;
    /** Called when the all-free cell body is clicked (create new lesson). */
    onEmptyClick?: () => void;
    bandHeight?: number;
    /** Drag payload — provided by TimetableGridV2 so the green band can self-manage drag */
    dragId?: string;
    dragPayload?: DragPayload;
    /** Hover callbacks for busy-band tooltip */
    onBandHover?: (entityType: EntityType, rect: DOMRect, item: ScheduleItem) => void;
    onBandHoverEnd?: () => void;
}

// ─── StatusBand ──────────────────────────────────────────────────────────────

interface StatusBandProps {
    bandStatus: BandStatus;
    entityType: EntityType;
    height: number;
    onClick?: () => void;
    onHoverStart?: (rect: DOMRect) => void;
    onHoverEnd?: () => void;
}

function StatusBand({ bandStatus, height, onClick, onHoverStart, onHoverEnd }: StatusBandProps) {
    const { kind, occupyingItem } = bandStatus;

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        if (kind === 'busy' && onHoverStart) {
            onHoverStart(e.currentTarget.getBoundingClientRect());
        }
    };

    if (kind === 'free') {
        return (
            <div
                style={{ height }}
                className="w-full border-l-[3px] border-l-green-300 bg-green-50 flex items-center justify-center select-none"
            >
                <span className="text-[10px] text-green-600 font-medium">ว่าง</span>
            </div>
        );
    }

    if (kind === 'busy') {
        return (
            <div
                style={{ height }}
                className="w-full border-l-[3px] border-l-gray-300 bg-gray-100 flex items-center justify-center select-none cursor-pointer transition-colors duration-100 hover:bg-gray-200"
                onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={onHoverEnd}
            >
                <span className="text-[10px] text-gray-600 font-medium truncate px-1">
                    {occupyingItem?.teacher}
                </span>
            </div>
        );
    }

    // kind === 'your-session'
    return (
        <div
            style={{ height }}
            className="w-full border-l-[3px] border-l-emerald-400 bg-emerald-100 flex items-center justify-center select-none cursor-pointer transition-colors duration-100 hover:bg-emerald-200"
            onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        >
            <span className="text-[11px] text-emerald-800 font-semibold truncate px-1">
                {occupyingItem?.subjectCode}
            </span>
        </div>
    );
}

// ─── Draggable session band (teacher only) ───────────────────────────────────

function DraggableSessionBand({
    item,
    height,
    dragId,
    dragPayload,
    onClick,
}: {
    item: ScheduleItem;
    height: number;
    dragId: string;
    dragPayload: DragPayload;
    onClick?: () => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dragId,
        data: dragPayload,
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={{ height }}
            className={[
                'w-full border-l-[3px] border-l-emerald-400 bg-emerald-100 flex items-center justify-center select-none',
                'transition-colors duration-100 hover:bg-emerald-200',
                'cursor-grab active:cursor-grabbing',
                isDragging ? 'opacity-30' : '',
            ].join(' ')}
            onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        >
            <span className="text-[11px] text-emerald-800 font-semibold truncate px-1 pointer-events-none">
                {item.subjectCode}
            </span>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThreeBandCell({
    data,
    onBandClick,
    onEmptyClick,
    bandHeight = BAND_HEIGHT,
    dragId,
    dragPayload,
    onBandHover,
    onBandHoverEnd,
}: ThreeBandCellProps) {
    const { teacherBand, classBand, roomBand, allFree, isSynchronized, conflictCount } = data;
    const totalHeight = bandHeight * 3;
    const { activeDrag } = useScheduleDnd();
    const isDraggingAny = !!activeDrag;

    // Cell-level border based on availability
    let cellBorder = '';
    let cellBg = 'bg-surface';

    if (allFree) {
        // All 3 free → can schedule here
        cellBorder = 'border border-dashed border-green-400';
        cellBg = isDraggingAny ? 'bg-green-50/30' : 'bg-surface hover:bg-green-50/30 cursor-pointer';
    } else if (isSynchronized) {
        // Your session — all 3 have the same lesson
        cellBorder = 'border-[2px] border-emerald-500';
        cellBg = 'bg-emerald-50/20';
    } else if (conflictCount >= 2) {
        // All or most busy with different lessons
        const freeCount = [teacherBand.kind === 'free', classBand.kind === 'free', roomBand.kind === 'free'].filter(Boolean).length;
        if (freeCount === 0) {
            // All busy
            cellBorder = 'border-l-[3px] border-l-red-400';
            cellBg = 'bg-red-50/40';
        } else {
            // Partial — some free, some busy
            cellBorder = 'border-l-[3px] border-l-amber-400';
            cellBg = 'bg-amber-50/30';
        }
    } else {
        // Partial — 1 busy, others free
        cellBorder = 'border-l-[3px] border-l-amber-400';
        cellBg = 'bg-amber-50/30';
    }

    // Hover helpers — skip when dragging
    const makeHoverStart = (entityType: EntityType, band: BandStatus) =>
        (rect: DOMRect) => {
            if (!isDraggingAny && band.occupyingItem && onBandHover) {
                onBandHover(entityType, rect, band.occupyingItem);
            }
        };

    const handleHoverEnd = () => {
        if (!isDraggingAny) onBandHoverEnd?.();
    };

    return (
        <div
            style={{ height: totalHeight }}
            className={[
                'w-full flex flex-col overflow-hidden transition-colors duration-100 relative',
                cellBg,
                cellBorder,
            ].join(' ')}
            onClick={allFree ? onEmptyClick : undefined}
        >
            {/* ── Teacher band ── */}
            {teacherBand.kind === 'your-session' && dragId && dragPayload && teacherBand.occupyingItem ? (
                <DraggableSessionBand
                    item={teacherBand.occupyingItem}
                    height={bandHeight}
                    dragId={dragId}
                    dragPayload={dragPayload}
                    onClick={() => onBandClick?.('teacher')}
                />
            ) : (
                <StatusBand
                    bandStatus={teacherBand}
                    entityType="teacher"
                    height={bandHeight}
                    onClick={teacherBand.kind !== 'free' ? () => onBandClick?.('teacher') : undefined}
                    onHoverStart={makeHoverStart('teacher', teacherBand)}
                    onHoverEnd={handleHoverEnd}
                />
            )}

            {/* ── Class band ── */}
            <StatusBand
                bandStatus={classBand}
                entityType="class"
                height={bandHeight}
                onClick={classBand.kind !== 'free' ? () => onBandClick?.('class') : undefined}
                onHoverStart={makeHoverStart('class', classBand)}
                onHoverEnd={handleHoverEnd}
            />

            {/* ── Room band ── */}
            <StatusBand
                bandStatus={roomBand}
                entityType="room"
                height={bandHeight}
                onClick={roomBand.kind !== 'free' ? () => onBandClick?.('room') : undefined}
                onHoverStart={makeHoverStart('room', roomBand)}
                onHoverEnd={handleHoverEnd}
            />

            {/* Conflict badge */}
            {conflictCount >= 2 && (
                <span className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none pointer-events-none">
                    ✕{conflictCount}
                </span>
            )}
        </div>
    );
}
