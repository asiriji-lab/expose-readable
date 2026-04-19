'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, CheckCircle, AlertTriangle, FileSpreadsheet, Upload, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type FetchStatus } from '../_hooks/useGoogleSheet';
import { extractSheetId } from '../_utils/csvHelpers';
import AppScriptSheet from './AppScriptSheet';

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
  const [mode, setMode] = useState<'skeleton' | 'import' | 'setup'>('skeleton');
  const [importUrl, setImportUrl] = useState('');
  const [pendingSheetId, setPendingSheetId] = useState<string | null>(null);

  const isFetching = fetchStatus === 'fetching';
  const isConnected = fetchStatus === 'success';

  function handleImportConnect() {
    const id = extractSheetId(importUrl);
    if (!id) return;
    setPendingSheetId(id);
    setMode('setup');
  }

  function handleConfirmConnect() {
    if (!pendingSheetId) return;
    onConnectImport(pendingSheetId);
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
                onClick={onCreateSkeleton}
                disabled={isCreatingSheet}
                className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isCreatingSheet ? (
                  <><Loader2 size={12} className="animate-spin" /> กำลังสร้าง...</>
                ) : (
                  <><FileSpreadsheet size={12} /> สร้าง Google Sheet (คัดลอกแบบฟอร์ม)</>
                )}
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

  // ── Setup guide (shown after pasting URL, before fetching) ──
  if (mode === 'setup' && pendingSheetId) {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${pendingSheetId}/edit`;
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">ตั้งค่า Apps Script ก่อนตรวจสอบ</p>

          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">เปิด Google Sheet ในแท็บใหม่</p>
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium mt-1"
                >
                  <ExternalLink size={12} /> เปิด Google Sheet
                </a>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">เพิ่ม Apps Script เข้า Google Sheet</p>
                <p className="text-xs text-foreground-muted mt-0.5">Extensions → Apps Script → วางโค้ด 3 ไฟล์ → Save</p>
                <AppScriptSheet />
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">รัน Schooldoo → Validate All Tabs</p>
                <p className="text-xs text-foreground-muted mt-0.5">แก้ไขเซลล์สีแดงให้ครบ แล้วกลับมาที่หน้านี้</p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">4</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">กดปุ่มด้านล่างเพื่อตรวจสอบ</p>
              </div>
            </li>
          </ol>

          {fetchError && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle size={13} className="shrink-0" />
              {fetchError}
            </p>
          )}

          <Button onClick={handleConfirmConnect} disabled={isFetching} size="full">
            {isFetching ? (
              <><Loader2 size={14} className="animate-spin" /> กำลังดึงข้อมูล...</>
            ) : (
              <><Search size={14} /> ตรวจสอบข้อมูล</>
            )}
          </Button>

          <button
            onClick={() => { setMode('import'); setPendingSheetId(null); }}
            className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} /> เปลี่ยน URL
          </button>
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
