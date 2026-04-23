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
    /** Which entity is currently focused via filters — non-active bands dim */
    activeEntity?: EntityType;
    /** Override display text for each band [teacher, class, room] — used by individual entity views */
    bandTexts?: [string | null, string | null, string | null];
    /** When true, empty (all-free) cells render as a plain dashed box without band rows */
    individualMode?: boolean;
}

// ─── StatusBand ──────────────────────────────────────────────────────────────

interface StatusBandProps {
    bandStatus: BandStatus;
    entityType: EntityType;
    height: number;
    onClick?: () => void;
    onHoverStart?: (rect: DOMRect) => void;
    onHoverEnd?: () => void;
    /** Dim this band (non-active entity) */
    dim?: boolean;
    /** Override display text instead of computing bandLabel */
    displayText?: string | null;
}

// Entity-specific colors for busy bands
const ENTITY_BAND_STYLES: Record<EntityType, { border: string; bg: string; hover: string; text: string }> = {
    teacher: { border: 'border-l-emerald-300', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100', text: 'text-emerald-700' },
    class:   { border: 'border-l-pink-300',    bg: 'bg-pink-50',    hover: 'hover:bg-pink-100',    text: 'text-pink-700'   },
    room:    { border: 'border-l-amber-300',   bg: 'bg-amber-50',   hover: 'hover:bg-amber-100',   text: 'text-amber-700'  },
};

/** Universal band label: "subjectCode · teacherName" */
function bandLabel(item: ScheduleItem | undefined): string {
    if (!item) return '';
    const parts = [item.subjectCode, item.teacherName].filter(Boolean);
    return parts.join(' · ');
}

function StatusBand({ bandStatus, entityType, height, onClick, onHoverStart, onHoverEnd, dim, displayText }: StatusBandProps) {
    const { kind, occupyingItem } = bandStatus;

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((kind === 'busy' || kind === 'your-session') && onHoverStart) {
            onHoverStart(e.currentTarget.getBoundingClientRect());
        }
    };

    const dimClass = dim ? 'opacity-50' : '';

    if (kind === 'preplace') {
        return (
            <div
                style={{ height }}
                className={`w-full border-l-[3px] border-l-violet-400 bg-violet-50 flex items-center justify-center select-none relative ${dimClass}`}
            >
                <span className="absolute right-1 top-0 bottom-0 flex items-center pointer-events-none">
                    <svg className="w-2.5 h-2.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                </span>
                <span className="text-[10px] text-violet-600 font-semibold truncate px-1">
                    {displayText ?? bandLabel(occupyingItem)}
                </span>
            </div>
        );
    }

    if (kind === 'free') {
        return <div style={{ height }} className={dimClass} />;
    }

    if (kind === 'busy') {
        const s = ENTITY_BAND_STYLES[entityType];
        return (
            <div
                style={{ height }}
                className={`w-full border-l-[3px] ${s.border} ${s.bg} flex items-center justify-center select-none cursor-pointer transition-colors duration-100 ${s.hover} ${dimClass}`}
                onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={onHoverEnd}
            >
                <span className={`text-[10px] ${s.text} font-medium truncate px-1`}>
                    {displayText ?? bandLabel(occupyingItem)}
                </span>
            </div>
        );
    }

    // kind === 'your-session'
    return (
        <div
            style={{ height }}
            className={`w-full border-l-[3px] border-l-emerald-400 bg-emerald-100 flex items-center justify-center select-none cursor-pointer transition-colors duration-100 hover:bg-emerald-200 ${dimClass}`}
            onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={onHoverEnd}
        >
            <span className="text-[10px] text-emerald-800 font-semibold truncate px-1">
                {displayText ?? bandLabel(occupyingItem)}
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
    dim,
    displayText,
}: {
    item: ScheduleItem;
    height: number;
    dragId: string;
    dragPayload: DragPayload;
    onClick?: () => void;
    dim?: boolean;
    displayText?: string | null;
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
                isDragging ? 'opacity-30' : dim ? 'opacity-50' : '',
            ].join(' ')}
            onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        >
            <span className="text-[10px] text-emerald-800 font-semibold truncate px-1 pointer-events-none">
                {displayText ?? bandLabel(item)}
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
    activeEntity,
    bandTexts,
    individualMode = false,
}: ThreeBandCellProps) {
    const { teacherBand, classBand, roomBand, allFree, isSynchronized, conflictCount } = data;
    const totalHeight = bandHeight * 3;
    const { activeDrag } = useScheduleDnd();
    const isDraggingAny = !!activeDrag;

    const allPreplace = teacherBand.kind === 'preplace' && classBand.kind === 'preplace' && roomBand.kind === 'preplace';

    // Cell-level border based on availability
    let cellBorder = '';
    let cellBg = 'bg-slate-50 dark:bg-white/[0.03]';

    if (allFree) {
        cellBorder = '';
        cellBg = isDraggingAny
            ? 'bg-slate-100 dark:bg-white/[0.06]'
            : 'bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer';
    } else if (allPreplace) {
        cellBorder = 'border-l-[3px] border-l-violet-400';
        cellBg = 'bg-violet-50/40 dark:bg-violet-900/20';
    } else if (isSynchronized) {
        cellBorder = 'border-[2px] border-emerald-500';
        cellBg = 'bg-emerald-50/40 dark:bg-emerald-900/20';
    } else if (conflictCount >= 2) {
        cellBorder = 'border-l-[3px] border-l-slate-300';
        cellBg = 'bg-slate-50 dark:bg-white/[0.03]';
    } else {
        // Partial — 1 busy, others free
        cellBorder = 'border-l-[3px] border-l-slate-300';
        cellBg = 'bg-slate-50 dark:bg-white/[0.03]';
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

    // Individual mode empty cell — plain dashed box, no band rows
    if (individualMode && allFree) {
        return (
            <div
                style={{ height: totalHeight }}
                className="w-full hover:bg-primary/5 cursor-pointer transition-colors duration-100"
                onClick={onEmptyClick}
            />
        );
    }

    return (
        <div
            style={{ height: totalHeight }}
            className={[
                'w-full flex flex-col overflow-hidden transition-colors duration-100 relative divide-y divide-slate-200 dark:divide-white/10',
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
                    dim={!!activeEntity && activeEntity !== 'teacher'}
                    displayText={bandTexts?.[0]}
                />
            ) : (
                <StatusBand
                    bandStatus={teacherBand}
                    entityType="teacher"
                    height={bandHeight}
                    onClick={teacherBand.kind !== 'free' ? () => onBandClick?.('teacher') : undefined}
                    onHoverStart={makeHoverStart('teacher', teacherBand)}
                    onHoverEnd={handleHoverEnd}
                    dim={!!activeEntity && activeEntity !== 'teacher'}
                    displayText={bandTexts?.[0]}
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
                dim={!!activeEntity && activeEntity !== 'class'}
                displayText={bandTexts?.[1]}
            />

            {/* ── Room band ── */}
            <StatusBand
                bandStatus={roomBand}
                entityType="room"
                height={bandHeight}
                onClick={roomBand.kind !== 'free' ? () => onBandClick?.('room') : undefined}
                onHoverStart={makeHoverStart('room', roomBand)}
                onHoverEnd={handleHoverEnd}
                dim={!!activeEntity && activeEntity !== 'room'}
                displayText={bandTexts?.[2]}
            />

            {/* Occupied badge — neutral indicator instead of alarming red */}
            {conflictCount >= 2 && (
                <span className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-slate-500/80 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none pointer-events-none">
                    {conflictCount}/3
                </span>
            )}
        </div>
    );
}
