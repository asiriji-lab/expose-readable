"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Shield, BookOpen, GraduationCap } from 'lucide-react'; // icons
import { loginWithUsernameOrEmail, detectRoleAction } from '../actions';
import { useRouter } from 'next/navigation';

const Box: React.FC = () => {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const detectRole = async () => {
    if (!username) {
      setAccountExists(null);
      setSelectedRole(null);
      return;
    }
    try {
      const { role } = await detectRoleAction(username);
      if (role) {
        setSelectedRole(role);
        setAccountExists(true);
      } else {
        setSelectedRole(null);
        setAccountExists(false);
      }
    } catch (err) {
      console.error('Error detecting role:', err);
      setSelectedRole(null);
      setAccountExists(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('usernameOrEmail', username);
      formData.append('password', password);

      const result = await loginWithUsernameOrEmail(formData);

      if (result.error) {
        if (result.error.toLowerCase().includes('email not confirmed')) {
          router.push(`/verify-otp?email=${encodeURIComponent(username)}`);
          return;
        }
        throw new Error(result.error);
      }

      router.push('/dashboard');
    } catch (error: any) {
      alert(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-[450px] min-h-[600px]">
      <form onSubmit={handleLogin}>
        {/* Title */}
        <h1 className="text-2xl font-bold text-center mb-2">Welcome to ScheDool</h1>
        <p className="text-gray-500 text-center mb-6">Select your role to access the platform</p>

        {/* Role selection (Now read-only or highlighted based on username) */}
        <div className="mb-6">
          <p className="mb-3 font-medium">Your detected role:</p>
          <div className="grid grid-cols-3 gap-3">
            {/* Admin */}
            <div className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${selectedRole === 'admin' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 opacity-50'
              }`}>
              <Shield className="w-7 h-7 mb-2" />
              <div className="font-semibold text-sm">Admin</div>
            </div>

            {/* Teacher */}
            <div className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${selectedRole === 'teacher' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 opacity-50'
              }`}>
              <BookOpen className="w-8 h-8 mb-2" />
              <div className="font-semibold text-sm">Teacher</div>
            </div>

            {/* Student */}
            <div className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${selectedRole === 'student' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 opacity-50'
              }`}>
              <GraduationCap className="w-8 h-8 mb-2" />
              <div className="font-semibold text-sm">Student</div>
            </div>
          </div>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className="block mb-2 font-medium">Username (Email)</label>
          <input
            type="text"
            required
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={detectRole}
            onKeyDown={(e) => e.key === 'Enter' && detectRole()}
            className={`w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${accountExists === false ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-indigo-500'}`}
          />
          {accountExists === false && (
            <p className="text-red-500 text-sm mt-1">Account not found. Please check your username/email.</p>
          )}
        </div>

        {/* Password section */}
        <div className="mb-6">
          <label className="block mb-2 font-medium">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              disabled={accountExists === false}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-3 border-2 rounded-lg focus:outline-none pr-12 focus:ring-2 focus:ring-indigo-500 ${accountExists === false ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 focus:border-indigo-500'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Enter button */}
        <button
          type="submit"
          disabled={loading || accountExists === false}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Entering...' : 'Enter Platform →'}
        </button>

        <div className="mt-4 flex justify-center">
          <Link
            href="/register"
            className="text-gray-400 text-sm cursor-pointer hover:text-gray-600"
          >
            Don't have an account? Register
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Box;
