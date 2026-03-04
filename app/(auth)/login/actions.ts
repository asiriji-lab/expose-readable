'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'

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

    let loginEmail = usernameOrEmail;

    // 1. Secure Server-Side Lookup (Hides other users' emails from the public)
    if (!usernameOrEmail.includes('@')) {
        const adminSupabase = await createAdminClient();
        const { data: profile, error } = await adminSupabase
            .from('profiles')
            .select('email')
            .eq('username', usernameOrEmail)
            .single();

        if (error || !profile?.email) {
            return { error: 'Invalid username' };
        }

        loginEmail = profile.email;
    }

    // 2. Log them in using cookies, so Next.js middleware and secure pages work
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    let role: 'admin' | 'teacher' | 'student' | null = null;

    if (data.user?.id) {
        const adminSupabase = await createAdminClient();
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        role = normalizeRole(profile?.role);
    }

    return { success: true, role };
}

export async function detectRoleAction(usernameOrEmail: string) {
    if (!usernameOrEmail) return { role: null };

    const isEmail = usernameOrEmail.includes('@');

    // Use admin client to ensure we can look up roles regardless of RLS safely on the server
    const adminSupabase = await createAdminClient();
    const query = adminSupabase.from('profiles').select('role');

    if (isEmail) {
        query.eq('email', usernameOrEmail);
    } else {
        query.eq('username', usernameOrEmail);
    }

    const { data, error } = await query.single();

    if (error || !data) {
        return { role: null };
    }

    return { role: normalizeRole(data.role) };
}
