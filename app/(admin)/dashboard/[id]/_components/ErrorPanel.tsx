'use client';

import { TabName, TabState } from '../../../validators/types';
import DataPreview from './DataPreview';

interface ErrorPanelProps {
  tabName: TabName;
  state: TabState;
  sheetUrl: string;
  onClose: () => void;
}

const TAB_THAI_LABEL: Record<TabName, string> = {
  period: 'คาบ', room: 'ห้อง', teacher: 'ครู', student: 'นักเรียน',
  preplace: 'ตรึงคาบ', scout: 'ลูกเสือ', elective: 'วิชาเสรี', curriculum: 'หลักสูตร',
};

export default function ErrorPanel({ tabName, state, sheetUrl, onClose }: ErrorPanelProps) {
  const result = state.result;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {TAB_THAI_LABEL[tabName]} <span className="text-sm font-normal text-gray-400">({tabName})</span>
            </h2>
            <p className="text-sm text-gray-500">
              {result?.rowCount ?? 0} แถว ·{' '}
              {result?.errors.length ?? 0} ข้อผิดพลาด ·{' '}
              {result?.warnings.length ?? 0} คำเตือน
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Error list */}
          {result && (result.errors.length > 0 || result.warnings.length > 0) ? (
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                รายการข้อผิดพลาด / คำเตือน
              </h3>
              {[...result.errors, ...result.warnings].map((e, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg px-4 py-3 text-sm border ${
                    e.severity === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  }`}
                >
                  <p className="font-medium">{e.message}</p>
                  {e.suggestion && (
                    <p className="mt-1 text-xs opacity-80">
                      💡 หมายถึง: <span className="font-semibold">{e.suggestion}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-sm text-green-600 font-medium">✅ ไม่พบข้อผิดพลาด</p>
            </div>
          )}

          {/* Data preview */}
          {result && result.parsedRows.length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">ตัวอย่างข้อมูล</h3>
              <DataPreview
                rows={result.parsedRows}
                errors={result.errors}
                warnings={result.warnings}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">
            💡 แก้ไขข้อมูลใน Google Sheet แล้วกด "ดึงข้อมูลและตรวจสอบ" อีกครั้ง
          </p>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            🔗 เปิด Google Sheet ↗
          </a>
        </div>
      </div>
    </>
  );
}
