import type { SubmitJobResponse, JobDetail, ScheduleResult, JobSummary } from '@/types/api';
import { apiFetch } from '@/lib/apiFetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dev.winscloud.net/api/v1';

export async function submitScheduleJob(params: {
  curriculum: File;
  room: File;
  elective?: File;
  teacher?: File;
  period?: File;
  jobName?: string;
  academicYear?: string;
  semester?: 1 | 2;
  orgId?: string;
  userId?: string;
}): Promise<SubmitJobResponse> {
  const form = new FormData();

  form.append('curriculum', params.curriculum);
  form.append('room', params.room);

  if (params.elective)    form.append('elective', params.elective);
  if (params.teacher)     form.append('teacher', params.teacher);
  if (params.period)      form.append('period', params.period);
  if (params.jobName)     form.append('job_name', params.jobName);
  if (params.academicYear) form.append('academic_year', params.academicYear);
  if (params.semester)    form.append('semester', String(params.semester));
  if (params.orgId)       form.append('org_id', params.orgId);
  if (params.userId)      form.append('user_id', params.userId);

  const res = await fetch(`${API_URL}/schedule`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Failed to submit schedule job');
  }

  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobDetail> {
  return apiFetch<JobDetail>(`${API_URL}/schedule/${jobId}`);
}

export async function getJobResult(jobId: string): Promise<{
  result: ScheduleResult;
  schedule: {
    config: object;
    teachers: unknown[];
    students: unknown[];
    rooms: unknown[];
    unfilled_slots: unknown[];
  };
}> {
  return apiFetch(`${API_URL}/schedule/${jobId}/result`);
}

export async function downloadScheduleZip(jobId: string): Promise<void> {
  const res = await fetch(`${API_URL}/schedule/${jobId}/download`);

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `schedules_${jobId}.zip`;
  a.click();

  URL.revokeObjectURL(url);
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_URL}/schedule/${jobId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Failed to delete job');
  }
}

export async function listJobs(): Promise<JobSummary[]> {
  const res = await fetch(`${API_URL}/jobs`);

  if (!res.ok) throw new Error('Failed to list jobs');

  const data = await res.json();
  return data.jobs;
}
