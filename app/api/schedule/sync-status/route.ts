import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULE } from '@/lib/api/backend';

/**
 * POST /api/schedule/sync-status?job_id=XXX
 *
 * Syncs the job's filesystem/in-memory status to the backend database.
 * Call this after the frontend detects that a job has completed or failed.
 */
export async function POST(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get('job_id');

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `${BACKEND_SCHEDULE}/${encodeURIComponent(job_id)}/sync-status`,
      { method: 'POST' },
    );
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Sync failed' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[/api/schedule/sync-status]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
