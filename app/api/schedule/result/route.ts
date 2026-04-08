import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULE } from '@/lib/api/backend';

/**
 * GET /api/schedule/result?job_id=XXX
 *
 * Proxy to GET {BACKEND}/api/v1/schedule/{job_id}/result
 * Returns the full schedule JSON for a completed job.
 */
export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get('job_id');

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_SCHEDULE}/${job_id}/result`);
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Backend error' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[/api/schedule/result]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
