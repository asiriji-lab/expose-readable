'use client';

import { useEffect, useState } from 'react';
import { FullDataset } from '@/app/(admin)/schedule/_types/schedule.types';
import { transformToFullDataset, emptyDataset, BackendSchedule } from '@/lib/api/transform';

export type ScheduleLoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface LatestSchedule {
  dataset:   FullDataset;
  jobId:     string | null;
  jobName:   string | null;
  loadState: ScheduleLoadState;
  error:     string | null;
}

/**
 * Fetches the most recently completed scheduling job from the backend and
 * returns it as a FullDataset ready for use in the timetable viewer pages.
 *
 * Callers that need a specific job can pass an explicit jobId.
 */
export function useLatestSchedule(jobId?: string | null): LatestSchedule {
  const [dataset,   setDataset]   = useState<FullDataset>(emptyDataset());
  const [resolvedJobId,   setJobId]     = useState<string | null>(null);
  const [jobName,   setJobName]   = useState<string | null>(null);
  const [loadState, setLoadState] = useState<ScheduleLoadState>('idle');
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setError(null);

    const url = jobId
      ? `/api/schedule/result?job_id=${encodeURIComponent(jobId)}`
      : '/api/schedule/latest';

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;

        if (data.error) {
          // "No completed jobs found" is not really an error — just empty.
          setLoadState('empty');
          setError(data.error);
          return;
        }

        const schedule: BackendSchedule | null = data.schedule ?? null;
        if (!schedule) {
          setLoadState('empty');
          return;
        }

        const transformed = transformToFullDataset(schedule);
        setDataset(transformed);
        setJobId(data.job_id ?? jobId ?? null);
        setJobName(data.job_name ?? null);
        setLoadState('loaded');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[useLatestSchedule]', err);
        setLoadState('error');
        setError(String(err?.message ?? err));
      });

    return () => { cancelled = true; };
  }, [jobId]);

  return { dataset, jobId: resolvedJobId, jobName, loadState, error };
}
