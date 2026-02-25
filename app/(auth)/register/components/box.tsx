"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, Shield, BookOpen, GraduationCap } from 'lucide-react';

const Box: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-[600
    px] h-[880px]">
      
      {/* Title */}
      <h1 className="text-2xl font-bold text-center mb-2">Welcome to ScheDool</h1>
      <p className="text-gray-500 text-center text-sm mb-6">
        Select your role to access the platform
      </p>
      
      {/* Role Selection */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Admin Card */}
        <button
          onClick={() => setSelectedRole('admin')}
          className={`p-4 rounded-xl border-2 transition-all ${
            selectedRole === 'admin'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
            selectedRole === 'admin' ? 'bg-indigo-500' : 'bg-gray-100'
          }`}>
            <Shield className={selectedRole === 'admin' ? 'text-white' : 'text-gray-600'} size={20} />
          </div>
          <p className={`text-sm font-medium ${
            selectedRole === 'admin' ? 'text-indigo-600' : 'text-gray-700'
          }`}>
            Admin
          </p>
        </button>

        {/* Teacher Card */}
        <button
          onClick={() => setSelectedRole('teacher')}
          className={`p-4 rounded-xl border-2 transition-all ${
            selectedRole === 'teacher'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
            selectedRole === 'teacher' ? 'bg-indigo-500' : 'bg-gray-100'
          }`}>
            <BookOpen className={selectedRole === 'teacher' ? 'text-white' : 'text-gray-600'} size={20} />
          </div>
          <p className={`text-sm font-medium ${
            selectedRole === 'teacher' ? 'text-indigo-600' : 'text-gray-700'
          }`}>
            Teacher
          </p>
        </button>

        {/* Student Card */}
        <button
          onClick={() => setSelectedRole('student')}
          className={`p-4 rounded-xl border-2 transition-all ${
            selectedRole === 'student'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center ${
            selectedRole === 'student' ? 'bg-indigo-500' : 'bg-gray-100'
          }`}>
            <GraduationCap className={selectedRole === 'student' ? 'text-white' : 'text-gray-600'} size={20} />
          </div>
          <p className={`text-sm font-medium ${
            selectedRole === 'student' ? 'text-indigo-600' : 'text-gray-700'
          }`}>
            Student
          </p>
        </button>
      </div>
      
      {/* Username - Always shown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
        <input 
          type="text" 
          placeholder="Enter username"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>
      
      {/* Password & Admin Key - Side by side for Admin */}
      {selectedRole === 'admin' ? (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin's key</label>
            <div className="relative">
              <input 
                type={showAdminKey ? 'text' : 'password'}
                placeholder="Enter key"
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
        /* Password - Full width for Teacher and Student */
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Name & Surname - For ALL roles */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <input 
            type="text" 
            placeholder="Enter username"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Surname</label>
          <input 
            type="text" 
            placeholder="Enter Surname"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Email - For ALL roles */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
        <input 
          type="email" 
          placeholder="Enter email address"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>
      
      {/* Enter Platform Button */}
      <button className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2 mb-4">
        Enter Platform
        <span>→</span>
      </button>
      
      {/* Sign In Link */}
      <p className="text-center text-gray-500 text-sm">
        Already have an account?{' '}
        <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Sign In
        </a>
      </p>
    </div>
  );
};

export default Box;