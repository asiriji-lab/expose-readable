'use server';

import { getClerkUser } from '@/utils/clerk/server';
import { setAuthCookies } from '@/utils/auth/server';
import { BACKEND_BASE } from '@/lib/api/backend';

export async function completeProfileAction(
    formData: FormData
): Promise<{ error?: string; success?: boolean }> {
    const clerkUser = await getClerkUser();
    if (!clerkUser) return { error: 'Not authenticated. Please sign in again.' };

    const username   = (formData.get('username')   as string)?.trim();
    const firstName  = (formData.get('first_name') as string)?.trim() || clerkUser.firstName || '';
    const lastName   = (formData.get('last_name')  as string)?.trim() || clerkUser.lastName  || '';
    const adminKey   = (formData.get('admin_key')  as string)?.trim();

    if (!username) return { error: 'Username is required.' };
    if (!adminKey) return { error: 'Admin key is required.' };

    try {
        const res = await fetch(`${BACKEND_BASE}/api/v1/auth/clerk-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email:      clerkUser.email,
                username,
                first_name: firstName,
                last_name:  lastName,
                admin_key:  adminKey,
                role:       'school_admin',
            }),
        });

        const data = await res.json();
        if (!res.ok) return { error: data.error ?? 'Registration failed.' };

        await setAuthCookies(data.access_token, data.user);
        return { success: true };
    } catch {
        return { error: 'Network error — is the backend running?' };
    }
}
