"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, Shield, BookOpen, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const Box: React.FC = () => {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val.length > 0 && val.length < 8) {
      setPasswordError('Password must be at least 8 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // 1. Validation for Admin Role
      if (selectedRole === 'admin') {
        const secretAdminKey = process.env.NEXT_PUBLIC_ADMIN_REGISTRATION_KEY;
        if (adminKey !== secretAdminKey) {
          throw new Error('Invalid Admin Key');
        }
      }

      // 2. Sign up user in Supabase Auth with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role: selectedRole,
            first_name: name,
            last_name: surname,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        alert('Registration successful! Please check your email for confirmation.');
        router.push('/login');
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-[450px]">
      <form onSubmit={handleRegister}>
        {/* Owl Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/path-to-your-owl-logo.svg"
            alt="ScheDool Owl"
            className="w-20 h-20"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center mb-2">Welcome to ScheDool</h1>
        <p className="text-gray-500 text-center text-sm mb-6">
          Select your role to access the platform
        </p>

        {/* Role Selection */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Admin Card */}
          <button
            type="button"
            onClick={() => setSelectedRole('admin')}
            className={`p-4 rounded-xl border-2 transition-all ${selectedRole === 'admin'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${selectedRole === 'admin' ? 'bg-indigo-500' : 'bg-gray-100'
              }`}>
              <Shield className={selectedRole === 'admin' ? 'text-white' : 'text-gray-600'} size={20} />
            </div>
            <p className={`text-sm font-medium ${selectedRole === 'admin' ? 'text-indigo-600' : 'text-gray-700'
              }`}>
              Admin
            </p>
          </button>

          {/* Teacher Card */}
          <button
            type="button"
            onClick={() => setSelectedRole('teacher')}
            className={`p-4 rounded-xl border-2 transition-all ${selectedRole === 'teacher'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${selectedRole === 'teacher' ? 'bg-indigo-500' : 'bg-gray-100'
              }`}>
              <BookOpen className={selectedRole === 'teacher' ? 'text-white' : 'text-gray-600'} size={20} />
            </div>
            <p className={`text-sm font-medium ${selectedRole === 'teacher' ? 'text-indigo-600' : 'text-gray-700'
              }`}>
              Teacher
            </p>
          </button>

          {/* Student Card */}
          <button
            type="button"
            onClick={() => setSelectedRole('student')}
            className={`p-4 rounded-xl border-2 transition-all ${selectedRole === 'student'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${selectedRole === 'student' ? 'bg-indigo-500' : 'bg-gray-100'
              }`}>
              <GraduationCap className={selectedRole === 'student' ? 'text-white' : 'text-gray-600'} size={20} />
            </div>
            <p className={`text-sm font-medium ${selectedRole === 'student' ? 'text-indigo-600' : 'text-gray-700'
              }`}>
              Student
            </p>
          </button>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
          <input
            type="text"
            required
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Password & Admin Key */}
        {selectedRole === 'admin' ? (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className={`w-full px-4 py-3 pr-10 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm ${passwordError ? 'border-red-500' : 'border-gray-300'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-500 text-xs mt-1">{passwordError}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin's key</label>
              <div className="relative">
                <input
                  type={showAdminKey ? 'text' : 'password'}
                  required
                  placeholder="Enter key"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminKey(!showAdminKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAdminKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className={`w-full px-4 py-3 pr-10 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm ${passwordError ? 'border-red-500' : 'border-gray-300'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-500 text-xs mt-1">{passwordError}</p>
            )}
          </div>
        )}

        {/* Name & Surname */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              required
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Surname</label>
            <input
              type="text"
              required
              placeholder="Enter surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
          <input
            type="email"
            required
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Enter Platform Button */}
        <button
          type="submit"
          disabled={loading || password.length < 8}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2 mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Registering...' : 'Enter Platform'}
          <span>→</span>
        </button>

        {/* Sign In Link */}
        <p className="text-center text-gray-500 text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Sign In
          </a>
        </p>
      </form>
    </div>
  );
};

export default Box;