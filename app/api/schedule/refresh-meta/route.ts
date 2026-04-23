import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULES } from '@/lib/api/backend';

/**
 * POST /api/schedule/refresh-meta?schedule_id=XXX
 *
 * Pass-through proxy: forwards multipart/form-data (CSV files) to
 * {BACKEND}/api/v1/schedules/{schedule_id}/refresh-meta
 */
export async function POST(req: NextRequest) {
  const schedule_id = req.nextUrl.searchParams.get('schedule_id');

  if (!schedule_id) {
    return NextResponse.json({ error: 'Missing schedule_id' }, { status: 400 });
  }

  try {
    const form = await req.formData();

    const upstream = await fetch(
      `${BACKEND_SCHEDULES}/${encodeURIComponent(schedule_id)}/refresh-meta`,
      { method: 'POST', body: form },
    );
    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Backend error' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[/api/schedule/refresh-meta]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
