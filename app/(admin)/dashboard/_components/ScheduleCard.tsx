import Link from 'next/link';

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

const STATUS_BADGE: Record<SessionStatus, { label: string; className: string }> = {
  awaiting_data: { label: '⏳ รอข้อมูล',         className: 'bg-gray-100 text-gray-600' },
  validated:     { label: '✅ ข้อมูลพร้อม',      className: 'bg-green-100 text-green-700' },
  generating:    { label: '🔄 กำลังสร้างตาราง', className: 'bg-blue-100 text-blue-700 animate-pulse' },
  completed:     { label: '📅 สร้างตารางแล้ว',  className: 'bg-purple-100 text-purple-700' },
  failed:        { label: '❌ สร้างไม่สำเร็จ',   className: 'bg-red-100 text-red-700' },
};

interface ScheduleCardProps {
  schedule: Session;
}

export default function ScheduleCard({ schedule }: ScheduleCardProps) {
  const badge = STATUS_BADGE[schedule.status];
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Schedule Name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{schedule.name}</div>
      </td>

      {/* Semester */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{schedule.semester}</div>
      </td>

      {/* Last Edited */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{schedule.lastEdited}</div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Link
          href={`/dashboard/${schedule.id}`}
          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 font-medium"
        >
          เปิด →
        </Link>
      </td>
    </tr>
  );
}