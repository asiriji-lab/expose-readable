import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_SCHEDULES } from '@/lib/api/backend';

/**
 * GET /api/schedule/record?schedule_id=XXX
 * PUT /api/schedule/record?schedule_id=XXX
 *
 * Proxy to {BACKEND}/api/v1/schedules/{schedule_id}
 */

async function proxyScheduleRecord(req: NextRequest, method: 'GET' | 'PUT') {
  const schedule_id = req.nextUrl.searchParams.get('schedule_id');

  if (!schedule_id) {
    return NextResponse.json({ error: 'Missing schedule_id' }, { status: 400 });
  }

  try {
    const upstreamInit: RequestInit = { method, cache: 'no-store' };
    if (method === 'PUT') {
      const body = await req.json();
      upstreamInit.body = JSON.stringify(body);
      upstreamInit.headers = { 'Content-Type': 'application/json' };
    }

    const upstream = await fetch(
      `${BACKEND_SCHEDULES}/${encodeURIComponent(schedule_id)}`,
      upstreamInit,
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
    console.error(`[/api/schedule/record ${method}]`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxyScheduleRecord(req, 'GET');
}

export async function PUT(req: NextRequest) {
  return proxyScheduleRecord(req, 'PUT');
}
