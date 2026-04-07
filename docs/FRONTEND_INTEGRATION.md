# Frontend Integration Guide

This guide is for frontend developers who want to integrate with the Schedool backend API using **React** or **Next.js** with TypeScript.

---

## Table of Contents

1. [Base URL & Setup](#1-base-url--setup)
2. [TypeScript Types](#2-typescript-types)
3. [How the Scheduling Workflow Works](#3-how-the-scheduling-workflow-works)
4. [Submitting a Schedule Job](#4-submitting-a-schedule-job)
5. [Polling Job Status](#5-polling-job-status)
6. [Getting the Result](#6-getting-the-result)
7. [Downloading the Output ZIP](#7-downloading-the-output-zip)
8. [Deleting a Job](#8-deleting-a-job)
9. [Listing All Jobs](#9-listing-all-jobs)
10. [Organizations & Users](#10-organizations--users)
11. [Error Handling](#11-error-handling)
12. [Putting It All Together](#12-putting-it-all-together)

---

## 1. Base URL & Setup

The backend runs on:

```
https://dev.winscloud.net/api/v1
```

Set this as an environment variable to make switching between dev and production easy.

**`.env.local` (Next.js) or `.env` (Vite/CRA):**
```env
NEXT_PUBLIC_API_URL=https://dev.winscloud.net/api/v1
```

Then reference it in your code:
```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;
```

> **Note:** CORS is open (`*`) in development, so no extra browser configuration is needed.

---

## 2. TypeScript Types

Paste these types into a shared file (e.g., `types/api.ts`) for use across your app.

```ts
// types/api.ts

export type JobStatus =
  | 'created'
  | 'loading_data'
  | 'running_ga'
  | 'exporting'
  | 'completed'
  | 'failed';

export interface JobSummary {
  job_id: string;
  job_name: string | null;
  status: JobStatus;
  progress: number; // 0–100
  created_at: string;
  updated_at: string;
}

export interface JobDetail extends JobSummary {
  progress_details: {
    generation: number;
    max_generations: number;
    best_fitness: number;
    violations: Record<string, number>;
  } | null;
  error: string | null;
}

export interface ScheduleResult {
  data_stats: {
    curriculum_rows: number;
    rooms_rows: number;
  };
  feasibility: {
    is_feasible: boolean;
    error_count: number;
    warning_count: number;
  };
  ga_result: {
    final_fitness: number;
    generations_run: number;
    solution_found: boolean;
    stopped_early: boolean;
  };
  export_result: {
    teachers: number;
    students: number;
    rooms: number;
  };
}

export interface SubmitJobResponse {
  success: boolean;
  job_id: string;
  job_name: string;
  message: string;
  status_url: string;
  result_url: string;
  download_url: string;
}

export interface ApiError {
  success: false;
  error: string;
}
```

---

## 3. How the Scheduling Workflow Works

The API is **asynchronous**. When you submit a job, the server immediately returns a `job_id` and starts processing in the background. You then **poll** the status endpoint until the job is `completed` or `failed`.

```
[1] POST /api/v1/schedule   → get job_id (status: "created")
        ↓
[2] GET /api/v1/schedule/:job_id  (poll every few seconds)
        ↓ status: "loading_data" → "running_ga" → "exporting"
        ↓ status: "completed"
[3] GET /api/v1/schedule/:job_id/result   → full schedule JSON
[4] GET /api/v1/schedule/:job_id/download → ZIP file of CSVs
[5] DELETE /api/v1/schedule/:job_id       → cleanup (optional)
```

---

## 4. Submitting a Schedule Job

The schedule endpoint accepts **`multipart/form-data`** — use the browser's `FormData` API.

**Required files:**
- `curriculum` — CSV with subject/teacher/class details
- `room` — CSV with available classrooms

**Optional files:** `elective`, `teacher`, `period`, `preplace`, `student`, `scout`

```ts
// api/schedule.ts
import type { SubmitJobResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
    // Do NOT set Content-Type manually — the browser sets it with the correct boundary
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to submit schedule job');
  }

  return res.json();
}
```

**React usage example:**

```tsx
// components/UploadForm.tsx
import { useState } from 'react';
import { submitScheduleJob } from '@/api/schedule';

export default function UploadForm() {
  const [curriculumFile, setCurriculumFile] = useState<File | null>(null);
  const [roomFile, setRoomFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!curriculumFile || !roomFile) return;

    try {
      const result = await submitScheduleJob({
        curriculum: curriculumFile,
        room: roomFile,
        jobName: 'My Timetable',
        academicYear: '2026',
        semester: 1,
      });
      setJobId(result.job_id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        accept=".csv"
        onChange={e => setCurriculumFile(e.target.files?.[0] ?? null)}
      />
      <input
        type="file"
        accept=".csv"
        onChange={e => setRoomFile(e.target.files?.[0] ?? null)}
      />
      <button type="submit">Generate Schedule</button>
      {jobId && <p>Job submitted! ID: {jobId}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

---

## 5. Polling Job Status

After submitting, poll the status endpoint every few seconds to track progress.

```ts
// api/schedule.ts (continued)
import type { JobDetail } from '@/types/api';

export async function getJobStatus(jobId: string): Promise<JobDetail> {
  const res = await fetch(`${API_URL}/schedule/${jobId}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to get job status');
  }

  return res.json().then(data => data); // response shape matches JobDetail directly
}
```

**React hook for polling:**

```ts
// hooks/useJobStatus.ts
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
```

**Usage in a component:**

```tsx
// components/JobProgress.tsx
import { useJobStatus } from '@/hooks/useJobStatus';

export default function JobProgress({ jobId }: { jobId: string }) {
  const { job, error } = useJobStatus(jobId);

  if (error) return <p>Error: {error}</p>;
  if (!job) return <p>Loading...</p>;

  return (
    <div>
      <p>Status: {job.status}</p>
      <progress value={job.progress} max={100} />
      <p>{job.progress.toFixed(1)}%</p>
      {job.status === 'running_ga' && job.progress_details && (
        <p>
          Generation {job.progress_details.generation} /
          {job.progress_details.max_generations}
        </p>
      )}
      {job.status === 'failed' && <p style={{ color: 'red' }}>{job.error}</p>}
    </div>
  );
}
```

---

## 6. Getting the Result

Once `status === 'completed'`, fetch the full schedule JSON.

```ts
// api/schedule.ts (continued)
import type { ScheduleResult } from '@/types/api';

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
  const res = await fetch(`${API_URL}/schedule/${jobId}/result`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to get result');
  }

  return res.json();
}
```

**Usage:**

```tsx
import { useEffect, useState } from 'react';
import { getJobResult } from '@/api/schedule';

function ScheduleResult({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getJobResult>> | null>(null);

  useEffect(() => {
    getJobResult(jobId).then(setResult);
  }, [jobId]);

  if (!result) return <p>Loading result...</p>;

  const { feasibility, ga_result } = result.result;

  return (
    <div>
      <p>Feasible: {feasibility.is_feasible ? 'Yes' : 'No'}</p>
      <p>Generations run: {ga_result.generations_run}</p>
      <p>Teachers scheduled: {result.schedule.teachers.length}</p>
    </div>
  );
}
```

---

## 7. Downloading the Output ZIP

The download endpoint returns a binary ZIP file containing per-teacher, per-student, and per-room CSV timetables.

```ts
// api/schedule.ts (continued)

export async function downloadScheduleZip(jobId: string): Promise<void> {
  const res = await fetch(`${API_URL}/schedule/${jobId}/download`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Download failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `schedules_${jobId}.zip`;
  a.click();

  URL.revokeObjectURL(url);
}
```

**Usage:**

```tsx
<button onClick={() => downloadScheduleZip(jobId)}>
  Download ZIP
</button>
```

---

## 8. Deleting a Job

Clean up a job when you no longer need it.

```ts
// api/schedule.ts (continued)

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_URL}/schedule/${jobId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to delete job');
  }
}
```

---

## 9. Listing All Jobs

```ts
// api/schedule.ts (continued)
import type { JobSummary } from '@/types/api';

export async function listJobs(): Promise<JobSummary[]> {
  const res = await fetch(`${API_URL}/jobs`);

  if (!res.ok) throw new Error('Failed to list jobs');

  const data = await res.json();
  return data.jobs;
}
```

**Usage:**

```tsx
import { useEffect, useState } from 'react';
import { listJobs } from '@/api/schedule';
import type { JobSummary } from '@/types/api';

function JobList() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  useEffect(() => {
    listJobs().then(setJobs);
  }, []);

  return (
    <ul>
      {jobs.map(job => (
        <li key={job.job_id}>
          {job.job_name ?? job.job_id} — {job.status} ({job.progress.toFixed(0)}%)
        </li>
      ))}
    </ul>
  );
}
```

---

## 10. Organizations & Users

These endpoints require the backend to have a PostgreSQL database configured. They will return `400` with an error message if the database is unavailable.

```ts
// api/orgs.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- Organizations ---

export async function createOrganization(name: string) {
  const res = await fetch(`${API_URL}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to create organization');
  }

  return res.json().then(d => d.organization);
}

export async function listOrganizations() {
  const res = await fetch(`${API_URL}/organizations`);
  if (!res.ok) throw new Error('Failed to list organizations');
  return res.json().then(d => d.organizations);
}

export async function getOrganization(orgId: string) {
  const res = await fetch(`${API_URL}/organizations/${orgId}`);
  if (!res.ok) throw new Error('Organization not found');
  return res.json().then(d => d.organization);
}

// --- Users ---

export async function createUser(params: {
  email: string;
  name?: string;
  orgId?: string;
}) {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      name: params.name,
      org_id: params.orgId,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Failed to create user');
  }

  return res.json().then(d => d.user);
}

export async function listUsers(orgId?: string) {
  const url = new URL(`${API_URL}/users`);
  if (orgId) url.searchParams.set('org_id', orgId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to list users');
  return res.json().then(d => d.users);
}

export async function getUser(userId: string) {
  const res = await fetch(`${API_URL}/users/${userId}`);
  if (!res.ok) throw new Error('User not found');
  return res.json().then(d => d.user);
}
```

---

## 11. Error Handling

All API errors return this shape:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

**Common HTTP status codes:**

| Code | Meaning |
|------|---------|
| `400` | Bad request — missing field, invalid CSV, or wrong job state |
| `404` | Resource not found (job, org, or user ID is wrong) |
| `409` | Conflict — duplicate org name or email |
| `413` | File too large (max 16 MB per file) |
| `500` | Internal server error |

A reusable fetch wrapper to centralise error handling:

```ts
// lib/apiFetch.ts

export async function apiFetch<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    // Try to parse a structured error, fall back to status text
    const body = await res.json().catch(() => null);
    const message = body?.error ?? `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
```

---

## 12. Putting It All Together

Here is a minimal but complete Next.js page that handles the full scheduling workflow: upload → poll → download.

```tsx
// app/schedule/page.tsx  (Next.js App Router)
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
      <h1>Generate Timetable</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Curriculum CSV
          <input
            type="file"
            accept=".csv"
            required
            onChange={e => setCurriculumFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Rooms CSV
          <input
            type="file"
            accept=".csv"
            required
            onChange={e => setRoomFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={!!jobId && !isFailed}>
          Submit
        </button>
        {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      </form>

      {job && (
        <section style={{ marginTop: 24 }}>
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
            <button onClick={() => downloadScheduleZip(job.job_id)}>
              Download Timetable ZIP
            </button>
          )}

          {isFailed && (
            <p style={{ color: 'red' }}>Failed: {job.error}</p>
          )}
        </section>
      )}

      {pollError && <p style={{ color: 'red' }}>Poll error: {pollError}</p>}
    </main>
  );
}
```

---

## Quick Reference

| Action | Method | Path |
|--------|--------|------|
| Submit a job | `POST` | `/api/v1/schedule` |
| Get job status | `GET` | `/api/v1/schedule/:job_id` |
| Get result JSON | `GET` | `/api/v1/schedule/:job_id/result` |
| Download ZIP | `GET` | `/api/v1/schedule/:job_id/download` |
| Delete a job | `DELETE` | `/api/v1/schedule/:job_id` |
| List all jobs | `GET` | `/api/v1/jobs` |
| Create org | `POST` | `/api/v1/organizations` |
| List orgs | `GET` | `/api/v1/organizations` |
| Get org | `GET` | `/api/v1/organizations/:org_id` |
| Create user | `POST` | `/api/v1/users` |
| List users | `GET` | `/api/v1/users` |
| Get user | `GET` | `/api/v1/users/:user_id` |
| Health check | `GET` | `/health` |
| Swagger UI | — | `/apidocs` |

> **Tip:** The interactive Swagger UI at `https://dev.winscloud.net/apidocs` lets you test every endpoint directly in the browser without writing any code.
