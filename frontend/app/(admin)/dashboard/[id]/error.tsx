'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardSessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard/[id] error boundary]', error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <AlertCircle size={48} className="text-danger mx-auto" />
        <h2 className="text-xl font-bold text-foreground">โหลดหน้าไม่สำเร็จ</h2>
        <p className="text-sm text-foreground-muted font-mono break-all">
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p className="text-xs text-foreground-muted">digest: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-alt transition-colors"
          >
            <ArrowLeft size={16} /> กลับ
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <RotateCcw size={16} /> ลองใหม่
          </button>
        </div>
      </div>
    </div>
  );
}
