import Link from 'next/link';
import { Plus, ArrowRight } from 'lucide-react';

const TEMPLATE_SHEET_ID = '1vtutQzr7kHrTv3WnVniH1tqjV1mp_FoZGqtWYeuM9wQ';
const COPY_URL = `https://docs.google.com/spreadsheets/d/${TEMPLATE_SHEET_ID}/copy`;

export default function CreateScheduleButton() {
  return (
    <div className="flex flex-col gap-2 mb-8">
      {/* Primary: copy template */}
      <a
        href={COPY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-4 w-full px-8 py-6 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-all duration-200"
      >
        <div className="w-12 h-12 bg-surface bg-opacity-90 rounded-lg flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col items-start">
          <h3 className="text-lg font-semibold">สร้างตารางสอนใหม่</h3>
          <p className="text-sm text-white/70 font-normal">คัดลอก Template Google Sheet สำหรับกรอกข้อมูล</p>
        </div>
      </a>

      {/* Secondary: skip to session directly */}
      <Link
        href="/dashboard/sem1-2569"
        className="self-end flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        มี Sheet อยู่แล้ว <ArrowRight size={12} />
      </Link>
    </div>
  );
}
