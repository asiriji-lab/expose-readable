'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Map, X, ChevronRight, Layout, GraduationCap, BookOpen, Shield, LogIn } from 'lucide-react';

/**
 * Floating dev-only route navigator.
 * Shows a panel with all app routes grouped by role.
 * Only renders when NODE_ENV === 'development'.
 */

interface RouteEntry {
    path: string;
    label: string;
    icon: React.ReactNode;
}

interface RouteGroup {
    name: string;
    icon: React.ReactNode;
    color: string;
    routes: RouteEntry[];
}

const ROUTE_GROUPS: RouteGroup[] = [
    {
        name: 'Admin',
        icon: <Shield className="w-3.5 h-3.5" />,
        color: 'text-blue-500',
        routes: [
            { path: '/dashboard', label: 'Dashboard', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/dashboard/sem1-2569', label: 'Dashboard / [id]', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/schedule', label: 'Schedule Editor', icon: <Layout className="w-3.5 h-3.5" /> },
        ],
    },
    {
        name: 'Teacher',
        icon: <BookOpen className="w-3.5 h-3.5" />,
        color: 'text-green-500',
        routes: [
            { path: '/teacher/dashboard', label: 'Dashboard', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/teacher/schedule', label: 'Schedule', icon: <Layout className="w-3.5 h-3.5" /> },
        ],
    },
    {
        name: 'Student',
        icon: <GraduationCap className="w-3.5 h-3.5" />,
        color: 'text-purple-500',
        routes: [
            { path: '/student/dashboard', label: 'Dashboard', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/student/schedule', label: 'Schedule', icon: <Layout className="w-3.5 h-3.5" /> },
        ],
    },
    {
        name: 'Auth',
        icon: <LogIn className="w-3.5 h-3.5" />,
        color: 'text-amber-500',
        routes: [
            { path: '/', label: 'Landing', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/login', label: 'Login', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/register', label: 'Register', icon: <Layout className="w-3.5 h-3.5" /> },
            { path: '/verify-otp', label: 'Verify OTP', icon: <Layout className="w-3.5 h-3.5" /> },
        ],
    },
];

export default function DevNavigator() {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Only render in development
    if (process.env.NODE_ENV !== 'development') return null;

    const navigate = (path: string) => {
        router.push(path);
        setIsOpen(false);
    };

    return (
        <>
            {/* Floating trigger button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 z-[9999] w-11 h-11 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-all hover:scale-105 flex items-center justify-center"
                title="Dev Route Navigator"
            >
                {isOpen ? <X className="w-5 h-5" /> : <Map className="w-5 h-5" />}
            </button>

            {/* Panel */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
                    <div className="fixed bottom-18 right-4 z-[9999] w-72 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Map className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-semibold">Dev Navigator</span>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">{pathname}</span>
                        </div>

                        {/* Route groups */}
                        <div className="max-h-[60vh] overflow-auto py-1">
                            {ROUTE_GROUPS.map((group) => (
                                <div key={group.name}>
                                    {/* Group header */}
                                    <div className={`px-4 py-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${group.color}`}>
                                        {group.icon}
                                        {group.name}
                                    </div>

                                    {/* Routes */}
                                    {group.routes.map((route) => {
                                        const isActive = pathname === route.path;
                                        return (
                                            <button
                                                key={route.path}
                                                onClick={() => navigate(route.path)}
                                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                                                    isActive
                                                        ? 'bg-blue-600/20 text-blue-300'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                                }`}
                                            >
                                                <ChevronRight className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-600'}`} />
                                                <span className="truncate">{route.label}</span>
                                                <span className="ml-auto text-xs text-slate-600 font-mono truncate max-w-[100px]">{route.path}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500 text-center">
                            dev only · hidden in production
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
