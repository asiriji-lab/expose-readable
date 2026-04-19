import { useState, useEffect, useRef } from 'react';
import { getJobStatus } from '@/api/schedule';
import type { JobDetail } from '@/types/api';

const TERMINAL_STATES = new Set(['completed', 'failed']);

export function useJobStatus(jobId: string | null, intervalMs = 3000) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    async function poll() {
      try {
        const data = await getJobStatus(jobId!);
        setJob(data);
        if (TERMINAL_STATES.has(data.status)) {
          clearInterval(timerRef.current!);
        }
      } catch (err) {
        setError((err as Error).message);
        clearInterval(timerRef.current!);
      }
    }

    poll(); // run immediately on mount
    timerRef.current = setInterval(poll, intervalMs);

    return () => clearInterval(timerRef.current!);
  }, [jobId, intervalMs]);

  return { job, error };
}
