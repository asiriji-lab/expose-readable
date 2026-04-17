'use client';

import {
  Calendar, Building2, GraduationCap, Users, Pin, Shield, BookOpen, FileText,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { TabName, TabState } from '../../../validators/types';

const TAB_META: Record<TabName, { label: string; thaiLabel: string; icon: LucideIcon }> = {
  period:     { label: 'period',     thaiLabel: 'คาบ',      icon: Calendar },
  room:       { label: 'room',       thaiLabel: 'ห้อง',     icon: Building2 },
  teacher:    { label: 'teacher',    thaiLabel: 'ครู',      icon: GraduationCap },
  student:    { label: 'student',    thaiLabel: 'นักเรียน', icon: Users },
  preplace:   { label: 'preplace',   thaiLabel: 'ตรึงคาบ',  icon: Pin },
  scout:      { label: 'scout',      thaiLabel: 'ลูกเสือ',  icon: Shield },
  elective:   { label: 'elective',   thaiLabel: 'วิชาเสรี', icon: BookOpen },
  curriculum: { label: 'curriculum', thaiLabel: 'หลักสูตร', icon: FileText },
};

const STATUS_CARD_CLASS: Record<TabState['status'], string> = {
  pending:    'border-border bg-surface',
  validating: 'border-primary-border bg-primary-light',
  passed:     'border-l-4 border-success bg-surface',
  warnings:   'border-l-4 border-warning bg-surface',
  errors:     'border-l-4 border-danger bg-surface',
  locked:     'border-border bg-background opacity-60',
  missing:    'border-l-4 border-danger bg-surface',
};

interface TabCardProps {
  tabName: TabName;
  state: TabState;
  onClick: (tabName: TabName) => void;
}

export default function TabCard({ tabName, state, onClick }: TabCardProps) {
  const meta = TAB_META[tabName];
  const result = state.result;

  const errorCount = result?.errors.length ?? 0;
  const warningCount = result?.warnings.length ?? 0;
  const rowCount = result?.rowCount;

  const isClickable = state.status !== 'locked' && state.status !== 'pending';
  const Icon = meta.icon;

  return (
    <button
      onClick={() => isClickable && onClick(tabName)}
      disabled={!isClickable}
      data-testid={`tab-card-${tabName}`}
      className={cn(
        'flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left w-full',
        'transition-all duration-200',
        STATUS_CARD_CLASS[state.status],
        isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default',
      )}
    >
      {/* Icon + name */}
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-foreground-muted shrink-0" />
        <div>
          <p className="font-semibold text-foreground text-sm">{meta.thaiLabel}</p>
          <p className="text-xs text-foreground-muted">{meta.label}</p>
        </div>
      </div>

      {/* Row count */}
      {rowCount !== undefined && (
        <p className="text-xs text-foreground-muted">{rowCount} แถว</p>
      )}

      {/* Status badge */}
      <StatusBadge status={state.status} />

      {/* Error / warning counts */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-2 text-xs">
          {errorCount > 0 && <span className="text-danger">{errorCount} errors</span>}
          {warningCount > 0 && <span className="text-warning">{warningCount} warnings</span>}
        </div>
      )}
    </button>
  );
}
