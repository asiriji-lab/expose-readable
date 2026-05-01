import { NextResponse } from 'next/server';
import { getAuthUser, getAuthToken } from '@/utils/auth/server';
import { BACKEND_BASE, BACKEND_JOBS } from '@/lib/api/backend';

/**
 * GET /api/schedule/jobs
 *
 * Returns scheduling jobs.  When a user session is present and the DB is
 * configured, filters by the matching backend user so each user only sees
 * their own jobs.  Falls back to the full job-manager list otherwise.
 */
export async function GET() {
  // Attempt to identify the logged-in user.
  let backendUserId: string | null = null;
  let isAuthenticated = false;
  let authToken: string | null = null;

  try {
    authToken = await getAuthToken();
    const authUser = await getAuthUser();

    if (authUser?.email) {
      isAuthenticated = true;
      const name = [authUser.first_name, authUser.last_name].filter(Boolean).join(' ')
                || authUser.username || '';
      // Look up (or create) the backend user so we have their UUID.
      const syncRes = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: authUser.email, name }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        backendUserId = syncData.user?.user_id ?? null;
      }
    }
  } catch {
    // Auth or sync failure handled below.
  }

  try {
    if (backendUserId) {
      // Authenticated user with resolved backend ID — always filter by user.
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const dbRes = await fetch(
        `${BACKEND_BASE}/api/v1/schedules?user_id=${encodeURIComponent(backendUserId)}`,
        { headers },
      );
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        // schedules endpoint uses "schedule_id" key — normalise to "job_id"
        const jobs = (dbData.schedules ?? []).map((s: Record<string, unknown>) => ({
          job_id:     s.schedule_id,
          job_name:   s.job_name,
          status:     s.status,
          progress:   s.progress,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }));
        return NextResponse.json({ success: true, count: jobs.length, jobs });
      }
      // DB unavailable — return empty rather than leaking other users' jobs.
      return NextResponse.json({ success: true, count: 0, jobs: [] });
    }

    // Authenticated but user sync failed — return empty to avoid data leak.
    if (isAuthenticated) {
      return NextResponse.json({ success: true, count: 0, jobs: [] });
    }

    // No session at all — fall back to unfiltered job-manager list (dev / no-auth mode).
    const upstream = await fetch(BACKEND_JOBS);
    const data = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error ?? 'Scheduler error' },
        { status: upstream.status },
      );
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('[/api/schedule/jobs]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
