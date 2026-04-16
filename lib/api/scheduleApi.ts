import type { JobDetail, ScheduleResult, SubmitJobResponse } from '../types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dev.winscloud.net/api/v1';

export async function submitScheduleJob(params: {
  curriculum: File | Blob;
  room: File | Blob;
  elective?: File | Blob;
  teacher?: File | Blob;
  period?: File | Blob;
  preplace?: File | Blob;
  student?: File | Blob;
  scout?: File | Blob;
  jobName?: string;
}): Promise<SubmitJobResponse> {
  const form = new FormData();
  form.append('curriculum', params.curriculum, 'curriculum.csv');
  form.append('room', params.room, 'room.csv');

  if (params.elective) form.append('elective', params.elective, 'elective.csv');
  if (params.teacher) form.append('teacher', params.teacher, 'teacher.csv');
  if (params.period) form.append('period', params.period, 'period.csv');
  if (params.preplace) form.append('preplace', params.preplace, 'preplace.csv');
  if (params.student) form.append('student', params.student, 'student.csv');
  if (params.scout) form.append('scout', params.scout, 'scout.csv');

  if (params.jobName) form.append('job_name', params.jobName);

  const res = await fetch(`${API_URL}/schedule`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to submit schedule job');
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobDetail> {
  const res = await fetch(`${API_URL}/schedule/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get job status');
  }
  return res.json();
}

export async function getJobResult(jobId: string): Promise<{ result: ScheduleResult; schedule: any }> {
  const res = await fetch(`${API_URL}/schedule/${jobId}/result`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to get result');
  }
  return res.json();
}
