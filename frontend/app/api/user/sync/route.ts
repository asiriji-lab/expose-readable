import { NextResponse } from 'next/server';
import { getAuthToken, getAuthUser } from '@/utils/auth/server';
import { BACKEND_BASE } from '@/lib/api/backend';

/**
 * POST /api/user/sync
 *
 * Ensures the currently authenticated user has a matching record in the
 * backend's users table.  Returns the backend user_id so callers can
 * associate scheduling jobs with this account.
 *
 * Response:
 *   { user_id: string, created: boolean }  — on success
 *   { error: string }                       — when unauthenticated or DB unavailable
 */
export async function POST() {
  const token    = await getAuthToken();
  const authUser = await getAuthUser();

  if (!token || !authUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const email = authUser.email ?? '';
  const name  = [authUser.first_name, authUser.last_name].filter(Boolean).join(' ')
             || authUser.username
             || '';

  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error ?? 'Sync failed' }, { status: res.status });
    }

    return NextResponse.json({
      user_id: data.user?.user_id ?? null,
      created: data.created ?? false,
    });
  } catch (err: unknown) {
    console.error('[/api/user/sync]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
