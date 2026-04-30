'use client';

import { AlertTriangle } from 'lucide-react';
import type { ScheduleItem } from '../_types/schedule.types';
import type { ConflictInfo } from '../_utils/scheduleLogic';

export interface PendingPreplaceState {
    targetDay: string;
    targetSlot: number;
    item: ScheduleItem;
    conflicts: ConflictInfo[];
    source: 'GRID' | 'SIDEBAR';
    sourceDay?: string;
    sourceSlot?: number;
}

interface PreplaceWarningDialogProps {
    pendingDrop: PendingPreplaceState;
    onConfirm: () => void;
    onCancel: () => void;
}

const DAY_LABEL: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

export default function PreplaceWarningDialog({
    pendingDrop,
    onConfirm,
    onCancel,
}: PreplaceWarningDialogProps) {
    const { item, conflicts, targetDay, targetSlot } = pendingDrop;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 flex items-center gap-3 bg-violet-600">
                    <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                    <div>
                        <h3 className="text-white font-bold text-base leading-tight">Pre-placed Activity</h3>
                        <p className="text-white/80 text-xs mt-0.5">
                            {DAY_LABEL[targetDay] ?? targetDay} · Period {targetSlot}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                    {/* Item info */}
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1">
                        <span className="text-xs font-bold text-violet-800">{item.subjectCode}</span>
                        {item.subject && item.subject !== item.subjectCode && (
                            <span className="text-[11px] text-violet-600">{item.subject}</span>
                        )}
                    </div>

                    <p className="text-sm text-foreground-muted">
                        This slot is a <strong className="text-foreground">pre-placed or elective activity</strong> fixed by the preschedule phase. Moving it may break timetable structure.
                    </p>

                    {conflicts.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[11px] font-semibold text-amber-700 mb-1">Also conflicts with:</p>
                            {conflicts.map((c, i) => (
                                <p key={i} className="text-[11px] text-amber-700">
                                    {c.entity === 'teacher' ? 'Teacher' : c.entity === 'class' ? 'Class' : 'Room'} {c.key} · {c.existingItem.subjectCode}
                                </p>
                            ))}
                            <p className="text-[10px] text-amber-600 mt-1">Conflicting lessons will be ejected.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-bold rounded-lg transition-colors text-white bg-violet-600 hover:bg-violet-700"
                    >
                        Move Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}
