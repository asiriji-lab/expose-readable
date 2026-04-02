'use client';

import { useState } from 'react';
import { Check, Copy, Code2 } from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const FILES = ['Code.gs', 'validators.gs', 'parsers.gs'] as const;

type FileMap = Record<string, string>;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </button>
  );
}

export default function AppScriptSheet() {
  const [files, setFiles] = useState<FileMap | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (files) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sheets/appscript');
      const data = await res.json();
      setFiles(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger
        onClick={handleOpen}
        render={
          <button className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium mt-1 transition-colors" />
        }
      >
        <Code2 size={12} /> ดูโค้ด Apps Script
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Apps Script — คัดลอกโค้ดทั้ง 3 ไฟล์</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          <p className="text-xs text-foreground-muted">
            ไปที่ Google Sheet → <strong>Extensions → Apps Script</strong> → สร้างไฟล์ใหม่ตามชื่อด้านล่าง แล้ววางโค้ดในแต่ละไฟล์
          </p>

          {loading && (
            <p className="text-xs text-foreground-muted animate-pulse">กำลังโหลด...</p>
          )}

          {files && FILES.map((filename) => (
            <div key={filename} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground font-mono">{filename}</span>
                <CopyButton text={files[filename] ?? ''} />
              </div>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-56 text-foreground-muted whitespace-pre leading-relaxed border border-border">
                {files[filename]}
              </pre>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
