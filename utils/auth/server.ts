import { cookies } from 'next/headers'

export interface AuthUser {
    user_id: string
    role: 'school_admin' | 'teacher' | 'student'
    username: string
    email: string
    first_name: string
    last_name: string
}

export async function getAuthToken(): Promise<string | null> {
    const cookieStore = await cookies()
    return cookieStore.get('auth-token')?.value ?? null
}

export async function getAuthUser(): Promise<AuthUser | null> {
    const cookieStore = await cookies()
    const userCookie = cookieStore.get('auth-user')?.value
    if (!userCookie) return null
    try {
        return JSON.parse(userCookie) as AuthUser
    } catch {
        return null
    }
}

export async function setAuthCookies(token: string, user: AuthUser) {
    const cookieStore = await cookies()
    const maxAge = 60 * 60 * 24 // 24 hours
    const isProduction = process.env.NODE_ENV === 'production'

    cookieStore.set('auth-token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge,
    })

    cookieStore.set('auth-user', JSON.stringify(user), {
        httpOnly: false, // Readable by client components via document.cookie
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge,
    })
}

export async function clearAuthCookies() {
    const cookieStore = await cookies()
    cookieStore.delete('auth-token')
    cookieStore.delete('auth-user')
}
