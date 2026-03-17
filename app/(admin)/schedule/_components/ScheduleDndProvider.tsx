'use client';

import { useState, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    PointerSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import { DragPayload, ScheduleItem } from '../_types/schedule.types';
import UnifiedScheduleCell, { buildRowsForMode, ROW_HEIGHT } from './UnifiedScheduleCell';
import { BAND_HEIGHT } from './ThreeBandCell';

// ─── Context ─────────────────────────────────────────────────────────────────

interface DndState {
    activeDrag: { id: string; payload: DragPayload } | null;
    conflictCells: Set<string>;
}

const ScheduleDndContext = createContext<DndState>({
    activeDrag: null,
    conflictCells: new Set(),
});

export function useScheduleDnd() {
    return useContext(ScheduleDndContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface ScheduleDndProviderProps {
    viewMode: 'all' | 'teacher' | 'class' | 'room';
    onGridDrop: (day: string, slot: number, payload: DragPayload) => void;
    onSidebarDrop: (payload: DragPayload) => void;
    onCheckConflict?: (day: string, slot: number, payload: DragPayload) => boolean;
    children: ReactNode;
}

export default function ScheduleDndProvider({
    viewMode,
    onGridDrop,
    onSidebarDrop,
    onCheckConflict,
    children,
}: ScheduleDndProviderProps) {
    const [activeDrag, setActiveDrag] = useState<{ id: string; payload: DragPayload } | null>(null);
    const [conflictCells, setConflictCells] = useState<Set<string>>(new Set());

    // Sensors
    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
    const keyboardSensor = useSensor(KeyboardSensor);
    const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const payload = event.active.data.current as DragPayload;
        if (payload) {
            setActiveDrag({ id: String(event.active.id), payload });
        }
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        if (!event.over || !activeDrag) return;
        const overId = String(event.over.id);

        if (overId.startsWith('cell-') && onCheckConflict) {
            const parts = overId.split('-');
            const day = parts[1];
            const slot = Number(parts[2]);
            const hasConflict = onCheckConflict(day, slot, activeDrag.payload);
            setConflictCells(prev => {
                const next = new Set<string>();
                // Only keep the currently hovered cell
                if (hasConflict) next.add(overId);
                return next;
            });
        } else {
            setConflictCells(new Set());
        }
    }, [activeDrag, onCheckConflict]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDrag(null);
        setConflictCells(new Set());

        if (!over) return;
        const overId = String(over.id);
        const payload = active.data.current as DragPayload;
        if (!payload) return;

        // Conflict cells ARE allowed — moveItem ejects the conflicting lesson,
        // removing it from the dataset so it re-appears in the sidebar palette.

        // Drop on grid cell — always allow; moveItem handles conflict ejection
        if (overId.startsWith('cell-')) {
            const parts = overId.split('-');
            const day = parts[1];
            const slot = Number(parts[2]);
            onGridDrop(day, slot, payload);
        }

        // Drop on sidebar
        if (overId === 'sidebar-dropzone') {
            onSidebarDrop(payload);
        }
    }, [conflictCells, onGridDrop, onSidebarDrop]);

    // Drag overlay ghost content
    const cellHeight = 3 * ROW_HEIGHT;
    const dragOverlayContent = useMemo(() => {
        if (!activeDrag) return null;
        const { payload } = activeDrag;
        const item = payload.item;

        if (viewMode === 'all') {
            // Render a 3-band ghost that matches the ThreeBandCell source visually
            const teacherBg = item.variant === 'red' ? 'bg-rose-50 border-l-rose-400 text-rose-900' : 'bg-emerald-50 border-l-emerald-400 text-emerald-900';
            return (
                <div
                    className="rounded-lg shadow-2xl border border-primary/30 overflow-hidden pointer-events-none opacity-90"
                    style={{ width: '100px', height: `${cellHeight}px` }}
                >
                    {/* Green/Rose band — Teacher */}
                    <div style={{ height: BAND_HEIGHT }} className={`w-full border-l-[3px] flex items-center px-1.5 ${teacherBg}`}>
                        <div className="flex items-center gap-1 w-full overflow-hidden">
                            <span className="font-semibold text-[11px] shrink-0 leading-tight">{item.subjectCode}</span>
                            <span className="text-[9px] opacity-60 truncate">{item.classCode}</span>
                            <span className="text-[9px] opacity-50 truncate shrink-0">{item.room}</span>
                        </div>
                    </div>
                    {/* Pink band — Class (empty in ghost — only teacher moves) */}
                    <div style={{ height: BAND_HEIGHT }} className="w-full bg-surface-alt/60" />
                    {/* Amber band — Room (empty in ghost) */}
                    <div style={{ height: BAND_HEIGHT }} className="w-full bg-surface-alt/40" />
                </div>
            );
        }

        const rows = buildRowsForMode(viewMode, item, undefined);
        return (
            <div
                className="bg-surface rounded-lg shadow-2xl border-2 border-primary/40 pointer-events-none"
                style={{ width: '100px', height: `${cellHeight}px` }}
            >
                <UnifiedScheduleCell
                    mode="individual"
                    rows={rows}
                    variant={item.variant}
                />
            </div>
        );
    }, [activeDrag, viewMode, cellHeight]);

    const contextValue = useMemo<DndState>(
        () => ({ activeDrag, conflictCells }),
        [activeDrag, conflictCells]
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <ScheduleDndContext.Provider value={contextValue}>
                {children}
            </ScheduleDndContext.Provider>

            <DragOverlay dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
                {dragOverlayContent}
            </DragOverlay>
        </DndContext>
    );
}
