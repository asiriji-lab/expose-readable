'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  created_by_me?: boolean;
}

function mapBackendStatus(status: BackendStatus): Session['status'] {
  switch (status) {
    case 'completed': return 'completed';
    case 'failed':    return 'failed';
    case 'created':   return 'awaiting_data';
    default:          return 'generating';
  }
}

function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${date} ${time}`;
  } catch {
    return isoString;
  }
}

function jobsToSessions(jobs: BackendJob[]): Session[] {
  return jobs.map((job) => ({
    id:           job.job_id,
    name:         job.job_name || job.job_id,
    semester:     '',
    lastEdited:   formatDateTime(job.updated_at),
    updatedAt:    job.updated_at,
    status:       mapBackendStatus(job.status),
    createdByMe:  job.created_by_me,
  }));
}

type SortOrder = 'desc' | 'asc';
type Tab = 'mine' | 'org';

export default function ScheduleList() {
  const [tab, setTab] = useState<Tab>('mine');

  const [mineSchedules, setMineSchedules]   = useState<Session[]>([]);
  const [orgSchedules, setOrgSchedules]     = useState<Session[]>([]);
  const [mineLoading, setMineLoading]       = useState(true);
  const [mineError, setMineError]           = useState<string | null>(null);
  const [orgError, setOrgError]             = useState<string | null>(null);
  const [hasOrg, setHasOrg]                 = useState<boolean | null>(null);
  const [orgFetched, setOrgFetched]         = useState(false);
  const [sortOrder, setSortOrder]           = useState<SortOrder>('desc');

  // Fetch own schedules on mount.
  useEffect(() => {
    fetch('/api/schedule/jobs', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) { window.location.href = '/login'; return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load schedules');
        setMineSchedules(jobsToSessions(data.jobs ?? []));
      })
      .catch((err: Error) => setMineError(err.message))
      .finally(() => setMineLoading(false));
  }, []);

  // Fetch org schedules when tab switches to 'org' (lazy, once).
  useEffect(() => {
    if (tab !== 'org' || orgFetched) return;
    const controller = new AbortController();
    fetch('/api/schedule/org-jobs', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) { window.location.href = '/login'; return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load org schedules');
        setHasOrg(data.hasOrg ?? false);
        setOrgSchedules(jobsToSessions(data.jobs ?? []));
      })
      .catch((err: Error) => { if (err.name !== 'AbortError') setOrgError(err.message); })
      .finally(() => setOrgFetched(true));
    return () => controller.abort();
  }, [tab, orgFetched]);

  const activeSchedules = tab === 'mine' ? mineSchedules : orgSchedules;
  // org tab is loading when it hasn't been fetched yet (fetch in-flight)
  const loading         = tab === 'mine' ? mineLoading   : !orgFetched;
  const error           = tab === 'mine' ? mineError     : orgError;

  const sortedSchedules = useMemo(() => {
    return [...activeSchedules].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return sortOrder === 'desc' ? tb - ta : ta - tb;
    });
  }, [activeSchedules, sortOrder]);

  const SortIcon = sortOrder === 'desc' ? ChevronDown : ChevronUp;

  return (
    <div className="bg-surface rounded-lg shadow">
      {/* Header + tabs */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">รายการตารางสอน</h3>
        <div className="flex items-center gap-1 bg-background rounded-lg p-1">
          <button
            onClick={() => setTab('mine')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'mine'
                ? 'bg-surface text-foreground font-medium shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            ของฉัน
          </button>
          <button
            onClick={() => setTab('org')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              tab === 'org'
                ? 'bg-surface text-foreground font-medium shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            องค์กร
          </button>
        </div>
      </div>

      {loading ? (
        <ScheduleListSkeleton />
      ) : error ? (
        <div className="px-6 py-8 text-center text-sm text-foreground-muted">
          ไม่สามารถโหลดข้อมูลได้: {error}
        </div>
      ) : tab === 'org' && hasOrg === false ? (
        <div className="px-6 py-8 text-center text-sm text-foreground-muted">
          บัญชีนี้ยังไม่ได้เชื่อมต่อกับองค์กร
        </div>
      ) : activeSchedules.length === 0 ? (
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
                      onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors group"
                    >
                      แก้ไขล่าสุด
                      <SortIcon
                        size={13}
                        className="text-primary group-hover:text-primary transition-colors"
                      />
                    </button>
                  </th>
                  {tab === 'org' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
                      ผู้สร้าง
                    </th>
                  )}
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
                    showOwner={tab === 'org'}
                    onDelete={(id) =>
                      tab === 'mine'
                        ? setMineSchedules(prev => prev.filter(s => s.id !== id))
                        : setOrgSchedules(prev => prev.filter(s => s.id !== id))
                    }
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
