'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';
import { useLatestSchedule } from '@/lib/hooks/useLatestSchedule';
import { getClassCodes, countClassPeriods } from '@/lib/api/transform';

export default function StudentDashboardPage() {
  const { dataset, loadState } = useLatestSchedule();

  const classCodes = useMemo(() => getClassCodes(dataset), [dataset]);

  // Use first available class as the "current class" for summary stats.
  const firstClass = classCodes[0] ?? '';

  const totalPeriods = useMemo(
    () => countClassPeriods(dataset, firstClass),
    [dataset, firstClass],
  );

  // Derive default room: most common room in the first class's schedule.
  const defaultRoom = useMemo(() => {
    const sched = dataset.classes[firstClass];
    if (!sched) return '—';
    const counts: Record<string, number> = {};
    for (const daySlots of Object.values(sched)) {
      for (const item of Object.values(daySlots)) {
        if (item.room) counts[item.room] = (counts[item.room] ?? 0) + 1;
      }
    }
    let best = '—'; let max = 0;
    for (const [room, count] of Object.entries(counts)) {
      if (count > max) { max = count; best = room; }
    }
    return best;
  }, [dataset, firstClass]);

  const isLoading = loadState === 'loading';
  const isEmpty   = loadState === 'empty' || loadState === 'error';

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader roleLabel="Student" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-1">Student Dashboard</h2>
          <p className="text-foreground-muted text-sm">View your class timetable and latest schedule updates</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="This Week"
            value={isLoading ? '…' : isEmpty ? '—' : String(totalPeriods)}
            sub="Learning periods"
          />
          <StatCard
            label="Current Class"
            value={isLoading ? '…' : isEmpty ? '—' : (firstClass || '—')}
            sub="Homeroom assignment"
          />
          <StatCard
            label="Default Room"
            value={isLoading ? '…' : isEmpty ? '—' : defaultRoom}
            sub="Primary classroom"
          />
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

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-5">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-foreground-muted mt-1">{sub}</p>
    </div>
  );
}
