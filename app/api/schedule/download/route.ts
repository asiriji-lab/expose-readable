import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_JOBS } from '@/lib/api/backend';

/**
 * GET /api/schedule/download?job_id=XXX
 *
 * Proxy to GET {BACKEND_BASE}/api/v1/jobs/{job_id}/download
 * Streams the ZIP archive back to the browser.
 */
export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get('job_id');

  if (!job_id) {
    return NextResponse.json({ error: 'Missing job_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND_JOBS}/${job_id}/download`);

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Download failed' },
        { status: upstream.status },
      );
    }

    const blob = await upstream.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/zip',
        'Content-Disposition':
          upstream.headers.get('Content-Disposition') ??
          `attachment; filename="schedules_${job_id}.zip"`,
      },
    });
  } catch (err: unknown) {
    console.error('[/api/schedule/download]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
