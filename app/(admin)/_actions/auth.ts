'use server'

import { clearAuthCookies } from '@/utils/auth/server'
import { redirect } from 'next/navigation'

export async function signOutAction() {
    await clearAuthCookies()
    redirect('/login')
}
