'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import ScheduleCard, { Session } from './ScheduleCard';
import ScheduleListSkeleton from './ScheduleListSkeleton';
import EmptyScheduleState from './EmptyScheduleState';

type BackendStatus = 'created' | 'loading_data' | 'running_ga' | 'exporting' | 'completed' | 'failed';

interface BackendJob {
  job_id: string;
  job_name: string;
  status: BackendStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

function mapBackendStatus(status: BackendStatus): Session['status'] {
  switch (status) {
    case 'completed': return 'completed';
    case 'failed':    return 'failed';
    case 'created':   return 'awaiting_data';
    default:          return 'generating';
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

type SortOrder = 'desc' | 'asc';

export default function ScheduleList() {
  const [schedules, setSchedules] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    fetch('/api/schedule/jobs', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load schedules');
        const jobs: BackendJob[] = data.jobs ?? [];
        setSchedules(
          jobs.map((job) => ({
            id: job.job_id,
            name: job.job_name || job.job_id,
            semester: '',
            lastEdited: formatDate(job.updated_at),
            updatedAt: job.updated_at,
            status: mapBackendStatus(job.status),
          })),
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return sortOrder === 'desc' ? tb - ta : ta - tb;
    });
  }, [schedules, sortOrder]);

  const handleSortLastEdited = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const SortIcon = sortOrder === 'desc' ? ChevronDown : ChevronUp;

  return (
    <div className="bg-surface rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">รายการตารางสอน</h3>
      </div>

      {loading ? (
        <ScheduleListSkeleton />
      ) : error ? (
        <div className="px-6 py-8 text-center text-sm text-foreground-muted">
          ไม่สามารถโหลดข้อมูลได้: {error}
        </div>
      ) : schedules.length === 0 ? (
        <EmptyScheduleState />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    ชื่อตาราง
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    ภาคเรียน
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    <button
                      onClick={handleSortLastEdited}
                      className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors group"
                    >
                      แก้ไขล่าสุด
                      <SortIcon
                        size={13}
                        className="text-primary group-hover:text-primary transition-colors"
                      />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {sortedSchedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onDelete={(id) => setSchedules(prev => prev.filter(s => s.id !== id))}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-center space-x-2">
            <button className="p-2 rounded hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="w-5 h-5 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button className="p-2 rounded hover:bg-surface-alt">
              <svg className="w-5 h-5 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
