import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function CreateScheduleButton() {
  return (
    <div className="mb-8">
      <Link
        href="/dashboard/new"
        className="flex items-center space-x-4 w-full px-8 py-6 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-all duration-200"
      >
        <div className="w-12 h-12 bg-surface bg-opacity-90 rounded-lg flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col items-start">
          <h3 className="text-lg font-semibold">สร้างตารางสอนใหม่</h3>
          <p className="text-sm text-white/70 font-normal">เริ่มต้นกรอกข้อมูลและสร้างตารางเรียน</p>
        </div>
      </Link>
    </div>
  );
}
