"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { signOutAction } from '../_actions/auth';
import { LogOut } from 'lucide-react';

interface AdminHeaderProps {
    roleLabel?: string;
}

export default function AdminHeader({ roleLabel }: AdminHeaderProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [user, setUser] = useState<{ firstName: string; lastName: string; email: string; role: string } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function fetchUser() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    const isInvalidRefreshToken = error.message?.toLowerCase().includes('invalid refresh token');
                    if (isInvalidRefreshToken) {
                        await supabase.auth.signOut({ scope: 'local' });
                    }
                    return;
                }

                if (!session?.user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setUser({
                        firstName: profile.first_name || '',
                        lastName: profile.last_name || '',
                        email: profile.email || session.user.email || '',
                        role: profile.role || 'Admin',
                    });
                }
            } catch {
                return;
            }
        }

        fetchUser();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSignOut = async () => {
        await signOutAction();
    };

    const currentRole = roleLabel || (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin');
    const normalizedRole = currentRole.toLowerCase();
    const roleBadgeClass = normalizedRole === 'student'
        ? 'bg-orange-100 text-orange-700'
        : normalizedRole === 'admin'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-green-100 text-green-700';
    // Use first letter of first name, else a generic icon SVG
    const avatarText = user?.firstName ? user.firstName.charAt(0).toUpperCase() : null;

    return (
        <header className="bg-white border-b border-gray-200 w-full relative z-50">
            <div className="max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between h-10">
                    {/* Left: Logo and School Name */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900">ScheDool</h1>
                        <span className="text-gray-400 text-sm md:text-base hidden sm:inline">Bodindecha School</span>
                    </div>

                    {/* Right: Admin Badge and User Icon */}
                    <div className="flex items-center gap-3 relative" ref={dropdownRef}>
                        <span className={`px-3 py-1.5 rounded-md text-sm font-medium ${roleBadgeClass}`}>
                            {currentRole}
                        </span>

                        {/* Profile Trigger */}
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-9 h-9 bg-gray-200 hover:bg-gray-300 transition-colors rounded-full flex items-center justify-center font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            {avatarText ? (
                                <span>{avatarText}</span>
                            ) : (
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            )}
                        </button>

                        {/* Profile Dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {user?.firstName} {user?.lastName}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {user?.email}
                                    </p>
                                </div>

                                <div className="p-1">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
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
