'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { completeProfileAction } from './actions';

function CompleteProfileForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [firstName, setFirstName] = useState(searchParams.get('first_name') ?? '');
    const [lastName,  setLastName]  = useState(searchParams.get('last_name')  ?? '');
    const [username,  setUsername]  = useState('');
    const [adminKey,  setAdminKey]  = useState('');
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('username',   username);
        formData.append('first_name', firstName);
        formData.append('last_name',  lastName);
        formData.append('admin_key',  adminKey);

        const result = await completeProfileAction(formData);

        if (result.error) {
            setError(result.error);
            setLoading(false);
            return;
        }

        router.replace('/dashboard');
    };

    return (
        <div className="bg-surface rounded-2xl shadow-xl p-8 w-full max-w-[450px]">
            <h1 className="text-2xl font-bold text-center mb-2">Complete Your Profile</h1>
            <p className="text-foreground-muted text-center text-sm mb-6">
                Enter your details to finish setting up your admin account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">First Name</label>
                        <input
                            type="text"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Last Name</label>
                        <input
                            type="text"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                        type="text"
                        required
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Organization Key</label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. ABC1234"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary tracking-widest font-mono uppercase"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </div>

                {error && (
                    <p className="text-sm text-danger">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Setting up account...' : 'Complete Registration →'}
                </button>
            </form>
        </div>
    );
}

export default function CompleteProfilePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <Suspense fallback={<p className="text-foreground-muted text-sm">Loading...</p>}>
                <CompleteProfileForm />
            </Suspense>
        </div>
    );
}
