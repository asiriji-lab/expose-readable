'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, CheckCircle, AlertTriangle, FileSpreadsheet, Upload, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type FetchStatus } from '../_hooks/useGoogleSheet';
import { extractSheetId } from '../_utils/csvHelpers';

interface SheetConnectorProps {
  fetchStatus: FetchStatus;
  fetchError: string | null;
  connectedSheetId: string | null;
  connectedSheetUrl: string | null;
  isCreatingSheet?: boolean;
  onCreateSkeleton: () => void;
  onConnectImport: (sheetId: string) => void;
  onConnectSkeleton: () => void;
}

export default function SheetConnector({
  fetchStatus,
  fetchError,
  connectedSheetId,
  connectedSheetUrl,
  isCreatingSheet,
  onCreateSkeleton,
  onConnectImport,
  onConnectSkeleton,
}: SheetConnectorProps) {
  const [mode, setMode] = useState<'skeleton' | 'import'>('skeleton');
  const [importUrl, setImportUrl] = useState('');

  const isFetching = fetchStatus === 'fetching';
  const isConnected = fetchStatus === 'success';

  function handleImportConnect() {
    const id = extractSheetId(importUrl);
    if (!id) return;
    onConnectImport(id);
  }

  // ── Skeleton mode ──
  if (mode === 'skeleton') {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Google Sheet</p>
            {isConnected && (
              <span className="flex items-center gap-1 text-xs text-success font-medium">
                <CheckCircle size={13} /> เชื่อมต่อแล้ว
              </span>
            )}
          </div>

          {/* No sheet created yet */}
          {!connectedSheetId && (
            <>
              <button
                onClick={() => { onCreateSkeleton(); setMode('import'); }}
                className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                <FileSpreadsheet size={12} /> สร้าง Google Sheet (คัดลอกแบบฟอร์ม)
              </button>

              {fetchError && (
                <p className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle size={13} className="shrink-0" />
                  {fetchError}
                </p>
              )}
            </>
          )}

          {/* Sheet created, not yet connected */}
          {connectedSheetId && !isConnected && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <a
                  href={connectedSheetUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center gap-2 px-4 py-3 bg-warning-light border border-warning-border rounded-xl text-sm text-foreground-muted truncate hover:border-primary/50 transition-colors"
                >
                  <ExternalLink size={14} className="text-primary shrink-0" />
                  <span className="truncate">{connectedSheetUrl}</span>
                </a>
                <Button
                  onClick={onConnectSkeleton}
                  disabled={isFetching}
                  size="sm"
                >
                  {isFetching ? (
                    <><Loader2 size={14} className="animate-spin" /> กำลังดึง...</>
                  ) : (
                    'เชื่อมต่อ'
                  )}
                </Button>
              </div>
              {fetchError && (
                <p className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle size={13} className="shrink-0" />
                  {fetchError}
                </p>
              )}
            </div>
          )}

          {/* Connected */}
          {isConnected && connectedSheetUrl && (
            <a
              href={connectedSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
            >
              <ExternalLink size={12} /> เปิด Google Sheet
            </a>
          )}

          {/* Switch to import mode */}
          {!isConnected && (
            <button
              onClick={() => setMode('import')}
              className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              <Upload size={12} /> นำเข้าข้อมูลของฉัน (Import)
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Import mode ──
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">นำเข้า Google Sheet</p>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-success font-medium">
              <CheckCircle size={13} /> เชื่อมต่อแล้ว
            </span>
          )}
        </div>

        <p className="text-xs text-foreground-muted">
          วางลิงก์ Google Sheet ที่มีข้อมูล 8 แท็บ แล้วกด "เชื่อมต่อ"
        </p>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            disabled={isFetching}
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleImportConnect}
            disabled={!extractSheetId(importUrl) || isFetching}
            size="sm"
          >
            {isFetching ? (
              <><Loader2 size={14} className="animate-spin" /> กำลังดึง...</>
            ) : (
              'เชื่อมต่อ'
            )}
          </Button>
        </div>

        {fetchError && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <AlertTriangle size={13} className="shrink-0" />
            {fetchError}
          </p>
        )}

        {isConnected && connectedSheetUrl && (
          <a
            href={connectedSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
          >
            <ExternalLink size={12} /> เปิด Google Sheet
          </a>
        )}

        {/* Back to skeleton mode */}
        {!isConnected && (
          <button
            onClick={() => setMode('skeleton')}
            className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} /> ย้อนกลับ
          </button>
        )}
      </CardContent>
    </Card>
  );
}
