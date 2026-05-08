'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle, Loader2, Calendar, XCircle, MoreVertical, ExternalLink, Download, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type LucideIcon } from 'lucide-react';

export type SessionStatus =
  | 'awaiting_data'
  | 'validated'
  | 'generating'
  | 'completed'
  | 'failed';

export interface Session {
  id: string;
  name: string;
  semester: string;
  lastEdited: string;
  updatedAt: string;   // ISO string, used for sorting
  status: SessionStatus;
  createdByMe?: boolean;
}

type BadgeVariant = 'neutral' | 'success' | 'info' | 'purple' | 'danger';

const STATUS_BADGE: Record<SessionStatus, { label: string; variant: BadgeVariant; icon: LucideIcon; spin?: boolean }> = {
  awaiting_data: { label: 'รอข้อมูล',         variant: 'neutral',  icon: Clock },
  validated:     { label: 'ข้อมูลพร้อม',      variant: 'success',  icon: CheckCircle },
  generating:    { label: 'กำลังสร้างตาราง', variant: 'info',     icon: Loader2, spin: true },
  completed:     { label: 'สร้างตารางแล้ว',  variant: 'purple',   icon: Calendar },
  failed:        { label: 'สร้างไม่สำเร็จ',   variant: 'danger',   icon: XCircle },
};

interface ScheduleCardProps {
  schedule: Session;
  onDelete: (id: string) => void;
  showOwner?: boolean;
}

export default function ScheduleCard({ schedule, onDelete, showOwner = false }: ScheduleCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { label, variant, icon: Icon, spin } = STATUS_BADGE[schedule.status];

  const scheduleHref = schedule.status === 'completed'
    ? `/schedule?schedule_id=${schedule.id}`
    : `/dashboard/${schedule.id}`;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the 3-dot menu area
    if ((e.target as HTMLElement).closest('[data-menu]')) return;
    router.push(scheduleHref);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    router.push(scheduleHref);
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/schedule/record?schedule_id=${encodeURIComponent(schedule.id)}`);
      if (!res.ok) throw new Error('Failed to fetch schedule');
      const data = await res.json();
      const scheduleData = data.schedule?.data;
      if (!scheduleData) throw new Error('No data');
      const blob = new Blob([JSON.stringify(scheduleData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_${schedule.name.replace(/\s+/g, '_')}_${schedule.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm(`Delete "${schedule.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/schedule/delete?schedule_id=${encodeURIComponent(schedule.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Delete failed');
      }
      onDelete(schedule.id);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <tr
      className="hover:bg-background transition-colors cursor-pointer"
      onClick={handleRowClick}
    >
      {/* Schedule Name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-foreground">{schedule.name}</div>
      </td>

      {/* Semester */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-foreground-muted">{schedule.semester || '—'}</div>
      </td>

      {/* Last Edited */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-foreground-muted">{schedule.lastEdited}</div>
      </td>

      {/* Owner (org view only) */}
      {showOwner && (
        <td className="px-6 py-4 whitespace-nowrap">
          {schedule.createdByMe ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <User size={12} />
              You
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
              <User size={12} />
            </span>
          )}
        </td>
      )}

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={variant}>
          <Icon size={12} className={spin ? 'animate-spin' : undefined} />
          {label}
        </Badge>
      </td>

      {/* 3-dot menu */}
      <td className="px-6 py-4 whitespace-nowrap text-sm" data-menu>
        <div ref={menuRef} className="relative inline-block" data-menu>
          <button
            data-menu
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="p-1.5 rounded-lg text-foreground-muted hover:bg-surface-alt hover:text-foreground transition-colors"
            title="Actions"
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-40 w-40 bg-surface border border-border rounded-xl shadow-lg py-1">
              <button
                onClick={handleOpen}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors"
              >
                <ExternalLink size={14} className="text-foreground-muted" /> Open
              </button>
              {schedule.status === 'completed' && (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors disabled:opacity-50"
                >
                  <Download size={14} className="text-foreground-muted" />
                  {exporting ? 'Exporting…' : 'Export JSON'}
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
