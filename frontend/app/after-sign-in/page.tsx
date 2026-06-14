'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { afterSignInAction } from './actions';

export default function AfterSignInPage() {
    const router = useRouter();

    useEffect(() => {
        afterSignInAction().then(({ redirect }) => {
            router.replace(redirect);
        });
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <p className="text-foreground-muted text-sm">Signing you in...</p>
        </div>
    );
}
