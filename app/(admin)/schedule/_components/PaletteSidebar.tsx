'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { FullDataset, DragPayload, ScheduleItem } from '../_types/schedule.types';
import {
    computePaletteData,
    computeGlobalPaletteData,
    PaletteSubjectGroup,
    PaletteClassItem,
} from '../_utils/paletteUtils';
import { TEACHER_META, ROOM_CODES, ROOM_META } from '../_utils/dummyData';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaletteSidebarProps {
    teacherCode: string;
    dataset: FullDataset | null;
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function SidebarDropZone() {
    const { setNodeRef, isOver } = useDroppable({ id: 'sidebar-dropzone' });
    return (
        <div
            ref={setNodeRef}
            className={[
                'mx-3 mb-3 p-2.5 border-2 border-dashed rounded-lg text-[10px] text-center transition-colors select-none',
                isOver
                    ? 'border-orange-400 bg-orange-50 text-orange-600 font-semibold'
                    : 'border-border text-foreground-muted/50',
            ].join(' ')}
        >
            {isOver ? 'Release to unschedule' : 'Drop here to unschedule'}
        </div>
    );
}

// ─── Class Item Card ──────────────────────────────────────────────────────────

function ClassItemCard({
    item,
    subjectCode,
    subject,
    variant,
    dragIndex,
    showTeacher,
}: {
    item: PaletteClassItem;
    subjectCode: string;
    subject: string;
    variant: 'red' | 'green';
    dragIndex: number;
    showTeacher: boolean;
}) {
    const [selectedRoom, setSelectedRoom] = useState(item.room);

    // Sync when the resolved default room changes (e.g. dataset updates)
    useEffect(() => { setSelectedRoom(item.room); }, [item.room]);

    const dragItem: ScheduleItem = {
        teacher: item.teacherCode,
        teacherName: item.teacherName,
        classCode: item.classCode,
        room: selectedRoom,
        roomName: ROOM_META[selectedRoom]?.name ?? selectedRoom,
        subjectCode,
        subject,
        variant,
    };
    const payload: DragPayload = { source: 'SIDEBAR', item: dragItem, index: dragIndex };

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sidebar-subject-${dragIndex}`,
        data: payload,
    });

    const progress = item.periodsPerWeek > 0 ? (item.placed / item.periodsPerWeek) * 100 : 0;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={[
                'relative mx-3 mb-1.5 rounded-lg border overflow-hidden',
                'cursor-grab active:cursor-grabbing select-none transition-opacity',
                isDragging ? 'opacity-40' : '',
                variant === 'green'
                    ? 'bg-surface border-emerald-200 hover:border-emerald-400'
                    : 'bg-surface border-red-200 hover:border-red-400',
            ].join(' ')}
        >
            {/* Variant accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${variant === 'green' ? 'bg-emerald-400' : 'bg-red-400'}`} />

            <div className="pl-3 pr-2 pt-2 pb-2">
                {/* Class + placed badge */}
                <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{item.classCode}</span>
                        {showTeacher && (
                            <span className="text-[10px] text-foreground-muted/60 truncate">{item.teacherName}</span>
                        )}
                    </div>
                    <span className={[
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                        item.remaining > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-emerald-100 text-emerald-700',
                    ].join(' ')}>
                        {item.placed}/{item.periodsPerWeek}
                    </span>
                </div>

                {/* Room dropdown — stop pointer events to avoid triggering drag */}
                <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                    className="w-full text-[9px] border border-border rounded px-1.5 py-0.5 bg-surface-alt text-foreground cursor-pointer mb-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {ROOM_CODES.map(r => (
                        <option key={r} value={r}>
                            {r} — {ROOM_META[r]?.name ?? r}
                        </option>
                    ))}
                </select>

                {/* Progress bar */}
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${progress >= 100 ? 'bg-emerald-400' : 'bg-primary/60'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Subject Group Accordion ──────────────────────────────────────────────────

function SubjectGroupAccordion({
    group,
    dragOffset,
    showTeacher,
}: {
    group: PaletteSubjectGroup;
    dragOffset: number;
    showTeacher: boolean;
}) {
    const [expanded, setExpanded] = useState(true);
    const visibleClasses = group.classes.filter(c => c.remaining > 0);

    if (visibleClasses.length === 0) return null;

    return (
        <div className="mb-0.5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-alt transition-colors text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={[
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        group.variant === 'green' ? 'bg-emerald-500' : 'bg-red-400',
                    ].join(' ')} />
                    <span className="text-[11px] font-bold text-foreground truncate">{group.subjectCode}</span>
                    <span className="text-[9px] text-foreground-muted/60 truncate hidden sm:block">{group.subject}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span className="text-[9px] font-medium text-foreground-muted">
                        {group.totalPlaced}/{group.totalPeriods}
                    </span>
                    <svg
                        className={`w-3 h-3 text-foreground-muted/60 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {expanded && visibleClasses.map((classItem, i) => (
                <ClassItemCard
                    key={`${classItem.teacherCode}-${classItem.classCode}`}
                    item={classItem}
                    subjectCode={group.subjectCode}
                    subject={group.subject}
                    variant={group.variant}
                    dragIndex={dragOffset + i}
                    showTeacher={showTeacher}
                />
            ))}
        </div>
    );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function PaletteSidebar({ teacherCode, dataset }: PaletteSidebarProps) {
    const [activeTab, setActiveTab] = useState<'teacher' | 'all'>('teacher');

    const teacherData = useMemo(
        () => computePaletteData(teacherCode, dataset),
        [teacherCode, dataset],
    );

    const globalData = useMemo(
        () => computeGlobalPaletteData(dataset),
        [dataset],
    );

    const activeData = activeTab === 'teacher' ? teacherData : globalData;
    const totalRemaining = activeData.reduce((s, g) => s + g.totalRemaining, 0);
    const totalPeriods = activeData.reduce((s, g) => s + g.totalPeriods, 0);
    const totalPlaced = activeData.reduce((s, g) => s + g.totalPlaced, 0);

    const meta = TEACHER_META[teacherCode];
    const teacherDisplayName = meta ? meta.firstName : teacherCode;

    // Pre-compute cumulative drag offsets so render stays pure (no mutation during JSX)
    const dragOffsets = useMemo(() => {
        let offset = 0;
        return activeData.map(group => {
            const start = offset;
            offset += group.classes.filter(c => c.remaining > 0).length;
            return start;
        });
    }, [activeData]);

    return (
        <div className="w-[220px] flex-shrink-0 flex flex-col rounded-xl border border-border-strong shadow-sm bg-surface overflow-hidden">
            {/* Header */}
            <div className="px-3 pt-3 pb-2 border-b border-border">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground truncate">
                        {activeTab === 'teacher' ? teacherDisplayName : 'All Teachers'}
                    </span>
                    {totalRemaining > 0 ? (
                        <span className="bg-orange-500 text-white rounded-full text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center leading-none flex-shrink-0 px-1">
                            {totalRemaining}
                        </span>
                    ) : (
                        <span className="bg-emerald-500 text-white rounded-full text-[9px] font-bold px-1.5 h-[18px] flex items-center justify-center leading-none flex-shrink-0">
                            ✓
                        </span>
                    )}
                </div>

                {/* Progress summary */}
                <div className="text-[9px] text-foreground-muted mb-1.5">
                    {totalPlaced}/{totalPeriods} periods placed
                </div>
                <div className="h-1 bg-border rounded-full overflow-hidden mb-2">
                    <div
                        className="h-full bg-primary/50 rounded-full transition-all duration-300"
                        style={{ width: `${totalPeriods > 0 ? (totalPlaced / totalPeriods) * 100 : 0}%` }}
                    />
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 bg-surface-alt rounded-lg p-0.5">
                    {(['teacher', 'all'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={[
                                'flex-1 text-[10px] py-1 rounded-md font-medium transition-colors',
                                activeTab === tab
                                    ? 'bg-surface text-foreground shadow-sm'
                                    : 'text-foreground-muted hover:text-foreground',
                            ].join(' ')}
                        >
                            {tab === 'teacher' ? 'Teacher' : 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto py-1 max-h-[calc(100vh-320px)]">
                {activeData.filter(g => g.totalRemaining > 0).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <svg className="w-8 h-8 text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-foreground-muted">All sessions scheduled!</span>
                    </div>
                ) : (
                    activeData.map((group, i) => (
                        <SubjectGroupAccordion
                            key={`${activeTab}-${group.subjectCode}`}
                            group={group}
                            dragOffset={dragOffsets[i]}
                            showTeacher={activeTab === 'all'}
                        />
                    ))
                )}
            </div>

            {/* Drop-to-unschedule zone */}
            <div className="border-t border-border pt-2">
                <SidebarDropZone />
            </div>
        </div>
    );
}
