'use client';

import { useState } from 'react';
import { submitScheduleJob, downloadScheduleZip } from '@/api/schedule';
import { useJobStatus } from '@/hooks/useJobStatus';

export default function SchedulePage() {
  const [curriculumFile, setCurriculumFile] = useState<File | null>(null);
  const [roomFile, setRoomFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { job, error: pollError } = useJobStatus(jobId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!curriculumFile || !roomFile) return;

    setSubmitError(null);
    try {
      const res = await submitScheduleJob({
        curriculum: curriculumFile,
        room: roomFile,
        jobName: 'My Timetable',
      });
      setJobId(res.job_id);
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }

  const isRunning = job && !['completed', 'failed'].includes(job.status);
  const isDone = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  return (
    <main style={{ padding: 32, maxWidth: 600 }}>
      <h1 className="text-2xl font-bold mb-4">Generate Timetable API Test</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-gray-50 p-4 border rounded">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Curriculum CSV</span>
          <input
            type="file"
            accept=".csv"
            required
            onChange={e => setCurriculumFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Rooms CSV</span>
          <input
            type="file"
            accept=".csv"
            required
            onChange={e => setRoomFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button 
          type="submit" 
          disabled={!!jobId && !isFailed}
          className="bg-primary text-white p-2 rounded disabled:opacity-50 mt-2"
        >
          Submit Scheduled Job
        </button>
        {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      </form>

      {job && (
        <section style={{ marginTop: 24 }} className="bg-blue-50 p-4 border rounded border-blue-200">
          <p>Status: <strong>{job.status}</strong></p>
          <progress value={job.progress} max={100} style={{ width: '100%' }} />
          <p>{job.progress.toFixed(1)}%</p>

          {job.status === 'running_ga' && job.progress_details && (
            <p>
              Generation {job.progress_details.generation} /{' '}
              {job.progress_details.max_generations}
            </p>
          )}

          {isDone && (
            <button 
              onClick={() => downloadScheduleZip(job.job_id)}
              className="mt-4 bg-green-600 text-white p-2 rounded w-full"
            >
              Download Timetable ZIP
            </button>
          )}

          {isFailed && (
            <p style={{ color: 'red' }} className="mt-4 font-bold">Failed: {job.error}</p>
          )}
        </section>
      )}

      {pollError && <p style={{ color: 'red' }} className="mt-2 text-sm font-semibold">Poll error: {pollError}</p>}
    </main>
  );
}
