// app/dashboard/components/ScheduleCard.tsx
import Link from 'next/link';

interface Schedule {
  id: string;
  name: string;
  semester: string;
  lastEdited: string;
  status: 'draft' | 'published';
}

interface ScheduleCardProps {
  schedule: Schedule;
}

export default function ScheduleCard({ schedule }: ScheduleCardProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Schedule Name */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {schedule.name}
        </div>
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
        {schedule.status === 'draft' ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
            Draft
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Published
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Link
          href={`/schedule/${schedule.id}`}
          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </Link>
      </td>
    </tr>
  );
}