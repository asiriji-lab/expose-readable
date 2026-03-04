'use client';

import { TabName, TabState } from '../../../validators/types';

const TAB_META: Record<TabName, { label: string; thaiLabel: string; icon: string }> = {
  period:     { label: 'period',     thaiLabel: 'คาบ',      icon: '📅' },
  room:       { label: 'room',       thaiLabel: 'ห้อง',     icon: '🏫' },
  teacher:    { label: 'teacher',    thaiLabel: 'ครู',      icon: '👨‍🏫' },
  student:    { label: 'student',    thaiLabel: 'นักเรียน', icon: '👨‍🎓' },
  preplace:   { label: 'preplace',   thaiLabel: 'ตรึงคาบ',  icon: '📌' },
  scout:      { label: 'scout',      thaiLabel: 'ลูกเสือ',  icon: '⚜️' },
  elective:   { label: 'elective',   thaiLabel: 'วิชาเสรี', icon: '📚' },
  curriculum: { label: 'curriculum', thaiLabel: 'หลักสูตร', icon: '📖' },
};

const STATUS_CONFIG: Record<TabState['status'], { badge: string; badgeClass: string; cardClass: string }> = {
  pending:    { badge: '⏳ รอตรวจสอบ',    badgeClass: 'bg-gray-100 text-gray-600',              cardClass: 'border-gray-200 bg-white' },
  validating: { badge: '🔄 กำลังตรวจ...',  badgeClass: 'bg-blue-100 text-blue-600 animate-pulse', cardClass: 'border-blue-300 bg-blue-50' },
  passed:     { badge: '✅ ผ่าน',          badgeClass: 'bg-green-100 text-green-700',             cardClass: 'border-green-300 bg-green-50' },
  warnings:   { badge: '⚠️ คำเตือน',       badgeClass: 'bg-yellow-100 text-yellow-700',           cardClass: 'border-yellow-300 bg-yellow-50' },
  errors:     { badge: '❌ พบข้อผิดพลาด',  badgeClass: 'bg-red-100 text-red-700',                 cardClass: 'border-red-300 bg-red-50' },
  locked:     { badge: '🔒 รอ Phase 1',    badgeClass: 'bg-gray-100 text-gray-400',              cardClass: 'border-gray-200 bg-gray-50 opacity-60' },
  missing:    { badge: '❓ ไม่พบแท็บ',    badgeClass: 'bg-red-100 text-red-600',                 cardClass: 'border-red-300 bg-red-50' },
};

interface TabCardProps {
  tabName: TabName;
  state: TabState;
  onClick: (tabName: TabName) => void;
}

export default function TabCard({ tabName, state, onClick }: TabCardProps) {
  const meta = TAB_META[tabName];
  const cfg = STATUS_CONFIG[state.status];
  const result = state.result;

  const errorCount = result?.errors.length ?? 0;
  const warningCount = result?.warnings.length ?? 0;
  const rowCount = result?.rowCount;

  const isClickable = state.status !== 'locked' && state.status !== 'pending';

  return (
    <button
      onClick={() => isClickable && onClick(tabName)}
      disabled={!isClickable}
      className={`
        flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left w-full
        transition-all duration-200
        ${cfg.cardClass}
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}
      `}
    >
      {/* Icon + name */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.icon}</span>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{meta.thaiLabel}</p>
          <p className="text-xs text-gray-400">{meta.label}</p>
        </div>
      </div>

      {/* Row count */}
      {rowCount !== undefined && (
        <p className="text-xs text-gray-500">{rowCount} แถว</p>
      )}

      {/* Status badge */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
        {cfg.badge}
      </span>

      {/* Error / warning counts */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex gap-2 text-xs">
          {errorCount > 0 && <span className="text-red-600">{errorCount} errors</span>}
          {warningCount > 0 && <span className="text-yellow-600">{warningCount} warnings</span>}
        </div>
      )}
    </button>
  );
}
