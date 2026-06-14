'use client';

import { CalendarPlus } from 'lucide-react';

interface EmptyScheduleStateProps {
    onCreateClick?: () => void;
}

/**
 * Empty state shown when no schedules exist yet.
 */
export default function EmptyScheduleState({ onCreateClick }: EmptyScheduleStateProps) {
    return (
        <div className="bg-surface rounded-lg shadow border border-border">
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center mb-4">
                    <CalendarPlus className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">ยังไม่มีตารางสอน</h3>
                <p className="text-sm text-foreground-muted mb-6 max-w-sm">
                    สร้างตารางสอนใหม่เพื่อเริ่มจัดตารางเรียนสำหรับภาคเรียนถัดไป
                </p>
                {onCreateClick && (
                    <button
                        onClick={onCreateClick}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        สร้างตารางสอนใหม่
                    </button>
                )}
            </div>
        </div>
    );
}
