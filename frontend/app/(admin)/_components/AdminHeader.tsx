"use client";

import { useState, useEffect, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';
import { signOutAction } from '../_actions/auth';
import { LogOut, CalendarDays, User } from 'lucide-react';

/** Read a non-httpOnly cookie by name from document.cookie */
function getCookieValue(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith(name + '='));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

interface AdminHeaderProps {
    roleLabel?: string;
}

export default function AdminHeader({ roleLabel }: AdminHeaderProps) {
    const { signOut } = useClerk();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [user, setUser] = useState<{
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const raw = getCookieValue('auth-user');
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            setUser({
                firstName: parsed.first_name || '',
                lastName:  parsed.last_name  || '',
                email:     parsed.email      || '',
                role:      parsed.role       || 'school_admin',
            });
        } catch {
            // malformed cookie
        }
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await signOutAction();
        await signOut({ redirectUrl: '/login' });
    };

    const currentRole     = roleLabel || (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin');
    const normalizedRole  = currentRole.toLowerCase();
    const roleBadgeClass  = normalizedRole === 'student'
        ? 'bg-[var(--role-student-bg)] text-[var(--role-student)]'
        : normalizedRole === 'school_admin'
            ? 'bg-[var(--role-admin-bg)] text-[var(--role-admin)]'
            : 'bg-[var(--role-teacher-bg)] text-[var(--role-teacher)]';
    const avatarText = user?.firstName ? user.firstName.charAt(0).toUpperCase() : null;

    return (
        <header className="bg-surface border-b border-border w-full relative z-50">
            <div className="max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between h-10">
                    {/* Left: Logo and School Name */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                            <CalendarDays size={20} className="text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">ScheDool</h1>
                    </div>

                    {/* Right: Role Badge and User Icon */}
                    <div className="flex items-center gap-3 relative" ref={dropdownRef}>
                        <span className={`px-3 py-1.5 rounded-md text-sm font-medium ${roleBadgeClass}`}>
                            {currentRole}
                        </span>

                        {/* Profile Trigger */}
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-9 h-9 bg-border hover:bg-border-strong transition-colors rounded-full flex items-center justify-center font-bold text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {avatarText ? (
                                <span>{avatarText}</span>
                            ) : (
                                <User size={18} className="text-foreground-muted" />
                            )}
                        </button>

                        {/* Profile Dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-12 w-56 bg-surface rounded-xl shadow-xl border border-border overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                                <div className="px-4 py-3 bg-background border-b border-border">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="text-xs text-foreground-muted truncate mt-0.5">
                                        {user?.email}
                                    </p>
                                </div>

                                <div className="p-1">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2.5 text-sm text-danger font-medium hover:bg-danger-light rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
