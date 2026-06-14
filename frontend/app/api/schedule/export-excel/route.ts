import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULES } from '@/lib/api/backend';

/**
 * GET /api/schedule/export-excel?schedule_id=XXX
 *
 * Proxy to GET {BACKEND}/api/v1/schedules/{schedule_id}/export-excel
 * Streams the .xlsx file back to the browser.
 */
export async function GET(req: NextRequest) {
  const schedule_id = req.nextUrl.searchParams.get('schedule_id');

  if (!schedule_id) {
    return NextResponse.json({ error: 'Missing schedule_id' }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `${BACKEND_SCHEDULES}/${encodeURIComponent(schedule_id)}/export-excel`,
      { cache: 'no-store' },
    );

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return NextResponse.json(
        { error: data?.error ?? 'Export failed' },
        { status: upstream.status },
      );
    }

    const blob = await upstream.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ??
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          upstream.headers.get('Content-Disposition') ??
          `attachment; filename="schedule_${schedule_id}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    console.error('[/api/schedule/export-excel]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
