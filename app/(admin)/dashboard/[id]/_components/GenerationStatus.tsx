'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      <Card className="border-success-border bg-success-light">
        <CardContent className="px-6 py-8 text-center space-y-4">
          <CheckCircle size={40} className="text-success mx-auto" />
          <p className="text-lg font-semibold text-success">สร้างตารางสอนเสร็จสิ้น!</p>
          <a href="/schedule" className={cn(buttonVariants({ variant: 'success', size: 'lg' }))}>
            <Calendar size={16} /> ดูตารางสอน
          </a>
        </CardContent>
      </Card>
    );
  }

  if (state === 'failed') {
    return (
      <Card className="border-danger-border bg-danger-light">
        <CardContent className="px-6 py-8 text-center space-y-4">
          <XCircle size={40} className="text-danger mx-auto" />
          <p className="text-lg font-semibold text-danger">สร้างตารางไม่สำเร็จ</p>
          <p className="text-sm text-foreground-muted">ตรวจสอบข้อมูลและลองอีกครั้ง</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary-border bg-primary-light">
      <CardContent className="px-6 py-8 text-center space-y-4">
        <Loader2 size={40} className="text-primary mx-auto animate-spin" />
        <p className="text-lg font-semibold text-primary">กำลังสร้างตารางสอน...</p>
        <div className="w-full bg-primary-light rounded-full h-3 overflow-hidden border border-primary-border">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-primary">ประมาณ 2–5 นาที</p>
      </CardContent>
    </Card>
  );
}
