'use server'

import { setAuthCookies } from '@/utils/auth/server'
import { BACKEND_BASE } from '@/lib/api/backend'

function normalizeRole(value: unknown): 'school_admin' | 'teacher' | 'student' | null {
    if (typeof value !== 'string') return null;
    const role = value.trim().toLowerCase();
    if (role === 'school_admin' || role === 'teacher' || role === 'student') {
        return role;
    }
    return null;
}

interface RegisterParams {
    username: string
    password: string
    role: 'school_admin' | 'teacher' | 'student'
    first_name: string
    last_name: string
    email: string
    admin_key: string
}

export async function registerAction(params: RegisterParams) {
    const { username, password, role, first_name, last_name, email, admin_key } = params;

    try {
        const res = await fetch(`${BACKEND_BASE}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, first_name, last_name, email, admin_key }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { error: data.error || 'Registration failed' };
        }

        const resolvedRole = normalizeRole(data.user?.role);

        await setAuthCookies(data.access_token, {
            user_id:    data.user?.user_id    ?? '',
            role:       resolvedRole ?? 'student',
            username:   data.user?.username   ?? '',
            email:      data.user?.email      ?? '',
            first_name: data.user?.first_name ?? '',
            last_name:  data.user?.last_name  ?? '',
        });

        return { success: true, role: resolvedRole };
    } catch {
        return { error: 'Network error — is the backend running?' };
    }
}
