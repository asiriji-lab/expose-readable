import { createServerClient } from '@supabase/ssr'
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
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with cross-site request forgery (CSRF) protection and CORS routing.
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const isLoginRoute = request.nextUrl.pathname.startsWith('/login');
    const isSwitchAccount = request.nextUrl.searchParams.get('switch') === '1';
    const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/teacher') || request.nextUrl.pathname.startsWith('/student');

    if (!user && isDashboardRoute) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (user && isLoginRoute && !isSwitchAccount) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const role = normalizeRole(profile?.role)

        // user is already logged in, redirect them by role
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

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
