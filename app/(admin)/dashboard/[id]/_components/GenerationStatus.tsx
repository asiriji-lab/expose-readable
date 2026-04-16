'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useJobStatus } from '@/lib/hooks/useJobStatus';

type GenerationState = 'idle' | 'generating' | 'completed' | 'failed';

interface GenerationStatusProps {
  state: GenerationState;
  sessionId: string;
  jobId?: string;
  onStateChange: (state: GenerationState) => void;
}

export default function GenerationStatus({ state, sessionId, jobId, onStateChange }: GenerationStatusProps) {
  const { job, error } = useJobStatus(jobId ?? null);
  const status = job?.status;
  const progress = job?.progress;

  useEffect(() => {
    if (status === 'completed' && state !== 'completed') {
      onStateChange('completed');
    } else if (status === 'failed' && state !== 'failed') {
      onStateChange('failed');
    }
  }, [status, state, onStateChange]);

  if (state === 'completed') {
    return (
      <Card className="border-success-border bg-success-light">
        <CardContent className="px-6 py-8 text-center space-y-4">
          <CheckCircle size={40} className="text-success mx-auto" />
          <p className="text-lg font-semibold text-success">สร้างตารางสอนเสร็จสิ้น!</p>
          <a href={`/schedule?jobId=${jobId}`} className={cn(buttonVariants({ variant: 'success', size: 'lg' }))}>
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
          <p className="text-sm text-foreground-muted">{error ?? 'ตรวจสอบข้อมูลและลองอีกครั้ง'}</p>
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
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
        <p className="text-sm text-primary">Job ID: {jobId}</p>
      </CardContent>
    </Card>
  );
}
