'use client';

export interface SessionInfo {
  name: string;
  semester: 1 | 2;
  year: number;
}

interface SessionInfoCardProps {
  value: SessionInfo;
  onChange: (value: SessionInfo) => void;
}

const CURRENT_YEAR = 2568;
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function SessionInfoCard({ value, onChange }: SessionInfoCardProps) {
  function set<K extends keyof SessionInfo>(key: K, val: SessionInfo[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📋</span>
        <h2 className="font-semibold text-gray-800">ข้อมูลตารางสอน</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Name */}
        <div className="flex-1 space-y-1">
          <label className="block text-xs font-medium text-gray-500">
            ชื่อตาราง <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="เช่น ตารางสอน ภาคเรียนที่ 1/2568"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Semester */}
        <div className="w-full sm:w-32 space-y-1">
          <label className="block text-xs font-medium text-gray-500">
            ภาคเรียน <span className="text-red-400">*</span>
          </label>
          <select
            value={value.semester}
            onChange={(e) => set('semester', Number(e.target.value) as 1 | 2)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        {/* Year */}
        <div className="w-full sm:w-36 space-y-1">
          <label className="block text-xs font-medium text-gray-500">
            ปีการศึกษา <span className="text-red-400">*</span>
          </label>
          <select
            value={value.year}
            onChange={(e) => set('year', Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
