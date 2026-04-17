'use server';

import { createClient } from '@/utils/supabase/server'

export async function verifyOtpAction(email: string, token: string) {
    if (!email || !token) {
        return { error: 'Email and verification code are required' };
    }

    const supabase = await createClient();

    // Verify the OTP. For signup, the type is usually 'signup' (or 'email' in some configurations).
    // The type depends on how Supabase is configured; 'email' is broadly used for email verification.
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email' // if 'signup' fails, depending on Supabase version, 'email' is the standard type for clicking links / otp checks.
    });

    if (error) {
        // Sometimes Supabase returns an error structure; ensure it is readable.
        return { error: error.message };
    }

    return { success: true, user: data.user };
}
