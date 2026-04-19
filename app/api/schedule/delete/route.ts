import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULES } from '@/lib/api/backend';

/**
 * DELETE /api/schedule/delete?job_id=XXX
 *
 * Proxy to DELETE {BACKEND}/api/v1/schedules/{job_id}
 * Deletes from both the DB schedules table and the file-system job folder.
 */
export async function DELETE(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get('job_id');

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_SCHEDULES}/${job_id}`, { method: 'DELETE' });
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Delete failed' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[/api/schedule/delete]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
