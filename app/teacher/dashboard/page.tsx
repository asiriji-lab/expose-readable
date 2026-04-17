'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';
import { useLatestSchedule } from '@/lib/hooks/useLatestSchedule';
import { getTeacherCodes, countTeacherPeriods } from '@/lib/api/transform';

export default function TeacherDashboardPage() {
  const { dataset, loadState } = useLatestSchedule();

  const teacherCodes = useMemo(() => getTeacherCodes(dataset), [dataset]);

  // Aggregate stats across all teachers (or show total for the first loaded teacher).
  const totalPeriods = useMemo(
    () => teacherCodes.reduce((sum, code) => sum + countTeacherPeriods(dataset, code), 0),
    [dataset, teacherCodes],
  );

  // Derive a homeroom: the class code that appears most frequently as a single-teacher class.
  const homeroomClass = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const code of teacherCodes) {
      const sched = dataset.teachers[code];
      if (!sched) continue;
      for (const daySlots of Object.values(sched)) {
        for (const item of Object.values(daySlots)) {
          if (item.classCode) counts[item.classCode] = (counts[item.classCode] ?? 0) + 1;
        }
      }
    }
    let best = '—'; let max = 0;
    for (const [cls, count] of Object.entries(counts)) {
      if (count > max) { max = count; best = cls; }
    }
    return best;
  }, [dataset, teacherCodes]);

  const assignedClasses = useMemo(() => {
    const set = new Set<string>();
    for (const code of teacherCodes) {
      const sched = dataset.teachers[code];
      if (!sched) continue;
      for (const daySlots of Object.values(sched)) {
        for (const item of Object.values(daySlots)) {
          if (item.classCode) set.add(item.classCode);
        }
      }
    }
    return set.size;
  }, [dataset, teacherCodes]);

  const isLoading = loadState === 'loading';
  const isEmpty   = loadState === 'empty' || loadState === 'error';

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader roleLabel="Teacher" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-1">Teacher Dashboard</h2>
          <p className="text-foreground-muted text-sm">View your own teaching schedule and classes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="This Week"
            value={isLoading ? '…' : isEmpty ? '—' : String(totalPeriods)}
            sub="Teaching periods"
          />
          <StatCard
            label="Assigned Classes"
            value={isLoading ? '…' : isEmpty ? '—' : String(assignedClasses)}
            sub="Across this semester"
          />
          <StatCard
            label="Homeroom"
            value={isLoading ? '…' : isEmpty ? '—' : homeroomClass}
            sub="Current assigned class"
          />
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

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-5">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-foreground-muted mt-1">{sub}</p>
    </div>
  );
}
