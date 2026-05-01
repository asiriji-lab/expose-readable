import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_JOBS } from '@/lib/api/backend';

const SCHEDULER_BASE = BACKEND_JOBS;

/**
 * GET /api/schedule/status?job_id=XXX
 *
 * Proxy to GET {BACKEND}/api/v1/jobs/{job_id}
 *
 * Response:
 *   { success, job_id, status, progress, progress_details, error }
 */
export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get('job_id');

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${SCHEDULER_BASE}/${job_id}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.message ?? 'Scheduler error' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[/api/schedule/status]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
