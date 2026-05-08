import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, getAuthUser, setAuthCookies, type AuthUser } from '@/utils/auth/server';
import { BACKEND_BASE } from '@/lib/api/backend';

/**
 * POST /api/user/join-org
 *
 * Assigns the authenticated user to an organization and refreshes their JWT.
 * The new token carries the updated org_id claim, so subsequent schedule
 * submissions are correctly scoped to the org without requiring re-login.
 *
 * Body: { org_id: string }
 *
 * Response: { success: true, user: AuthUser }
 */
export async function POST(req: NextRequest) {
  try {
    const authToken = await getAuthToken();
    const authUser  = await getAuthUser();

    if (!authToken || !authUser?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body   = await req.json().catch(() => ({}));
    const org_id = (body?.org_id ?? '').trim();
    if (!org_id) {
      return NextResponse.json({ error: "'org_id' is required" }, { status: 400 });
    }

    // Resolve backend user_id via sync (idempotent upsert).
    const name = [authUser.first_name, authUser.last_name].filter(Boolean).join(' ')
              || authUser.username || '';
    const syncRes = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: authUser.email, name }),
    });
    if (!syncRes.ok) {
      return NextResponse.json({ error: 'Failed to resolve user' }, { status: 502 });
    }
    const syncData    = await syncRes.json();
    const backendUserId: string | null = syncData.user?.user_id ?? null;
    if (!backendUserId) {
      return NextResponse.json({ error: 'Failed to resolve user' }, { status: 502 });
    }

    // Assign org + get fresh JWT from backend.
    const joinRes = await fetch(
      `${BACKEND_BASE}/api/v1/users/${encodeURIComponent(backendUserId)}/org`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ org_id }),
      },
    );
    const joinData = await joinRes.json();
    if (!joinRes.ok) {
      return NextResponse.json(
        { error: joinData?.error ?? 'Failed to join organization' },
        { status: joinRes.status },
      );
    }

    const newToken: string     = joinData.access_token;
    const updatedUser          = joinData.user;
    const role = (updatedUser?.role ?? authUser.role) as AuthUser['role'];

    // Persist fresh JWT + updated user into cookies so the session is
    // immediately valid for org-scoped schedule submissions.
    await setAuthCookies(newToken, {
      user_id:    updatedUser?.user_id    ?? authUser.user_id,
      role,
      username:   updatedUser?.username   ?? authUser.username,
      email:      updatedUser?.email      ?? authUser.email,
      first_name: updatedUser?.first_name ?? authUser.first_name,
      last_name:  updatedUser?.last_name  ?? authUser.last_name,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    console.error('[/api/user/join-org]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
