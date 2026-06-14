'use server'

import { clearAuthCookies } from '@/utils/auth/server'

export async function signOutAction() {
    await clearAuthCookies()
    // No redirect here — AdminHeader calls useClerk().signOut() which redirects
}
