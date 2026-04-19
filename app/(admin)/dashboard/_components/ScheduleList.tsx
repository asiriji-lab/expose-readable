'use client';

import { useEffect, useState } from 'react';
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

export default function ScheduleList() {
  const [schedules, setSchedules] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/schedule/jobs')
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
            status: mapBackendStatus(job.status),
          })),
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
          {/* Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    แก้ไขล่าสุด
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
                {schedules.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} />
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
