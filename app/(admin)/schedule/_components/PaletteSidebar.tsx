'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CheckCircle, ChevronDown, Users } from 'lucide-react';
import { FullDataset, DragPayload, ScheduleItem, EntityMeta } from '../_types/schedule.types';
import {
    computePaletteData,
    computeGlobalPaletteData,
    computeTeamGroupPaletteData,
    TeamGroupPaletteItem,
    PaletteSubjectGroup,
    PaletteClassItem,
} from '../_utils/paletteUtils';
import { variantPalette } from '../_utils/variantColors';

// ─── Filter type ──────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'remaining' | 'done';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaletteSidebarProps {
    teacherCode: string;
    dataset: FullDataset | null;
    entityMeta: EntityMeta | null;
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
                    ? 'border-warning bg-warning-light text-warning font-semibold'
                    : 'border-border text-foreground-muted/50',
            ].join(' ')}
        >
            {isOver ? 'Release to unschedule' : 'Drop here to unschedule'}
        </div>
    );
}

// ─── Class Item Card (Active — remaining > 0) ────────────────────────────────

function ClassItemCard({
    item,
    subjectCode,
    subject,
    variant,
    dragIndex,
    showTeacher,
    entityMeta,
}: {
    item: PaletteClassItem;
    subjectCode: string;
    subject: string;
    variant: string;
    dragIndex: number;
    showTeacher: boolean;
    entityMeta: EntityMeta | null;
}) {
    const [selectedRoom, setSelectedRoom] = useState(item.room);

    useEffect(() => { setSelectedRoom(item.room); }, [item.room]);

    const dragItem: ScheduleItem = {
        teacher: item.teacherCode,
        teacherName: item.teacherName,
        classCode: item.classCode,
        room: selectedRoom,
        roomName: entityMeta?.room_meta[selectedRoom]?.name ?? selectedRoom,
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
                `bg-surface ${variantPalette(variant).cardBorder}`,
            ].join(' ')}
        >
            {/* Variant accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${variantPalette(variant).accent}`} />

            <div className="pl-3 pr-2 pt-2 pb-2">
                {/* Class + placed badge */}
                <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{item.classCode}</span>
                        {showTeacher && (
                            <span className="text-[10px] text-foreground-muted/60 truncate">{item.teacherName}</span>
                        )}
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-primary/10 text-primary">
                        {item.placed}/{item.periodsPerWeek}
                    </span>
                </div>

                {/* Room dropdown */}
                <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                    className="w-full text-[9px] border border-border rounded px-1.5 py-0.5 bg-surface-alt text-foreground cursor-pointer mb-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {(entityMeta?.room_codes ?? []).map(r => (
                        <option key={r} value={r}>
                            {r} — {entityMeta?.room_meta[r]?.name ?? r}
                        </option>
                    ))}
                </select>

                {/* Progress bar */}
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-300 bg-primary/60"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Completed Item Card ──────────────────────────────────────────────────────

function CompletedClassCard({
    item,
    subjectCode,
    subject,
    variant,
    dragIndex,
    showTeacher,
    entityMeta,
}: {
    item: PaletteClassItem;
    subjectCode: string;
    subject: string;
    variant: string;
    dragIndex: number;
    showTeacher: boolean;
    entityMeta: EntityMeta | null;
}) {
    const [selectedRoom, setSelectedRoom] = useState(item.room);
    useEffect(() => { setSelectedRoom(item.room); }, [item.room]);

    const dragItem: ScheduleItem = {
        teacher: item.teacherCode,
        teacherName: item.teacherName,
        classCode: item.classCode,
        room: selectedRoom,
        roomName: entityMeta?.room_meta[selectedRoom]?.name ?? selectedRoom,
        subjectCode,
        subject,
        variant,
    };
    const payload: DragPayload = { source: 'SIDEBAR', item: dragItem, index: dragIndex };

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sidebar-subject-${dragIndex}`,
        data: payload,
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={[
                'relative mx-3 mb-1.5 rounded-lg border overflow-hidden opacity-60',
                'cursor-grab active:cursor-grabbing select-none transition-opacity hover:opacity-80',
                isDragging ? 'opacity-30' : '',
                'bg-success-light border-success-border',
            ].join(' ')}
        >
            {/* Green accent for completed */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success" />

            <div className="pl-3 pr-2 pt-1.5 pb-1.5">
                {/* Class + done badge */}
                <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="min-w-0 flex items-center gap-1.5">
                        <CheckCircle size={11} className="text-success shrink-0" />
                        <span className="text-xs font-bold text-foreground">{item.classCode}</span>
                        {showTeacher && (
                            <span className="text-[10px] text-foreground-muted/60 truncate">{item.teacherName}</span>
                        )}
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-success-light text-success border border-success-border">
                        {item.placed}/{item.periodsPerWeek}
                    </span>
                </div>

                {/* Placement summary */}
                {item.placementSummary && (
                    <p className="text-[9px] text-foreground-muted pl-4 truncate">{item.placementSummary}</p>
                )}
            </div>
        </div>
    );
}

// ─── Team Group Card ──────────────────────────────────────────────────────────

function TeamGroupCard({
    item: paletteItem,
    dragId,
    entityMeta,
}: {
    item: TeamGroupPaletteItem;
    dragId: string;
    entityMeta: EntityMeta | null;
}) {
    const { group, placed, remaining } = paletteItem;
    const [selectedRoom, setSelectedRoom] = useState(group.room);
    useEffect(() => { setSelectedRoom(group.room); }, [group.room]);

    const firstClass = group.classCodes[0] ?? '';
    const dragItem: ScheduleItem = {
        teacher: group.teachers[0].code,
        teacherName: group.teachers[0].name,
        classCode: firstClass,
        room: selectedRoom,
        roomName: entityMeta?.room_meta[selectedRoom]?.name ?? selectedRoom,
        subjectCode: group.subjectCode,
        subject: group.subject,
        variant: group.variant,
        teachingType: group.type,
        teamTeachers: group.teachers,
        teamClassCodes: group.classCodes.length > 1 ? group.classCodes : undefined,
    };
    const payload: DragPayload = { source: 'SIDEBAR', item: dragItem };

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sidebar-team-${dragId}`,
        data: payload,
    });

    const progress = group.periodsPerWeek > 0 ? (placed / group.periodsPerWeek) * 100 : 0;
    const allDone = remaining <= 0;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={[
                'relative mx-3 mb-1.5 rounded-lg border overflow-hidden',
                'cursor-grab active:cursor-grabbing select-none transition-opacity',
                isDragging ? 'opacity-40' : '',
                allDone
                    ? 'bg-success-light border-success-border opacity-60'
                    : `bg-surface ${variantPalette(group.variant).cardBorder}`,
            ].join(' ')}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${allDone ? 'bg-success' : variantPalette(group.variant).accent}`} />

            <div className="pl-3 pr-2 pt-2 pb-2">
                {/* Subject + badge */}
                <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-foreground truncate">{group.subjectCode}</span>
                    <span className={[
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                        allDone ? 'bg-success-light text-success border border-success-border' : 'bg-primary/10 text-primary',
                    ].join(' ')}>
                        {placed}/{group.periodsPerWeek}
                    </span>
                </div>

                {/* Teachers list */}
                <div className="flex items-center gap-1 mb-1">
                    <Users size={9} className="text-foreground-muted/60 shrink-0" />
                    <span className="text-[9px] text-foreground-muted truncate">
                        {group.teachers.map(t => t.name).join(' + ')}
                    </span>
                </div>

                {/* Classes */}
                <div className="text-[9px] text-foreground-muted/60 mb-1 truncate">
                    {group.classCodes.join(', ')}
                </div>

                {/* Room dropdown */}
                <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                    className="w-full text-[9px] border border-border rounded px-1.5 py-0.5 bg-surface-alt text-foreground cursor-pointer mb-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {(entityMeta?.room_codes ?? []).map(r => (
                        <option key={r} value={r}>
                            {r} — {entityMeta?.room_meta[r]?.name ?? r}
                        </option>
                    ))}
                </select>

                {/* Progress bar */}
                <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-success' : 'bg-primary/60'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Team Lessons Section ─────────────────────────────────────────────────────

function TeamLessonsSection({
    items,
    entityMeta,
}: {
    items: TeamGroupPaletteItem[];
    entityMeta: EntityMeta | null;
}) {
    const [expanded, setExpanded] = useState(false);
    if (items.length === 0) return null;

    const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);

    return (
        <div className="mb-1 border-b border-border pb-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-alt transition-colors text-left"
            >
                <div className="flex items-center gap-1.5">
                    <Users size={10} className="text-foreground-muted/70 shrink-0" />
                    <span className="text-[11px] font-bold text-foreground">Team Lessons</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {totalRemaining > 0 ? (
                        <span className="bg-warning text-white rounded-full text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center px-1">
                            {totalRemaining}
                        </span>
                    ) : (
                        <CheckCircle size={10} className="text-success" />
                    )}
                    <ChevronDown size={12} className={`text-foreground-muted/60 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {expanded && items.map((paletteItem, idx) => {
                const uniqueId = `${paletteItem.group.id}-${paletteItem.group.classCodes.join(',')}`;
                return (
                    <TeamGroupCard
                        key={uniqueId}
                        item={paletteItem}
                        dragId={uniqueId}
                        entityMeta={entityMeta}
                    />
                );
            })}
        </div>
    );
}

// ─── Subject Group Accordion ──────────────────────────────────────────────────

function SubjectGroupAccordion({
    group,
    dragOffset,
    showTeacher,
    filterMode,
    entityMeta,
}: {
    group: PaletteSubjectGroup;
    dragOffset: number;
    showTeacher: boolean;
    filterMode: FilterMode;
    entityMeta: EntityMeta | null;
}) {
    const allDone = group.totalRemaining === 0;
    const [expanded, setExpanded] = useState(!allDone);

    // Auto-collapse when group completes, auto-expand when items return
    useEffect(() => {
        if (allDone && filterMode !== 'done') setExpanded(false);
        if (!allDone && filterMode !== 'done') setExpanded(true);
    }, [allDone, filterMode]);

    const activeClasses  = group.classes.filter(c => c.remaining > 0);
    const doneClasses    = group.classes.filter(c => c.remaining === 0);

    // Apply filter
    const showActive = filterMode !== 'done';
    const showDone   = filterMode !== 'remaining';

    const visibleCount = (showActive ? activeClasses.length : 0) + (showDone ? doneClasses.length : 0);
    if (visibleCount === 0) return null;

    // Completed classes in the group
    const completedCount = doneClasses.length;
    const totalClasses = group.classes.length;

    return (
        <div className="mb-0.5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface-alt transition-colors text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    {allDone ? (
                        <CheckCircle size={10} className="text-success shrink-0" />
                    ) : (
                        <span className={[
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            variantPalette(group.variant).dot,
                        ].join(' ')} />
                    )}
                    <span className={[
                        'text-[11px] font-bold truncate',
                        allDone ? 'text-foreground-muted' : 'text-foreground',
                    ].join(' ')}>{group.subjectCode}</span>
                    <span className="text-[9px] text-foreground-muted/60 truncate hidden sm:block">{group.subject}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {/* Progress: "2/3 classes" or completed count */}
                    <span className={[
                        'text-[9px] font-medium',
                        allDone ? 'text-success' : 'text-foreground-muted',
                    ].join(' ')}>
                        {completedCount}/{totalClasses}
                    </span>
                    <ChevronDown
                        size={12}
                        className={`text-foreground-muted/60 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {expanded && (
                <>
                    {/* Active items first */}
                    {showActive && activeClasses.map((classItem, i) => (
                        <ClassItemCard
                            key={`${classItem.teacherCode}-${classItem.classCode}`}
                            item={classItem}
                            subjectCode={group.subjectCode}
                            subject={group.subject}
                            variant={group.variant}
                            dragIndex={dragOffset + i}
                            showTeacher={showTeacher}
                            entityMeta={entityMeta}
                        />
                    ))}

                    {/* Separator between active and done */}
                    {showActive && showDone && activeClasses.length > 0 && doneClasses.length > 0 && (
                        <div className="mx-3 my-1 border-t border-dashed border-border" />
                    )}

                    {/* Completed items at bottom */}
                    {showDone && doneClasses.map((classItem, i) => (
                        <CompletedClassCard
                            key={`done-${classItem.teacherCode}-${classItem.classCode}`}
                            item={classItem}
                            subjectCode={group.subjectCode}
                            subject={group.subject}
                            variant={group.variant}
                            dragIndex={dragOffset + activeClasses.length + i}
                            showTeacher={showTeacher}
                            entityMeta={entityMeta}
                        />
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
    { key: 'all',       label: 'ทั้งหมด' },
    { key: 'remaining', label: 'เหลือ' },
    { key: 'done',      label: 'เสร็จ' },
];

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function PaletteSidebar({ teacherCode, dataset, entityMeta }: PaletteSidebarProps) {
    const [activeTab, setActiveTab] = useState<'teacher' | 'all'>('teacher');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');

    const teacherData = useMemo(
        () => computePaletteData(teacherCode, dataset, entityMeta),
        [teacherCode, dataset, entityMeta],
    );

    const globalData = useMemo(
        () => computeGlobalPaletteData(dataset, entityMeta),
        [dataset, entityMeta],
    );

    const teamGroupData = useMemo(
        () => computeTeamGroupPaletteData(dataset, entityMeta),
        [dataset, entityMeta],
    );

    const activeData = activeTab === 'teacher' ? teacherData : globalData;
    const totalRemaining = activeData.reduce((s, g) => s + g.totalRemaining, 0);
    const totalPeriods   = activeData.reduce((s, g) => s + g.totalPeriods, 0);
    const totalPlaced    = activeData.reduce((s, g) => s + g.totalPlaced, 0);

    const teacherDisplayName = entityMeta?.teacher_meta[teacherCode]?.name ?? teacherCode;

    // Pre-compute cumulative drag offsets (includes ALL items, not just active)
    const dragOffsets = useMemo(() => {
        let offset = 0;
        return activeData.map(group => {
            const start = offset;
            offset += group.classes.length; // all items are draggable now
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
                        <span className="bg-warning text-white rounded-full text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center leading-none flex-shrink-0 px-1">
                            {totalRemaining}
                        </span>
                    ) : (
                        <span className="bg-success text-white rounded-full text-[9px] font-bold px-1.5 h-[18px] flex items-center justify-center leading-none flex-shrink-0">
                            <CheckCircle size={10} />
                        </span>
                    )}
                </div>

                {/* Progress summary */}
                <div className="text-[9px] text-foreground-muted mb-1.5">
                    {totalPlaced}/{totalPeriods} periods placed
                </div>
                <div className="h-1 bg-border rounded-full overflow-hidden mb-2">
                    <div
                        className={[
                            'h-full rounded-full transition-all duration-300',
                            totalRemaining === 0 ? 'bg-success' : 'bg-primary/50',
                        ].join(' ')}
                        style={{ width: `${totalPeriods > 0 ? (totalPlaced / totalPeriods) * 100 : 0}%` }}
                    />
                </div>

                {/* Source tab bar (Teacher / All) */}
                <div className="flex gap-1 bg-surface-alt rounded-lg p-0.5 mb-2">
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

                {/* Filter tabs (All / Remaining / Done) */}
                <div className="flex gap-0.5">
                    {FILTER_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilterMode(opt.key)}
                            className={[
                                'flex-1 text-[9px] py-0.5 rounded font-medium transition-colors',
                                filterMode === opt.key
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-alt',
                            ].join(' ')}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto py-1 max-h-[calc(100vh-380px)]">
                {/* Team Lessons section — always shown when groups exist */}
                <TeamLessonsSection items={teamGroupData} entityMeta={entityMeta} />

                {activeData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <CheckCircle size={32} className="text-success mb-2" />
                        <span className="text-xs text-foreground-muted">All sessions scheduled!</span>
                    </div>
                ) : (
                    activeData.map((group, i) => (
                        <SubjectGroupAccordion
                            key={`${activeTab}-${group.subjectCode}`}
                            group={group}
                            dragOffset={dragOffsets[i]}
                            showTeacher={activeTab === 'all'}
                            filterMode={filterMode}
                            entityMeta={entityMeta}
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
