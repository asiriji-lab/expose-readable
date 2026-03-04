import Link from 'next/link';
import { Plus } from 'lucide-react';

/**
 * TODO: When Google Sheets integration is ready, replace this Link with a button
 * that calls a server action to create a new session (clone template sheet),
 * then redirect to /dashboard/[newId].
 */
export default function CreateScheduleButton() {
  return (
    <Link
      href="/dashboard/new"
      className="flex items-center space-x-4 w-full px-8 py-6 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-all duration-200 mb-8"
    >
      {/* Icon */}
      <div className="w-12 h-12 bg-surface bg-opacity-90 rounded-lg flex items-center justify-center flex-shrink-0">
        <Plus className="w-6 h-6 text-primary" />
      </div>

      {/* Text */}
      <div className="flex flex-col items-start">
        <h3 className="text-lg font-semibold">สร้างตารางสอนใหม่</h3>
        <p className="text-sm text-white/70 font-normal">จะสร้าง Google Sheet ใหม่สำหรับการจัดตารางนี้</p>
      </div>
    </Link>
  );
}