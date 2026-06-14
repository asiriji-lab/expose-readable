import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// No Clerk session required
const isPublic = createRouteMatcher(['/', '/login(.*)', '/after-sign-in(.*)']);

// Clerk session required, but backend auth-token not yet (mid-registration)
const isClerkOnly = createRouteMatcher(['/complete-profile(.*)']);

export default clerkMiddleware(async (auth, request) => {
    const { pathname } = request.nextUrl;

    if (isPublic(request)) return NextResponse.next();

    const { userId } = await auth();

    // API routes: only check backend auth-token cookie
    if (pathname.startsWith('/api/')) {
        const token = request.cookies.get('auth-token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.next();
    }

    // /complete-profile: Clerk session required, no backend token yet
    if (isClerkOnly(request)) {
        if (!userId) return NextResponse.redirect(new URL('/login', request.url));
        return NextResponse.next();
    }

    // All other pages: need both Clerk session and backend auth-token
    if (!userId) return NextResponse.redirect(new URL('/login', request.url));

    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) return NextResponse.redirect(new URL('/complete-profile', request.url));

    return NextResponse.next();
});

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
