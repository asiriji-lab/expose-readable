// OTP verification was used with Supabase Auth — replaced by Clerk Google OAuth.

import { redirect } from 'next/navigation';

export default function VerifyOtpPage() {
    redirect('/login');
}
