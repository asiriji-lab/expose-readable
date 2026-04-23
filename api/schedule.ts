import type { SubmitJobResponse, JobDetail, ScheduleResult, JobSummary } from '@/types/api';
import { apiFetch } from '@/lib/apiFetch';

export async function submitScheduleJob(params: {
  curriculum: File;
  room: File;
  elective?: File;
  teacher?: File;
  period?: File;
  student?: File;
  preplace?: File;
  scout?: File;
  jobName?: string;
  academicYear?: string;
  semester?: 1 | 2;
  orgId?: string;
  userId?: string;
}): Promise<SubmitJobResponse> {
  const form = new FormData();

  // Helper to globally strip UTF-8 BOM and optionally fix student date mangling
  const cleanCsvFile = async (file: File | string | undefined, name: string): Promise<File | undefined> => {
    if (!file || typeof file === 'string') return undefined; // Should only be File
    let text = await file.text();
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    // Globally strip phantom rows (rows with only spaces and commas like `,,,,,`)
    text = text.split(/\r?\n/).filter(line => /[^\s,]/.test(line)).join('\n');

    // Reverse Google Sheet CSV date mangling (e.g. 1-Jan -> 1/1, 1/1/2026 -> 1/1)
    if (name === 'student') {
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse(text, { header: false });
      let rows = parsed.data as string[][];
      rows = rows.map((row, idx) => {
        if (idx === 0 || !row[0]) return row;
        const newRow = [...row];
        let classId = String(newRow[0]);
        if (/^\d+\/\d+\/\d+$/.test(classId)) {
          classId = classId.split('/').slice(0, 2).join('/');
        } else if (/^\d+-[A-Za-z]+(-\d+)?$/.test(classId)) {
          const parts = classId.split('-');
          const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
          const m = months[parts[1].toLowerCase().substring(0, 3)];
          if (m) classId = `${parts[0]}/${m}`;
        }
        newRow[0] = classId;
        return newRow;
      });
      text = Papa.unparse(rows);
    }

    return new File([text], file.name || `${name}.csv`, { type: 'text/csv' });
  };

  const curriculumFile = await cleanCsvFile(params.curriculum, 'curriculum');
  const roomFile = await cleanCsvFile(params.room, 'room');
  if (curriculumFile) form.append('curriculum', curriculumFile);
  if (roomFile) form.append('room', roomFile);

  const electiveFile = await cleanCsvFile(params.elective, 'elective');
  const teacherFile = await cleanCsvFile(params.teacher, 'teacher');
  const periodFile = await cleanCsvFile(params.period, 'period');
  const studentFile = await cleanCsvFile(params.student, 'student');
  const preplaceFile = await cleanCsvFile(params.preplace, 'preplace');
  const scoutFile = await cleanCsvFile(params.scout, 'scout');

  if (electiveFile)    form.append('elective', electiveFile);
  if (teacherFile)     form.append('teacher', teacherFile);
  if (periodFile)      form.append('period', periodFile);
  if (studentFile)     form.append('student', studentFile);
  if (preplaceFile)    form.append('preplace', preplaceFile);
  if (scoutFile)       form.append('scout', scoutFile);

  if (params.jobName)     form.append('job_name', params.jobName);
  if (params.academicYear) form.append('academic_year', params.academicYear);
  if (params.semester)    form.append('semester', String(params.semester));
  if (params.orgId)       form.append('org_id', params.orgId);
  if (params.userId)      form.append('user_id', params.userId);

  const res = await fetch('/api/schedule/submit', {
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
  return apiFetch<JobDetail>(`/api/schedule/status?job_id=${encodeURIComponent(jobId)}`);
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
  return apiFetch(`/api/schedule/result?job_id=${encodeURIComponent(jobId)}`);
}

export async function downloadScheduleZip(jobId: string): Promise<void> {
  const res = await fetch(`/api/schedule/download?job_id=${encodeURIComponent(jobId)}`);

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
  const res = await fetch(`/api/schedule/delete?job_id=${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Failed to delete job');
  }
}

export async function listJobs(): Promise<JobSummary[]> {
  const res = await fetch('/api/schedule/jobs');

  if (!res.ok) throw new Error('Failed to list jobs');

  const data = await res.json();
  return data.jobs;
}
