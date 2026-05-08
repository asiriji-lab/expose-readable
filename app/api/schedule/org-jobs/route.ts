import { NextResponse } from 'next/server';
import { getAuthUser, getAuthToken } from '@/utils/auth/server';
import { BACKEND_BASE } from '@/lib/api/backend';

/**
 * GET /api/schedule/org-jobs
 *
 * Returns all scheduling jobs belonging to the authenticated user's organization.
 * Each job includes a `createdByMe` flag for the caller to distinguish ownership.
 * Returns 401 if no valid session, 200 with empty array if user has no org.
 */
export async function GET() {
  let authToken: string | null = null;
  let backendUserId: string | null = null;
  let orgId: string | null = null;

  try {
    authToken = await getAuthToken();
    const authUser = await getAuthUser();

    if (!authUser?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const name =
      [authUser.first_name, authUser.last_name].filter(Boolean).join(' ') ||
      authUser.username ||
      '';

    const syncRes = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authUser.email, name }),
    });

    if (syncRes.ok) {
      const syncData = await syncRes.json();
      backendUserId = syncData.user?.user_id ?? null;
      orgId = syncData.user?.org_id ?? null;
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!backendUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No org — return empty (user is not in any organization yet).
  if (!orgId) {
    return NextResponse.json({ success: true, count: 0, jobs: [], hasOrg: false });
  }

  try {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(
      `${BACKEND_BASE}/api/v1/organizations/${encodeURIComponent(orgId)}/schedules`,
      { headers },
    );

    if (!res.ok) {
      return NextResponse.json({ success: true, count: 0, jobs: [], hasOrg: true });
    }

    const data = await res.json();
    const jobs = (data.schedules ?? []).map((s: Record<string, unknown>) => ({
      job_id:        s.schedule_id,
      job_name:      s.job_name,
      status:        s.status,
      progress:      s.progress,
      created_at:    s.created_at,
      updated_at:    s.updated_at,
      created_by_me: s.user_id === backendUserId,
    }));

    return NextResponse.json({ success: true, count: jobs.length, jobs, hasOrg: true });
  } catch (err: unknown) {
    console.error('[/api/schedule/org-jobs]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
