import { useState, useEffect, useRef } from 'react';
import { getJobStatus } from '@/api/schedule';
import { HttpError } from '@/lib/apiFetch';
import type { JobDetail } from '@/types/api';

const TERMINAL_STATES = new Set(['completed', 'failed']);
const MAX_TRANSIENT_ERRORS = 3;

export function useJobStatus(jobId: string | null, intervalMs = 3000) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    setJob(null);
    setError(null);
    errorCountRef.current = 0;

    async function poll() {
      try {
        const data = await getJobStatus(jobId!);
        if (!active) return;
        errorCountRef.current = 0;
        setError(null);
        setJob(data);
        if (TERMINAL_STATES.has(data.status)) return;

        // Poll quickly at first to reduce completed->result delay,
        // then back off slightly for long-running jobs.
        const nextInterval =
          data.progress_details?.generation && data.progress_details.generation > 30
            ? Math.max(intervalMs, 1500)
            : intervalMs;
        timerRef.current = setTimeout(poll, nextInterval);
      } catch (err) {
        if (!active) return;
        const status = err instanceof HttpError ? err.status : 0;
        const message = (err as Error).message;

        // 4xx = permanent (wrong job_id, auth failure) — stop immediately
        if (status >= 400 && status < 500) {
          setError(message);
          return;
        }

        // 5xx / network = transient — retry up to MAX_TRANSIENT_ERRORS
        errorCountRef.current += 1;
        if (errorCountRef.current >= MAX_TRANSIENT_ERRORS) {
          setError(message);
          return;
        }
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
