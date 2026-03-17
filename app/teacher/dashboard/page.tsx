import Link from 'next/link';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';

export default function TeacherDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader roleLabel="Teacher" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-1">Teacher Dashboard</h2>
          <p className="text-foreground-muted text-sm">View your own teaching schedule and classes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">This Week</p>
            <p className="text-2xl font-bold text-foreground mt-1">24</p>
            <p className="text-xs text-foreground-muted mt-1">Teaching periods</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">Assigned Classes</p>
            <p className="text-2xl font-bold text-foreground mt-1">6</p>
            <p className="text-xs text-foreground-muted mt-1">Across this semester</p>
          </div>
          <div className="bg-surface rounded-lg border border-border p-5">
            <p className="text-xs text-foreground-muted">Homeroom</p>
            <p className="text-2xl font-bold text-foreground mt-1">6/1</p>
            <p className="text-xs text-foreground-muted mt-1">Current assigned room</p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">My Schedule</h3>
            <p className="text-sm text-foreground-muted">Open your teacher timetable in read-only mode</p>
          </div>
          <Link
            href="/teacher/schedule"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Open Schedule
          </Link>
        </div>
      </main>
    </div>
  );
}
