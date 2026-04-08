import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BACKEND_BASE } from '@/lib/api/backend';

/**
 * POST /api/user/sync
 *
 * Ensures the currently authenticated Supabase user has a matching record
 * in the backend's users table.  Returns the backend user_id so callers
 * can associate scheduling jobs with this account.
 *
 * Response:
 *   { user_id: string, created: boolean }  — on success
 *   { error: string }                       — when unauthenticated or DB unavailable
 */
export async function POST() {
  // 1. Get the Supabase session from cookies.
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const email = user.email ?? '';
  const name  = user.user_metadata?.full_name
             || user.user_metadata?.name
             || user.user_metadata?.first_name
             || '';

  // 2. Upsert into the backend user table.
  try {
    const res = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, name }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Graceful degradation — DB might not be configured; that's OK.
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
