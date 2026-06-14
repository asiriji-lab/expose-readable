'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { ScheduleItem, EntityType } from '../_types/schedule.types';

interface BandHoverTooltipProps {
    item: ScheduleItem;
    entityType: EntityType;
    anchorRect: DOMRect;
}

export default function BandHoverTooltip({ item, anchorRect }: BandHoverTooltipProps) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const el = tooltipRef.current;
        if (!el) return;
        const { height: tipH, width: tipW } = el.getBoundingClientRect();
        const anchorCenterX = anchorRect.left + anchorRect.width / 2;

        // Default: above the band
        let top = anchorRect.top - tipH - 6;
        if (top < 8) {
            // Flip below
            top = anchorRect.bottom + 6;
        }

        // Horizontal: centered, clamped to viewport
        let left = anchorCenterX - tipW / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

        setPos({ top, left });
    }, [anchorRect]);

    const tooltip = (
        <div
            ref={tooltipRef}
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
            className="fixed z-[60] pointer-events-none bg-white shadow-lg border border-gray-200 rounded-lg px-3 py-2 text-xs w-[200px]"
        >
            <div className="flex flex-col gap-1">
                <div className="font-semibold text-gray-900">
                    {item.subjectCode} — {item.subject}
                </div>
                <div className="text-gray-600">
                    Teacher: {item.teacher} — {item.teacherName}
                </div>
                <div className="text-gray-600">
                    Class: {item.classCode}
                </div>
                <div className="text-gray-600">
                    Room: {item.room} — {item.roomName}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(tooltip, document.body);
}
