'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useJobStatus } from '@/lib/hooks/useJobStatus';
import { downloadScheduleZip } from '@/api/schedule';

type GenerationState = 'idle' | 'generating' | 'completed' | 'failed';

interface GenerationStatusProps {
  state: GenerationState;
  sessionId: string;
  jobId: string | null;
  downloadUrl: string | null;
  errorMessage?: string | null;
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
  errorMessage,
  onCompleted,
  onFailed,
}: GenerationStatusProps) {
  const { job, error } = useJobStatus(jobId);

  useEffect(() => {
    if (state !== 'generating' || !jobId) return;

    if (job?.status === 'completed') {
      // Sync status to DB so the dashboard list reflects completion
      fetch(`/api/schedule/sync-status?job_id=${encodeURIComponent(jobId)}`, { method: 'POST' })
        .catch(() => { /* non-fatal */ });
      onCompleted();
    } else if (job?.status === 'failed') {
      fetch(`/api/schedule/sync-status?job_id=${encodeURIComponent(jobId)}`, { method: 'POST' })
        .catch(() => { /* non-fatal */ });
      onFailed(job?.error || error || 'สร้างตารางไม่สำเร็จ');
    } else if (error) {
      onFailed(error);
    }
  }, [state, jobId, job, error, onCompleted, onFailed]);

  if (state === 'completed') {
    return (
      <Card className="border-success-border bg-success-light">
        <CardContent className="px-6 py-8 text-center space-y-4">
          <CheckCircle size={40} className="text-success mx-auto" />
          <p className="text-lg font-semibold text-success">สร้างตารางสอนเสร็จสิ้น!</p>
          {jobId && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href={`/schedule?schedule_id=${encodeURIComponent(jobId)}`}
                className={cn(buttonVariants({ variant: 'success', size: 'lg' }))}
              >
                ดูตารางสอน
              </Link>
              <button
                onClick={() => downloadScheduleZip(jobId)}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              >
                <Download size={16} className="mr-2" /> ดาวน์โหลดตารางสอน
              </button>
            </div>
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
            {errorMessage || job?.error || error || 'ตรวจสอบข้อมูลและลองอีกครั้ง'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const progress = job?.progress ?? 0;
  const statusKey = job?.status ?? 'created';
  const statusLabel = STATUS_LABEL[statusKey] || 'กำลังประมวลผล...';

  return (
    <Card className="border-primary-border bg-primary-light">
      <CardContent className="px-6 py-8 text-center space-y-4">
        <Loader2 size={40} className="text-primary mx-auto animate-spin" />
        <p className="text-lg font-semibold text-primary">{statusLabel}</p>

        {job?.status === 'running_ga' && job?.progress_details && (
          <p className="text-sm text-primary font-mono">
            Generation: {job.progress_details.generation} / {job.progress_details.max_generations}
          </p>
        )}

        <div className="w-full bg-primary-light rounded-full h-3 overflow-hidden border border-primary-border relative">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-primary font-bold">{progress.toFixed(1)}%</p>
      </CardContent>
    </Card>
  );
}
