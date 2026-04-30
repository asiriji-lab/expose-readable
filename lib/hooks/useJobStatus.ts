import { useState, useEffect, useRef } from 'react';
import { getJobStatus } from '@/api/schedule';
import type { JobDetail } from '@/types/api';

const TERMINAL_STATES = new Set(['completed', 'failed']);

export function useJobStatus(jobId: string | null, intervalMs = 3000) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    setJob(null);
    setError(null);

    async function poll() {
      try {
        const data = await getJobStatus(jobId!);
        if (!active) return;
        setJob(data);
        if (TERMINAL_STATES.has(data.status)) {
          return;
        }

        // Poll quickly at first to reduce completed->result delay,
        // then back off slightly for long-running jobs.
        const nextInterval = data.progress_details?.generation && data.progress_details.generation > 30
          ? Math.max(intervalMs, 1500)
          : intervalMs;
        timerRef.current = setTimeout(poll, nextInterval);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message);
        // Retry on transient errors rather than hard-failing
        timerRef.current = setTimeout(poll, intervalMs);
      }
    }

    // Delay first poll so backend has time to register the job
    timerRef.current = setTimeout(poll, 1500);

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, intervalMs]);

  return { job, error };
}
