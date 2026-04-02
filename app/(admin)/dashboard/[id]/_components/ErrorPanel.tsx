'use client';

import { Lightbulb, CheckCircle, ExternalLink, Play, Loader2 } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StatSummary } from '@/components/ui/stat-summary';
import { TabName, TabState } from '../../../validators/types';
import DataPreview from './DataPreview';

interface ErrorPanelProps {
  open: boolean;
  tabName: TabName;
  state: TabState;
  sheetUrl: string;
  onClose: () => void;
  onCellChange?: (rowIndex: number, key: string, value: string) => void;
  onRevalidate?: () => void;
  isRunning?: boolean;
}

const TAB_THAI_LABEL: Record<TabName, string> = {
  period: 'คาบ', room: 'ห้อง', teacher: 'ครู', student: 'นักเรียน',
  preplace: 'ตรึงคาบ', scout: 'ลูกเสือ', elective: 'วิชาเสรี', curriculum: 'หลักสูตร',
};

export default function ErrorPanel({ open, tabName, state, sheetUrl, onClose, onCellChange, onRevalidate, isRunning }: ErrorPanelProps) {
  const result = state.result;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl sm:max-w-2xl flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold text-foreground">
            {TAB_THAI_LABEL[tabName]}{' '}
            <span className="text-sm font-normal text-foreground-muted">({tabName})</span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {TAB_THAI_LABEL[tabName]} validation details
          </SheetDescription>
          <StatSummary items={[
            { value: result?.rowCount ?? 0,        label: 'แถว' },
            { value: result?.errors.length ?? 0,   label: 'ข้อผิดพลาด', variant: (result?.errors.length ?? 0)  > 0 ? 'danger'  : 'default' },
            { value: result?.warnings.length ?? 0, label: 'คำเตือน',    variant: (result?.warnings.length ?? 0) > 0 ? 'warning' : 'default' },
          ]} />
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Recommendation banner */}
          <div className="px-6 py-3 bg-primary-light border-b border-primary-border">
            <p className="text-xs text-primary font-medium flex items-center gap-1.5">
              <Lightbulb size={12} />
              แนะนำให้แก้ไขใน Google Sheet โดยตรง แล้วกดตรวจสอบอีกครั้ง
            </p>
          </div>

          {/* Error / warning list */}
          {result && (result.errors.length > 0 || result.warnings.length > 0) ? (
            <div className="px-6 py-4 space-y-2">
              <p className="text-xs font-semibold tracking-wide text-foreground-muted uppercase mb-3">
                รายการข้อผิดพลาด / คำเตือน
              </p>
              {[...result.errors, ...result.warnings].map((e, idx) => (
                <Card
                  key={idx}
                  className={e.severity === 'error'
                    ? 'border-danger-border bg-danger-light'
                    : 'border-warning-border bg-warning-light'}
                >
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Badge variant={e.severity === 'error' ? 'danger' : 'warning'} className="shrink-0 mt-0.5">
                        {e.severity === 'error' ? 'error' : 'warning'}
                      </Badge>
                      <p className="text-sm font-medium text-foreground">{e.message}</p>
                    </div>
                    {e.suggestion && (
                      <p className="mt-1.5 text-xs text-foreground-muted flex items-center gap-1">
                        <Lightbulb size={12} className="shrink-0" />
                        หมายถึง: <span className="font-semibold ml-1">{e.suggestion}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="px-6 py-4 flex items-center gap-2 text-sm text-success font-medium">
              <CheckCircle size={16} />
              ไม่พบข้อผิดพลาด
            </div>
          )}

          {/* Data preview */}
          {result && result.parsedRows.length > 0 && (
            <div className="px-6 pb-6">
              <p className="text-xs font-semibold tracking-wide text-foreground-muted uppercase mb-3">
                ตัวอย่างข้อมูล
              </p>
              <DataPreview
                rows={result.parsedRows}
                errors={result.errors}
                warnings={result.warnings}
                onCellChange={onCellChange}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5 mb-2">
            <Lightbulb size={12} />
            แก้ไขข้อมูลใน Google Sheet แล้วกด "ดึงข้อมูลและตรวจสอบ" อีกครั้ง
          </p>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
            >
              <ExternalLink size={14} />
              เปิด Google Sheet
            </a>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
