'use client';

import { TabName, AllTabStates } from '../../../validators/types';
import TabCard from './TabCard';

const PHASE_1_TABS: TabName[] = ['period', 'room', 'teacher', 'student'];
const PHASE_2_TABS: TabName[] = ['preplace', 'scout', 'elective', 'curriculum'];

interface ValidationSectionProps {
  tabStates: AllTabStates;
  isRunning: boolean;
  missingTabs: TabName[];
  onValidate: () => void;
  onTabClick: (tabName: TabName) => void;
}

export default function ValidationSection({
  tabStates,
  isRunning,
  missingTabs,
  onValidate,
  onTabClick,
}: ValidationSectionProps) {
  const phase1Done = PHASE_1_TABS.every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings' || s === 'errors';
  });

  const allPassed = [...PHASE_1_TABS, ...PHASE_2_TABS].every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings';
  });

  const hasErrors = [...PHASE_1_TABS, ...PHASE_2_TABS].some((t) => tabStates[t].status === 'errors');

  // Summary counts
  const totalErrors = Object.values(tabStates).reduce((s, t) => s + (t.result?.errors.length ?? 0), 0);
  const totalWarnings = Object.values(tabStates).reduce((s, t) => s + (t.result?.warnings.length ?? 0), 0);
  const totalRows = Object.values(tabStates).reduce((s, t) => s + (t.result?.rowCount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Missing tabs warning */}
      {missingTabs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
          ⚠️ ไม่พบแท็บ: <span className="font-semibold">{missingTabs.join(', ')}</span> — ตรวจสอบชื่อแท็บใน Google Sheet
        </div>
      )}

      {/* Phase 1 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground-muted">Phase 1: ตรวจโครงสร้าง</h3>
          {phase1Done && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              PHASE_1_TABS.every((t) => tabStates[t].status !== 'errors')
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {PHASE_1_TABS.filter((t) => tabStates[t].status !== 'errors').length}/4 ผ่าน
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASE_1_TABS.map((tab) => (
            <TabCard key={tab} tabName={tab} state={tabStates[tab]} onClick={onTabClick} />
          ))}
        </div>
      </div>

      {/* Phase 2 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground-muted">Phase 2: ตรวจความสัมพันธ์</h3>
          {phase1Done && PHASE_2_TABS.every((t) => tabStates[t].status !== 'locked') && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              PHASE_2_TABS.every((t) => tabStates[t].status !== 'errors')
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {PHASE_2_TABS.filter((t) => tabStates[t].status !== 'errors').length}/4 ผ่าน
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASE_2_TABS.map((tab) => (
            <TabCard key={tab} tabName={tab} state={tabStates[tab]} onClick={onTabClick} />
          ))}
        </div>
      </div>

      {/* Validate button */}
      <button
        onClick={onValidate}
        disabled={isRunning}
        className={`
          w-full py-3 rounded-xl font-semibold text-sm transition-all
          ${isRunning
            ? 'bg-primary-light text-foreground-muted cursor-not-allowed'
            : 'bg-primary hover:bg-primary-hover text-white shadow-sm hover:shadow-md'}
        `}
      >
        {isRunning ? '🔄 กำลังตรวจสอบ...' : '▶ ตรวจสอบข้อมูลทั้งหมด'}
      </button>

      {/* Summary + submit */}
      {phase1Done && !isRunning && (
        <div className={`rounded-xl border p-4 ${hasErrors ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground-muted">{totalRows} แถว</span>
              <span className="mx-2 text-foreground-muted">·</span>
              <span className={`font-semibold ${totalErrors > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalErrors} ข้อผิดพลาด
              </span>
              <span className="mx-2 text-foreground-muted">·</span>
              <span className={`font-semibold ${totalWarnings > 0 ? 'text-yellow-600' : 'text-foreground-muted'}`}>
                {totalWarnings} คำเตือน
              </span>
            </div>
            <SubmitButton allPassed={allPassed} hasErrors={hasErrors} totalWarnings={totalWarnings} />
          </div>
          {totalWarnings > 0 && !hasErrors && (
            <p className="text-xs text-yellow-700 mt-2">
              ⚠️ คำเตือนจะไม่บล็อคการส่ง แต่อาจมีผลกับการจัดตาราง
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SubmitButton({ allPassed, hasErrors, totalWarnings }: { allPassed: boolean; hasErrors: boolean; totalWarnings: number }) {
  if (hasErrors) {
    return (
      <button disabled className="px-5 py-2 rounded-lg text-sm bg-border text-foreground-muted cursor-not-allowed font-semibold">
        🚀 ส่งข้อมูล (ปิดใช้งาน)
      </button>
    );
  }
  if (!allPassed) return null;
  return (
    <button className="px-5 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm transition-all">
      🚀 ส่งข้อมูลสร้างตาราง
    </button>
  );
}
