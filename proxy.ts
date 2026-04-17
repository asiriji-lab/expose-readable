import { NextResponse, type NextRequest } from 'next/server'

function normalizeRole(value: unknown): 'admin' | 'teacher' | 'student' | null {
    if (typeof value !== 'string') return null
    const role = value.trim().toLowerCase()
    if (role === 'admin' || role === 'teacher' || role === 'student') {
        return role
    }
    return null
}

export async function proxy(request: NextRequest) {
    const token         = request.cookies.get('auth-token')?.value
    const userCookieRaw = request.cookies.get('auth-user')?.value

    const isAuthenticated = !!token
    let role: 'admin' | 'teacher' | 'student' | null = null

    if (userCookieRaw) {
        try {
            const userData = JSON.parse(userCookieRaw)
            role = normalizeRole(userData.role)
        } catch {
            // malformed cookie — treat as unauthenticated
        }
    }

    const isLoginRoute     = request.nextUrl.pathname.startsWith('/login')
    const isSwitchAccount  = request.nextUrl.searchParams.get('switch') === '1'
    const isDashboardRoute = (
        request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/admin') ||
        request.nextUrl.pathname.startsWith('/teacher') ||
        request.nextUrl.pathname.startsWith('/student')
    )

    if (!isAuthenticated && isDashboardRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (isAuthenticated && isLoginRoute && !isSwitchAccount) {
        const url = request.nextUrl.clone()
        if (role === 'teacher') {
            url.pathname = '/teacher/dashboard'
        } else if (role === 'student') {
            url.pathname = '/student/dashboard'
        } else {
            url.pathname = '/dashboard'
        }
        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
