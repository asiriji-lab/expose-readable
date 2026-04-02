'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GenerationState = 'generating' | 'completed' | 'failed';

interface GenerationStatusProps {
  state: GenerationState;
  sessionId: string;
  jobId: string | null;
  downloadUrl: string | null;
  onCompleted: () => void;
  onFailed: (error?: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  created: 'กำลังเตรียมข้อมูล...',
  loading_data: 'กำลังโหลดข้อมูล...',
  running_ga: 'กำลังสร้างตารางสอน...',
  exporting: 'กำลังส่งออกผลลัพธ์...',
};

export default function GenerationStatus({
  state,
  jobId,
  downloadUrl,
  onCompleted,
  onFailed,
}: GenerationStatusProps) {
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState('กำลังเตรียมข้อมูล...');
  const [apiError, setApiError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state !== 'generating' || !jobId) return;

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    async function poll() {
      try {
        const res = await fetch(`/api/schedule/status?job_id=${jobId}`);
        const data = await res.json();

        if (!res.ok) {
          stopPolling();
          setApiError(data.error ?? 'เกิดข้อผิดพลาด');
          onFailed(data.error);
          return;
        }

        setProgress(data.progress ?? 0);
        if (data.status && STATUS_LABEL[data.status]) {
          setStatusLabel(STATUS_LABEL[data.status]);
        }

        if (data.status === 'completed') {
          stopPolling();
          setProgress(100);
          onCompleted();
        } else if (data.status === 'failed') {
          stopPolling();
          setApiError(data.error ?? 'สร้างตารางไม่สำเร็จ');
          onFailed(data.error);
        }
      } catch {
        // network error — keep polling
      }
    }

    poll(); // immediate first call
    intervalRef.current = setInterval(poll, 3000);

    return stopPolling;
  }, [state, jobId, onCompleted, onFailed]);

  if (state === 'completed') {
    return (
      <Card className="border-success-border bg-success-light">
        <CardContent className="px-6 py-8 text-center space-y-4">
          <CheckCircle size={40} className="text-success mx-auto" />
          <p className="text-lg font-semibold text-success">สร้างตารางสอนเสร็จสิ้น!</p>
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'success', size: 'lg' }))}
            >
              <Download size={16} /> ดาวน์โหลดตารางสอน
            </a>
          )}
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
          <p className="text-sm text-foreground-muted">
            {apiError ?? 'ตรวจสอบข้อมูลและลองอีกครั้ง'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary-border bg-primary-light">
      <CardContent className="px-6 py-8 text-center space-y-4">
        <Loader2 size={40} className="text-primary mx-auto animate-spin" />
        <p className="text-lg font-semibold text-primary">{statusLabel}</p>
        <div className="w-full bg-primary-light rounded-full h-3 overflow-hidden border border-primary-border">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-primary">{progress}%</p>
      </CardContent>
    </Card>
  );
}
