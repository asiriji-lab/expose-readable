import Link from 'next/link';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';

export default function StudentDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader roleLabel="Student" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-1">Student Dashboard</h2>
          <p className="text-foreground-muted text-sm">View your class timetable and latest schedule updates</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">This Week</p>
            <p className="text-2xl font-bold text-foreground mt-1">32</p>
            <p className="text-xs text-foreground-muted mt-1">Learning periods</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">Current Class</p>
            <p className="text-2xl font-bold text-foreground mt-1">6/15</p>
            <p className="text-xs text-foreground-muted mt-1">Homeroom assignment</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">Default Room</p>
            <p className="text-2xl font-bold text-foreground mt-1">5410</p>
            <p className="text-xs text-foreground-muted mt-1">Primary classroom</p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">My Schedule</h3>
            <p className="text-sm text-foreground-muted">Open your timetable in read-only mode</p>
          </div>
          <Link
            href="/student/schedule"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Open Schedule
          </Link>
        </div>
      </main>
    </div>
  );
}
