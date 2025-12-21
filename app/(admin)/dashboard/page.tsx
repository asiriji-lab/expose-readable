// app/dashboard/page.tsx
import ScheduleList from './_components/ScheduleList';
import CreateScheduleButton from './_components/CreateScheduleButton';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo and School Name */}
            <div className="flex items-center space-x-3">
              {/* Calendar Icon */}
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ScheDool</h1>
              <span className="text-gray-400">Bodindecha School</span>
            </div>

            {/* Right: Admin Badge and User Icon */}
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                Admin
              </span>
              <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Schedules</h2>
          <p className="text-gray-500 text-sm">Manage your school timetables</p>
        </div>

        {/* Create New Schedule Button */}
        <CreateScheduleButton />

        {/* Schedules List */}
        <ScheduleList />
      </main>
    </div>
  );
}