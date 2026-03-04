'use client';

import { useEffect, useState } from 'react';

type GenerationState = 'generating' | 'completed' | 'failed';

interface GenerationStatusProps {
  state: GenerationState;
  sessionId: string;
}

export default function GenerationStatus({ state, sessionId }: GenerationStatusProps) {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    if (state !== 'generating') return;
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 5, 90));
    }, 2000);
    return () => clearInterval(interval);
  }, [state]);

  if (state === 'completed') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-6 py-8 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <p className="text-lg font-semibold text-green-800">สร้างตารางสอนเสร็จสิ้น!</p>
        <a
          href={`/schedule`}
          className="inline-block mt-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm"
        >
          📅 ดูตารางสอน →
        </a>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center space-y-4">
        <div className="text-4xl">❌</div>
        <p className="text-lg font-semibold text-red-800">สร้างตารางไม่สำเร็จ</p>
        <p className="text-sm text-red-600">ตรวจสอบข้อมูลและลองอีกครั้ง</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-border bg-primary-light px-6 py-8 text-center space-y-4">
      <div className="text-4xl animate-spin">🔄</div>
      <p className="text-lg font-semibold text-primary">กำลังสร้างตารางสอน...</p>
      <div className="w-full bg-primary-light rounded-full h-3 overflow-hidden">
        <div
          className="bg-primary h-3 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-primary">ประมาณ 2–5 นาที</p>
    </div>
  );
}
