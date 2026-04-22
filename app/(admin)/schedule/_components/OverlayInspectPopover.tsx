'use client';

import { OverlayCellData, ScheduleItem, EntityType, GroupedSlots } from '../_types/schedule.types';

interface OverlayInspectPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onEdit?: () => void;
    day: string;
    slot: number;
    data: OverlayCellData | null;
    /** If set, highlights this entity row and dims the others */
    focusedEntity?: EntityType;
    /** SPLIT teaching groups index — populated by transformToFullDataset */
    groupedSlots?: GroupedSlots;
}

// ─── Entity colors ───────────────────────────────────────────────────────────

const ENTITY_DOT_COLOR: Record<EntityType, string> = {
    teacher: 'bg-emerald-500',
    class:   'bg-pink-500',
    room:    'bg-amber-500',
};

const ENTITY_ACCENT: Record<EntityType, string> = {
    teacher: 'border-l-emerald-400',
    class:   'border-l-pink-400',
    room:    'border-l-amber-400',
};

// ─── Entity Row ───────────────────────────────────────────────────────────────

interface EntityRowProps {
    label: string;
    entityType: EntityType;
    item: ScheduleItem | undefined;
    primaryField: string;
    secondaryLabel: string;
    secondaryValue: string;
    tertiaryLabel?: string;
    tertiaryValue?: string;
    /** When true, renders at reduced opacity */
    dim?: boolean;
}

function EntityRow({
    label,
    entityType,
    item,
    primaryField,
    secondaryLabel,
    secondaryValue,
    tertiaryLabel,
    tertiaryValue,
    dim = false,
}: EntityRowProps) {
    const isBusy = !!item;
    const dotColor = isBusy ? ENTITY_DOT_COLOR[entityType] : 'bg-gray-300';
    const accentBorder = isBusy ? `border-l-[3px] ${ENTITY_ACCENT[entityType]}` : '';

    return (
        <div className={[
            'rounded-lg border px-4 py-3 flex flex-col gap-1.5 transition-opacity duration-150',
            isBusy ? 'border-border bg-surface' : 'border-border bg-surface-alt',
            accentBorder,
            dim ? 'opacity-40' : '',
        ].join(' ')}>
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wide">{label}</span>
                </div>
                <span className={`text-xs font-bold ${isBusy ? 'text-foreground' : 'text-foreground-muted'}`}>
                    {isBusy ? primaryField : 'ว่าง'}
                </span>
            </div>

            {/* Detail rows — only when busy */}
            {isBusy && (
                <div className="flex flex-col gap-1 pt-1 border-t border-border">
                    <div className="flex items-start gap-2">
                        <span className="text-[11px] text-foreground-muted w-14 flex-shrink-0">{secondaryLabel}</span>
                        <span className="text-[11px] text-foreground font-medium truncate">{secondaryValue || '—'}</span>
                    </div>
                    {tertiaryLabel && (
                        <div className="flex items-start gap-2">
                            <span className="text-[11px] text-foreground-muted w-14 flex-shrink-0">{tertiaryLabel}</span>
                            <span className="text-[11px] text-foreground font-medium truncate">{tertiaryValue || '—'}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main popover ─────────────────────────────────────────────────────────────

export default function OverlayInspectPopover({
    isOpen,
    onClose,
    onEdit,
    day,
    slot,
    data,
    focusedEntity,
    groupedSlots,
}: OverlayInspectPopoverProps) {
    if (!isOpen || !data) return null;

    const { allFree, isSynchronized } = data;

    const busyCount = [!!data.teacher, !!data.class, !!data.room].filter(Boolean).length;

    // SPLIT teaching: look up groups for this slot
    const teacherItem = data.teacher;
    const splitGroups = teacherItem?.teachingType === 'split'
        ? (groupedSlots?.[teacherItem.classCode]?.[day]?.[slot] ?? null)
        : null;

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-surface rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-surface-alt border-b border-border px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{day}, Slot {slot}</span>
                            <span className="text-xs text-foreground-muted">Slot Overview</span>
                        </div>
                        {/* Occupied count — neutral badge */}
                        {!allFree && !isSynchronized && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                                {busyCount}/3 occupied
                            </span>
                        )}
                        {allFree && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] font-medium">
                                All free
                            </span>
                        )}
                        {isSynchronized && !allFree && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-medium">
                                ✓ Synced
                            </span>
                        )}
                        {teacherItem?.teachingType === 'team' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-medium">
                                Team
                            </span>
                        )}
                        {teacherItem?.teachingType === 'split' && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[11px] font-medium">
                                Split
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Entity rows */}
                <div className="p-4 flex flex-col gap-2.5">
                    <EntityRow
                        label="Teacher"
                        entityType="teacher"
                        item={data.teacher}
                        primaryField={data.teacher?.teacher ?? ''}
                        secondaryLabel="Subject"
                        secondaryValue={
                            data.teacher
                                ? `${data.teacher.subjectCode}${data.teacher.subject ? ` — ${data.teacher.subject}` : ''}`
                                : ''
                        }
                        tertiaryLabel="Class"
                        tertiaryValue={data.teacher?.classCode}
                        dim={!!focusedEntity && focusedEntity !== 'teacher'}
                    />
                    <EntityRow
                        label="Class"
                        entityType="class"
                        item={data.class}
                        primaryField={data.class?.classCode ?? ''}
                        secondaryLabel="Subject"
                        secondaryValue={
                            data.class
                                ? `${data.class.subjectCode}${data.class.subject ? ` — ${data.class.subject}` : ''}`
                                : ''
                        }
                        tertiaryLabel="Teacher"
                        tertiaryValue={data.class?.teacherName}
                        dim={!!focusedEntity && focusedEntity !== 'class'}
                    />
                    <EntityRow
                        label="Room"
                        entityType="room"
                        item={data.room}
                        primaryField={data.room?.room ?? ''}
                        secondaryLabel="Subject"
                        secondaryValue={
                            data.room
                                ? `${data.room.subjectCode}${data.room.subject ? ` — ${data.room.subject}` : ''}`
                                : ''
                        }
                        tertiaryLabel="Teacher"
                        tertiaryValue={data.room?.teacherName}
                        dim={!!focusedEntity && focusedEntity !== 'room'}
                    />
                </div>

                {/* SPLIT teaching groups */}
                {splitGroups && splitGroups.length > 0 && (
                    <div className="px-4 pb-2">
                        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                            <p className="text-[11px] font-semibold text-violet-700 uppercase tracking-wide mb-2">
                                Split Teaching — {splitGroups.length} groups
                            </p>
                            <div className="flex flex-col gap-1.5">
                                {splitGroups.map((g, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px] text-violet-900">
                                        <span className="w-4 h-4 rounded-full bg-violet-200 flex items-center justify-center text-[10px] font-bold text-violet-700 flex-shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="font-medium">{g.teacherCode}</span>
                                        <span className="text-violet-500">·</span>
                                        <span className="truncate">{g.teacherName}</span>
                                        <span className="ml-auto flex-shrink-0 text-violet-600 font-medium">{g.roomName || g.room}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 pb-4 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 rounded-lg bg-surface-alt border border-border text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
                    >
                        Close
                    </button>
                    {onEdit && !allFree && (
                        <button
                            onClick={onEdit}
                            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
                        >
                            Edit slot
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
