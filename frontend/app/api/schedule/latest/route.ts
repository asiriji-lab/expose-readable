import { NextResponse } from 'next/server';
import { BACKEND_BASE, BACKEND_JOBS } from '@/lib/api/backend';

/**
 * GET /api/schedule/latest
 *
 * Returns the most recently completed job together with its full schedule JSON.
 * Combines GET /api/v1/jobs/latest → GET /api/v1/jobs/{job_id}/result.
 *
 * Response:
 *   { job_id, job_name, schedule: BackendSchedule }
 */
export async function GET() {
  try {
    // Step 1 — find the latest completed job.
    const latestRes = await fetch(`${BACKEND_BASE}/api/v1/jobs/latest`);
    const latestData = await latestRes.json();

    if (!latestRes.ok) {
      return NextResponse.json(
        { error: latestData?.error ?? 'No completed jobs' },
        { status: latestRes.status },
      );
    }

    const job_id   = latestData.job?.job_id;
    const job_name = latestData.job?.job_name;

    if (!job_id) {
      return NextResponse.json({ error: 'No job_id in response' }, { status: 500 });
    }

    // Step 2 — fetch the full result.
    const resultRes = await fetch(`${BACKEND_JOBS}/${job_id}/result`);
    const resultData = await resultRes.json();

    if (!resultRes.ok) {
      return NextResponse.json(
        { error: resultData?.error ?? 'Could not fetch result' },
        { status: resultRes.status },
      );
    }

    return NextResponse.json({
      job_id,
      job_name,
      schedule: resultData.schedule ?? null,
    });
  } catch (err: unknown) {
    console.error('[/api/schedule/latest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
