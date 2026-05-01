import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_JOBS } from '@/lib/api/backend';

/**
 * POST /api/schedule/submit
 *
 * Pass-through proxy: forwards the incoming multipart/form-data (CSV files +
 * metadata fields) directly to the backend scheduler endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const upstream = await fetch(BACKEND_JOBS, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: result?.error ?? result?.message ?? 'Scheduler error' },
        { status: upstream.status },
      );
    }

    const proxied = {
      ...result,
      download_url: result.job_id
        ? `/api/schedule/download?job_id=${result.job_id}`
        : result.download_url,
    };
    return NextResponse.json(proxied, { status: upstream.status });
  } catch (err: unknown) {
    console.error('[/api/schedule/submit]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
