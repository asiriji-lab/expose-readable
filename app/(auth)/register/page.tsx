// Registration via username/password is replaced by Google OAuth (Clerk).
// New users: sign in with Google → /complete-profile to set username + admin key.

import { redirect } from 'next/navigation';

export default function RegisterPage() {
    redirect('/login');
}
