'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type FetchStatus } from '../_hooks/useGoogleSheet';

interface SheetEmbedProps {
  fetchStatus: FetchStatus;
  fetchError: string | null;
  onFetch: (spreadsheetId: string) => void;
}

function extractSheetId(url: string): string | null {
  // Handles full URLs: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Also accept a bare ID (no slashes)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export default function SheetEmbed({ fetchStatus, fetchError, onFetch }: SheetEmbedProps) {
  const [inputUrl, setInputUrl] = useState('');

  const sheetId = extractSheetId(inputUrl);
  const isFetching = fetchStatus === 'fetching';
  const isSuccess = fetchStatus === 'success';

  function handleConnect() {
    if (!sheetId) return;
    onFetch(sheetId);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Google Sheet</p>
          {isSuccess && (
            <span className="flex items-center gap-1 text-xs text-success font-medium">
              <CheckCircle size={13} /> เชื่อมต่อแล้ว
            </span>
          )}
        </div>

        <p className="text-xs text-foreground-muted">
          วางลิงก์ Google Sheet ที่มีข้อมูล 8 แท็บ แล้วกด "เชื่อมต่อ"
        </p>

        {/* URL input + button */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            disabled={isFetching}
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleConnect}
            disabled={!sheetId || isFetching}
            size="sm"
          >
            {isFetching ? (
              <><Loader2 size={14} className="animate-spin" /> กำลังดึง...</>
            ) : (
              'เชื่อมต่อ'
            )}
          </Button>
        </div>

        {/* Error */}
        {fetchError && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <AlertTriangle size={13} className="shrink-0" />
            {fetchError}
          </p>
        )}

        {/* Open sheet link */}
        {isSuccess && sheetId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium"
          >
            <ExternalLink size={12} /> เปิด Google Sheet
          </a>
        )}
      </CardContent>

    </Card>
  );
}