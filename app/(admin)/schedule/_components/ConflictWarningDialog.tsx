'use client';

import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Users, ArrowRight } from 'lucide-react';
import type { ScheduleItem, FullDataset, EntityMeta } from '../_types/schedule.types';
import type { ConflictInfo } from '../_utils/scheduleLogic';
import { findConflictsAtSlot, removeItemFromDataset } from '../_utils/scheduleLogic';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingDropState {
    targetDay: string;
    targetSlot: number;
    item: ScheduleItem;
    conflicts: ConflictInfo[];
    isTeamSplit: boolean;
    canSwap: boolean;
    source: 'GRID' | 'SIDEBAR';
    sourceDay?: string;
    sourceSlot?: number;
}

interface ConflictWarningDialogProps {
    pendingDrop: PendingDropState;
    dataset: FullDataset;
    entityMeta: EntityMeta | null;
    onConfirm: (editedItem: ScheduleItem) => void;
    onSwap: () => void;
    onCancel: () => void;
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function LessonCard({ item, label }: { item: ScheduleItem; label: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">{label}</span>
            <div className="rounded-lg border border-border bg-surface-alt p-3 flex flex-col gap-1.5 min-h-[100px]">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">{item.subjectCode}</span>
                    {item.teachingType && item.teachingType !== 'standard' && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-bold uppercase">
                            {item.teachingType}
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-foreground-muted truncate">{item.subject}</span>
                <div className="mt-auto flex flex-col gap-0.5">
                    <span className="text-[10px] text-foreground-muted">
                        <span className="font-semibold">T:</span> {item.teacher} · {item.teacherName}
                    </span>
                    <span className="text-[10px] text-foreground-muted">
                        <span className="font-semibold">C:</span> {item.classCode}
                    </span>
                    <span className="text-[10px] text-foreground-muted">
                        <span className="font-semibold">R:</span> {item.room}
                        {item.roomName && item.roomName !== item.room && ` · ${item.roomName}`}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Editable New Item Panel ──────────────────────────────────────────────────

function EditableItemPanel({
    item,
    entityMeta,
    onChange,
}: {
    item: ScheduleItem;
    entityMeta: EntityMeta | null;
    onChange: (item: ScheduleItem) => void;
}) {
    const teacherCodes = entityMeta?.teacher_codes ?? [];
    const classCodes = entityMeta?.class_codes ?? [];
    const roomCodes = entityMeta?.room_codes ?? [];
    const subjectCodes = Object.keys(entityMeta?.subjects ?? {});

    const update = (patch: Partial<ScheduleItem>) => {
        const next = { ...item, ...patch };
        if (patch.teacher) {
            next.teacherName = entityMeta?.teacher_meta[patch.teacher]?.name ?? patch.teacher;
        }
        if (patch.room) {
            next.roomName = entityMeta?.room_meta[patch.room]?.name ?? patch.room;
        }
        if (patch.subjectCode) {
            const info = entityMeta?.subjects[patch.subjectCode];
            next.subject = info?.name ?? patch.subjectCode;
            next.variant = info?.variant ?? '_activity';
        }
        onChange(next);
    };

    const sel = 'w-full text-xs border border-border rounded px-2 py-1.5 bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer';

    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Placing (editable)</span>
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 flex flex-col gap-2 min-h-[100px]">
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-semibold text-foreground-muted uppercase">Subject</label>
                    <select value={item.subjectCode} onChange={e => update({ subjectCode: e.target.value })} className={sel}>
                        {subjectCodes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-semibold text-foreground-muted uppercase">Teacher</label>
                    <select value={item.teacher} onChange={e => update({ teacher: e.target.value })} className={sel}>
                        {teacherCodes.map(c => <option key={c} value={c}>{c} · {entityMeta?.teacher_meta[c]?.name ?? c}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-foreground-muted uppercase">Class</label>
                        <select value={item.classCode} onChange={e => update({ classCode: e.target.value })} className={sel}>
                            {classCodes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-semibold text-foreground-muted uppercase">Room</label>
                        <select value={item.room} onChange={e => update({ room: e.target.value })} className={sel}>
                            {roomCodes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export default function ConflictWarningDialog({
    pendingDrop,
    dataset,
    entityMeta,
    onConfirm,
    onSwap,
    onCancel,
}: ConflictWarningDialogProps) {
    const [editedItem, setEditedItem] = useState<ScheduleItem>(pendingDrop.item);

    // Reset when pendingDrop changes (new drag)
    useEffect(() => {
        setEditedItem(pendingDrop.item);
    }, [pendingDrop]);

    // Re-check conflicts live as user edits
    const liveConflicts = useMemo(() => {
        const virtualDataset =
            pendingDrop.source === 'GRID' &&
            pendingDrop.sourceDay &&
            pendingDrop.sourceSlot !== undefined
                ? removeItemFromDataset(dataset, pendingDrop.item, pendingDrop.sourceDay, pendingDrop.sourceSlot)
                : dataset;
        return findConflictsAtSlot(virtualDataset, pendingDrop.targetDay, pendingDrop.targetSlot, editedItem);
    }, [editedItem, dataset, pendingDrop]);

    const hasConflict = liveConflicts.length > 0;

    // Unique existing items being displaced
    const existingItems = useMemo(() => {
        const seen = new Set<string>();
        return pendingDrop.conflicts
            .map(c => c.existingItem)
            .filter(item => {
                const key = `${item.teacher}|${item.classCode}|${item.room}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [pendingDrop.conflicts]);

    const dayLabel: Record<string, string> = {
        Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">

                {/* Header */}
                <div className={`px-6 py-4 flex items-center gap-3 ${pendingDrop.isTeamSplit ? 'bg-purple-600' : 'bg-amber-500'}`}>
                    <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-base leading-tight">
                            {pendingDrop.isTeamSplit ? 'Team / Split Teaching Conflict' : 'Slot Conflict'}
                        </h3>
                        <p className="text-white/80 text-xs mt-0.5">
                            {dayLabel[pendingDrop.targetDay] ?? pendingDrop.targetDay} · Period {pendingDrop.targetSlot}
                        </p>
                    </div>
                </div>

                {/* Team/Split banner */}
                {pendingDrop.isTeamSplit && (
                    <div className="mx-6 mt-4 flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
                        <Users className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-purple-700">
                            This slot contains a <strong>Team / Split</strong> teaching arrangement.
                            Confirming will eject <strong>all</strong> partners from this slot.
                        </p>
                    </div>
                )}

                {/* Conflict resolution status */}
                {!hasConflict && (
                    <div className="mx-6 mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-xs text-emerald-700 font-medium">
                            ✓ No conflict with current selection — safe to place.
                        </span>
                    </div>
                )}

                {/* Side-by-side comparison */}
                <div className="p-6 grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                    {/* Left: existing items */}
                    <div className="flex flex-col gap-2">
                        {existingItems.map((item, i) => (
                            <LessonCard
                                key={`${item.teacher}|${item.classCode}`}
                                item={item}
                                label={i === 0 ? 'Will be displaced' : ''}
                            />
                        ))}
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center pt-6">
                        <ArrowRight className="w-5 h-5 text-foreground-muted/50" />
                    </div>

                    {/* Right: editable new item */}
                    <EditableItemPanel
                        item={editedItem}
                        entityMeta={entityMeta}
                        onChange={setEditedItem}
                    />
                </div>

                {/* Displaced items list when conflict remains */}
                {hasConflict && (
                    <div className="mx-6 mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-[10px] font-semibold text-amber-700 mb-1">Still conflicts with:</p>
                        {liveConflicts.map((c, i) => (
                            <p key={i} className="text-[10px] text-amber-700">
                                {c.entity === 'teacher' ? 'Teacher' : c.entity === 'class' ? 'Class' : 'Room'} {c.key} is busy
                            </p>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-2">
                        {pendingDrop.canSwap && !pendingDrop.isTeamSplit && (
                            <button
                                onClick={onSwap}
                                className="px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-surface-alt rounded-lg transition-colors"
                            >
                                Swap slots
                            </button>
                        )}
                        <button
                            onClick={() => onConfirm(editedItem)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors text-white ${
                                hasConflict
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-primary hover:bg-primary-hover'
                            }`}
                        >
                            {hasConflict ? `Eject & Place` : 'Place'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
