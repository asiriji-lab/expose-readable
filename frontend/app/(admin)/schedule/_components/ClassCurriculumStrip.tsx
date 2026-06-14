'use client';

import { useMemo, useState, useRef } from 'react';
import { FullDataset, EntityMeta } from '../_types/schedule.types';
import { computeClassCurriculum, ClassSubjectRow } from '../_utils/paletteUtils';

interface Props {
    classCode: string;
    dataset: FullDataset | null;
    entityMeta: EntityMeta | null;
}

interface TooltipState {
    row: ClassSubjectRow;
    rect: DOMRect;
}

function SubjectPill({
    row,
    onHover,
    onHoverEnd,
}: {
    row: ClassSubjectRow;
    onHover: (row: ClassSubjectRow, rect: DOMRect) => void;
    onHoverEnd: () => void;
}) {
    return (
        <div
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-surface cursor-default select-none hover:bg-surface-alt transition-colors"
            onMouseEnter={e => onHover(row, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={onHoverEnd}
        >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${row.met ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-[10px] font-bold text-foreground">{row.subject || row.subjectCode}</span>
            <span className={`text-[9px] font-semibold ${row.met ? 'text-emerald-600' : 'text-red-500'}`}>
                {row.placed}/{row.expected}
            </span>
        </div>
    );
}

function CurriculumTooltip({ state }: { state: TooltipState }) {
    const { row, rect } = state;
    const remaining = row.expected - row.placed;

    const TOOLTIP_W = 240;
    const PAD = 8;
    const pillCenter = rect.left + rect.width / 2;
    const clampedLeft = Math.min(
        Math.max(PAD, pillCenter - TOOLTIP_W / 2),
        window.innerWidth - TOOLTIP_W - PAD,
    );
    // Arrow points to pill center, offset within tooltip box
    const arrowLeft = Math.min(Math.max(12, pillCenter - clampedLeft), TOOLTIP_W - 12);

    return (
        <div
            className="fixed z-50 pointer-events-none"
            style={{ top: rect.top - 8, left: clampedLeft, transform: 'translateY(-100%)', width: TOOLTIP_W }}
        >
            <div className="bg-surface border border-border-strong rounded-xl shadow-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-foreground leading-tight">{row.subjectCode}</p>
                        <p className="text-[10px] text-foreground-muted leading-tight truncate">{row.subject}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        row.met
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-600'
                    }`}>
                        {row.placed}/{row.expected}
                    </span>
                </div>

                <div className="h-1 bg-border rounded-full overflow-hidden mb-2">
                    <div
                        className={`h-full rounded-full transition-all ${row.met ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${row.expected > 0 ? Math.min((row.placed / row.expected) * 100, 100) : 0}%` }}
                    />
                </div>

                {!row.met && remaining > 0 && (
                    <p className="text-[9px] text-red-500 mb-1.5">{remaining} period{remaining !== 1 ? 's' : ''} remaining</p>
                )}

                {row.teachers.length > 0 && (
                    <div className="border-t border-border pt-1.5">
                        <p className="text-[9px] text-foreground-muted/60 uppercase tracking-wide mb-0.5">Teacher{row.teachers.length > 1 ? 's' : ''}</p>
                        {row.teachers.map(t => (
                            <p key={t.code} className="text-[10px] text-foreground">
                                <span className="font-mono text-foreground-muted">{t.code}</span>
                                {t.name !== t.code && <span className="ml-1">{t.name}</span>}
                            </p>
                        ))}
                    </div>
                )}
            </div>
            {/* Arrow tracks pill center regardless of tooltip clamp */}
            <div
                className="absolute bottom-[-5px] w-2.5 h-2.5 bg-surface border-r border-b border-border-strong rotate-45"
                style={{ left: arrowLeft }}
            />
        </div>
    );
}

export default function ClassCurriculumStrip({ classCode, dataset, entityMeta }: Props) {
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const rows = useMemo(() => {
        if (!entityMeta || !classCode) return [];
        return computeClassCurriculum(classCode, dataset, entityMeta);
    }, [classCode, dataset, entityMeta]);

    const handleHover = (row: ClassSubjectRow, rect: DOMRect) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setTooltip({ row, rect }), 150);
    };

    const handleHoverEnd = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setTooltip(null);
    };

    if (!entityMeta || rows.length === 0) return null;

    const totalPlaced = rows.reduce((s, r) => s + r.placed, 0);
    const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
    const metCount = rows.filter(r => r.met).length;

    return (
        <>
            <div className="rounded-xl border border-border-strong bg-surface shadow-sm px-3 py-2.5 mt-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{classCode}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-foreground-muted">
                            {metCount}/{rows.length} subjects · {totalPlaced}/{totalExpected} periods
                        </span>
                        <div className="w-20 h-2 bg-border rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${metCount === rows.length ? 'bg-emerald-500' : 'bg-primary/50'}`}
                                style={{ width: `${totalExpected > 0 ? (totalPlaced / totalExpected) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {rows.map(row => (
                        <SubjectPill
                            key={row.subjectCode}
                            row={row}
                            onHover={handleHover}
                            onHoverEnd={handleHoverEnd}
                        />
                    ))}
                </div>
            </div>

            {tooltip && <CurriculumTooltip state={tooltip} />}
        </>
    );
}
