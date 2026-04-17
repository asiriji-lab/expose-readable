'use server'

import { setAuthCookies } from '@/utils/auth/server'
import { BACKEND_BASE } from '@/lib/api/backend'

function normalizeRole(value: unknown): 'admin' | 'teacher' | 'student' | null {
    if (typeof value !== 'string') return null;
    const role = value.trim().toLowerCase();
    if (role === 'admin' || role === 'teacher' || role === 'student') {
        return role;
    }
    return null;
}

export async function loginWithUsernameOrEmail(formData: FormData) {
    const usernameOrEmail = formData.get('usernameOrEmail') as string;
    const password = formData.get('password') as string;

    if (!usernameOrEmail || !password) {
        return { error: 'Username/Email and Password are required' };
    }

    try {
        const res = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { error: data.error || 'Login failed' };
        }

        const role = normalizeRole(data.user?.role);

        await setAuthCookies(data.access_token, {
            user_id:    data.user?.user_id    ?? '',
            role:       role ?? 'student',
            username:   data.user?.username   ?? '',
            email:      data.user?.email      ?? '',
            first_name: data.user?.first_name ?? '',
            last_name:  data.user?.last_name  ?? '',
        });

        return { success: true, role };
    } catch {
        return { error: 'Network error — is the backend running?' };
    }
}

export async function detectRoleAction(usernameOrEmail: string) {
    if (!usernameOrEmail) return { role: null };

    try {
        const res = await fetch(
            `${BACKEND_BASE}/api/v1/auth/detect-role?q=${encodeURIComponent(usernameOrEmail)}`
        );
        const data = await res.json();
        return { role: normalizeRole(data.role) };
    } catch {
        return { role: null };
    }
}
