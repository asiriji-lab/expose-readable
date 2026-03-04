import Link from 'next/link';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';

export default function StudentDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader roleLabel="Student" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Student Dashboard</h2>
          <p className="text-gray-500 text-sm">View your class timetable and latest schedule updates</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-xs text-gray-500">This Week</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">32</p>
            <p className="text-xs text-gray-500 mt-1">Learning periods</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Current Class</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">6/15</p>
            <p className="text-xs text-gray-500 mt-1">Homeroom assignment</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-xs text-gray-500">Default Room</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">5410</p>
            <p className="text-xs text-gray-500 mt-1">Primary classroom</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">My Schedule</h3>
            <p className="text-sm text-gray-500">Open your timetable in read-only mode</p>
          </div>
          <Link
            href="/student/schedule"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Open Schedule
          </Link>
        </div>
      </main>
    </div>
  );
}
