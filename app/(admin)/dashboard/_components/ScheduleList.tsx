import ScheduleCard from './ScheduleCard';

// example
const mockSchedules = [
  {
    id: 'sem2-2025',
    name: 'Schedule Semester 2/ 2025',
    semester: '2/2025',
    lastEdited: '11/8/2025',
    status: 'draft' as const,
  },
  {
    id: 'sem1-2025',
    name: 'Schedule Semester 1/ 2025',
    semester: '1/2025',
    lastEdited: '11/1/2025',
    status: 'published' as const,
  },
  {
    id: 'sem2-2024',
    name: 'Schedule Semester 2/ 2024',
    semester: '2/2024',
    lastEdited: '11/8/2024',
    status: 'published' as const,
  },
  {
    id: 'sem1-2024',
    name: 'Schedule Semester 1/ 2024',
    semester: '1/2024',
    lastEdited: '11/1/2024',
    status: 'published' as const,
  },
  {
    id: 'sem2-2023',
    name: 'Schedule Semester 2/ 2023',
    semester: '2/2023',
    lastEdited: '11/8/2023',
    status: 'published' as const,
  },
  {
    id: 'sem1-2023',
    name: 'Schedule Semester 1/ 2023',
    semester: '1/2023',
    lastEdited: '11/1/2023',
    status: 'published' as const,
  },
  {
    id: 'sem2-2022',
    name: 'Schedule Semester 2/ 2022',
    semester: '2/2022',
    lastEdited: '11/8/2022',
    status: 'published' as const,
  },
];

export default function ScheduleList() {
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">All Schedules</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Semester
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Edited
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mockSchedules.map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-center space-x-2">
        <button className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="p-2 rounded hover:bg-gray-100">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}