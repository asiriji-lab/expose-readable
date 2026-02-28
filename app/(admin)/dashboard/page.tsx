// app/dashboard/page.tsx
import ScheduleList from './_components/ScheduleList';
import CreateScheduleButton from './_components/CreateScheduleButton';

import AdminHeader from '../_components/AdminHeader';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <AdminHeader />

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