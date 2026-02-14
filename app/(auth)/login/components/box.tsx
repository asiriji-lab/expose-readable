import React from 'react';
import Link from 'next/link';
import { AiOutlineEye } from 'react-icons/ai';
import { Shield, BookOpen, GraduationCap } from 'lucide-react';

const Box: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 w-[450px] min-h-[600px]">
      {/* Title */}
      <h1 className="text-2xl font-bold text-center mb-2">Welcome to ScheDool</h1>
      <p className="text-gray-500 text-center mb-6">Select your role to access the platform</p>

      {/* Role selection */}
      <div className="mb-6">
        <p className="mb-3 font-medium">I am a.....</p>
        <div className="grid grid-cols-3 gap-3">
          {/* Admin */}
          <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden">
            <Shield className="w-7 h-7 mb-2" />
            <div className="font-semibold">Admin</div>
            <div className="text-xs text-gray-500 text-center mt-1">Full system access</div>
          </button>

          {/* Teacher */}
          <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden">
            <BookOpen className="w-8 h-8 mb-2" />
            <div className="font-semibold">Teacher</div>
            <div className="text-xs text-gray-500 text-center mt-1">View & manage classes</div>
          </button>

          {/* Student */}
          <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all overflow-hidden">
            <GraduationCap className="w-8 h-8 mb-2" />
            <div className="font-semibold">Student</div>
            <div className="text-xs text-gray-500 text-center mt-1">View schedules</div>
          </button>
        </div>
      </div>

      {/* Username */}
      <div className="mb-4">
        <label className="block mb-2 font-medium">Username</label>
        <input
          type="text"
          placeholder="Enter username"
          className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Password section */}
      <div className="mb-6">
        <label className="block mb-2 font-medium">Password</label>
        <div className="relative">
          <input
            type="password"
            placeholder="Enter password"
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500">
            <AiOutlineEye size={20} />
          </span>
        </div>
      </div>

      {/* Enter button */}
      <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
        Enter Platform →
      </button>

      <div className="mt-4 flex justify-center">
        <Link
          href="/register"
          className="text-gray-400 text-sm cursor-pointer hover:text-gray-600"
        >
          Register
        </Link>
      </div>
    </div>
  );
};

export default Box;