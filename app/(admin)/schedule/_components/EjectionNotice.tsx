'use client';

import { Undo2, Check, AlertCircle } from 'lucide-react';
import type { ScheduleItem } from '../_types/schedule.types';

interface EjectionNoticeProps {
    ejected: ScheduleItem[];
    onUndo: () => void;
    onAccept: () => void;
}

export default function EjectionNotice({ ejected, onUndo, onAccept }: EjectionNoticeProps) {
    return (
        <div className="fixed bottom-6 right-6 z-50 w-72 rounded-xl border border-amber-300 bg-surface shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-800">
                    {ejected.length} lesson{ejected.length > 1 ? 's' : ''} displaced
                </span>
            </div>

            {/* Displaced list */}
            <div className="px-4 py-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {ejected.map((item, i) => (
                    <div key={i} className="flex flex-col">
                        <span className="text-[11px] font-semibold text-foreground">
                            {item.subjectCode} · {item.classCode}
                        </span>
                        <span className="text-[10px] text-foreground-muted">
                            {item.teacher} · {item.teacherName} · {item.room}
                        </span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
                <button
                    onClick={onUndo}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-surface-alt transition-colors text-foreground"
                >
                    <Undo2 className="w-3.5 h-3.5" />
                    Undo
                </button>
                <button
                    onClick={onAccept}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                </button>
            </div>
        </div>
    );
}
