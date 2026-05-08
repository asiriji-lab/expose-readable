'use server';

import { getClerkUser } from '@/utils/clerk/server';
import { setAuthCookies } from '@/utils/auth/server';
import { BACKEND_BASE } from '@/lib/api/backend';

export async function afterSignInAction(): Promise<{ redirect: string }> {
    const clerkUser = await getClerkUser();
    if (!clerkUser) return { redirect: '/login' };

    try {
        const res = await fetch(`${BACKEND_BASE}/api/v1/auth/clerk-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: clerkUser.email }),
        });

        if (res.ok) {
            const data = await res.json();
            await setAuthCookies(data.access_token, data.user);
            const role = data.user?.role;
            return {
                redirect: role === 'teacher'      ? '/teacher/dashboard'
                        : role === 'student'      ? '/student/dashboard'
                        : '/dashboard',
            };
        }

        if (res.status === 404) {
            const params = new URLSearchParams({
                email:      clerkUser.email,
                first_name: clerkUser.firstName ?? '',
                last_name:  clerkUser.lastName  ?? '',
            });
            return { redirect: `/complete-profile?${params}` };
        }
    } catch {
        // Backend unreachable — fall through to login
    }

    return { redirect: '/login' };
}
