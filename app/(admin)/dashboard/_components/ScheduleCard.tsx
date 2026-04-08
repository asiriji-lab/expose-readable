import Link from 'next/link';
import { Clock, CheckCircle, Loader2, Calendar, XCircle, ArrowRight } from 'lucide-react';
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
  status: SessionStatus;
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
}

export default function ScheduleCard({ schedule }: ScheduleCardProps) {
  const { label, variant, icon: Icon, spin } = STATUS_BADGE[schedule.status];

  // Completed jobs open the timetable viewer; everything else opens the
  // setup / creation flow so the user can check status or retry.
  const href = schedule.status === 'completed'
    ? `/schedule?job_id=${schedule.id}`
    : `/dashboard/new`;

  return (
    <tr className="hover:bg-background transition-colors">
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

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Badge variant={variant}>
          <Icon size={12} className={spin ? 'animate-spin' : undefined} />
          {label}
        </Badge>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Link
          href={href}
          className="text-primary hover:text-primary-hover inline-flex items-center gap-1 font-medium"
        >
          เปิด <ArrowRight size={14} />
        </Link>
      </td>
    </tr>
  );
}
