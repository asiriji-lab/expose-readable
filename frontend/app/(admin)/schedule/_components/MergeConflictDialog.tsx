'use client';

import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import type { ScheduleItem } from '../_types/schedule.types';
import type { MergeConflict, SlotKey } from '../_utils/datasetDiff';

interface MergeConflictDialogProps {
  conflicts: MergeConflict[];
  onResolve: (resolutions: Map<SlotKey, 'mine' | 'theirs'>) => void;
  onCancel: () => void;
}

const DAY_SHORT: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

function ItemCard({
  item,
  label,
  selected,
  onClick,
}: {
  item: ScheduleItem | null;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'w-full text-left rounded-lg border px-3 py-2.5 flex flex-col gap-1 transition-all',
        onClick ? 'cursor-pointer' : 'cursor-default',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : onClick
            ? 'border-border bg-surface-alt hover:border-primary/50'
            : 'border-border bg-surface-alt opacity-70',
      ].join(' ')}
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{label}</span>
      {item ? (
        <>
          <span className="text-xs font-semibold text-foreground leading-tight">{item.subjectCode}</span>
          <span className="text-[10px] text-foreground-muted truncate">{item.subject}</span>
          <div className="flex flex-col gap-0.5 mt-0.5">
            <span className="text-[9px] text-foreground-muted">T: {item.teacher}</span>
            <span className="text-[9px] text-foreground-muted">C: {item.classCode} · R: {item.room}</span>
          </div>
        </>
      ) : (
        <span className="text-xs text-foreground-muted italic mt-1">Empty</span>
      )}
    </button>
  );
}

export default function MergeConflictDialog({ conflicts, onResolve, onCancel }: MergeConflictDialogProps) {
  const [resolutions, setResolutions] = useState<Map<SlotKey, 'mine' | 'theirs'>>(new Map());

  const resolve = (key: SlotKey, choice: 'mine' | 'theirs') => {
    setResolutions(prev => new Map(prev).set(key, choice));
  };

  const resolveAll = (choice: 'mine' | 'theirs') => {
    setResolutions(new Map(conflicts.map(c => [c.key, choice])));
  };

  const resolvedCount = resolutions.size;
  const allResolved = resolvedCount === conflicts.length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-orange-500 px-5 py-4 flex items-center gap-3 shrink-0">
          <GitMerge className="w-5 h-5 text-white shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base leading-tight">Sync Conflicts</h3>
            <p className="text-white/80 text-xs mt-0.5">
              {conflicts.length} slot{conflicts.length !== 1 ? 's' : ''} changed on both machines
            </p>
          </div>
          <span className="text-white/90 text-xs font-semibold shrink-0 bg-white/20 px-2 py-1 rounded-full">
            {resolvedCount}/{conflicts.length}
          </span>
        </div>

        {/* Bulk actions */}
        <div className="px-5 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-surface-alt">
          <span className="text-xs text-foreground-muted mr-auto">Bulk:</span>
          <button
            onClick={() => resolveAll('mine')}
            className="px-3 py-1 text-xs font-medium border border-border rounded-lg bg-surface hover:bg-surface-alt transition-colors"
          >
            Keep all mine
          </button>
          <button
            onClick={() => resolveAll('theirs')}
            className="px-3 py-1 text-xs font-medium border border-border rounded-lg bg-surface hover:bg-surface-alt transition-colors"
          >
            Take all theirs
          </button>
        </div>

        {/* Conflict list */}
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {conflicts.map((conflict) => {
            const choice = resolutions.get(conflict.key);
            return (
              <div key={conflict.key} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-foreground">
                    {DAY_SHORT[conflict.day] ?? conflict.day} · Period {conflict.period}
                  </span>
                  <span className="text-foreground-muted">·</span>
                  <span className="text-xs text-foreground-muted font-mono">T {conflict.teacherCode}</span>
                  {choice && (
                    <span className={[
                      'ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                      choice === 'mine'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700',
                    ].join(' ')}>
                      {choice === 'mine' ? '✓ Kept mine' : '✓ Took theirs'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ItemCard item={conflict.base}   label="Original" />
                  <ItemCard
                    item={conflict.server}
                    label="Server"
                    selected={choice === 'theirs'}
                    onClick={() => resolve(conflict.key, 'theirs')}
                  />
                  <ItemCard
                    item={conflict.local}
                    label="Yours"
                    selected={choice === 'mine'}
                    onClick={() => resolve(conflict.key, 'mine')}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-alt rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => allResolved && onResolve(resolutions)}
            disabled={!allResolved}
            className="px-4 py-2 text-sm font-bold rounded-lg transition-colors text-white bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allResolved
              ? 'Apply merge'
              : `Resolve ${conflicts.length - resolvedCount} more`}
          </button>
        </div>
      </div>
    </div>
  );
}
