'use client';

import { ExternalLink, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppScriptSheet from './AppScriptSheet';

interface InstructionPanelProps {
  sheetUrl: string;
  onValidate: () => void;
  isValidating: boolean;
}

export default function InstructionPanel({ sheetUrl, onValidate, isValidating }: InstructionPanelProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground">ขั้นตอนการใช้งาน</p>

        <ol className="space-y-3">
          <li className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">เปิด Google Sheet ในแท็บใหม่</p>
              <p className="text-xs text-foreground-muted mt-0.5">กรอกข้อมูลให้ครบทั้ง 8 แท็บ</p>
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
              <p className="text-sm font-medium text-foreground">รัน Apps Script ใน Google Sheet</p>
              <p className="text-xs text-foreground-muted mt-0.5">สีเขียว = ถูกต้อง, สีเหลือง = คำเตือน, สีแดง = ข้อผิดพลาด</p>
              <AppScriptSheet />
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">แก้ไขเซลล์สีแดงทั้งหมด ตรวจสอบเซลล์สีเหลือง</p>
              <p className="text-xs text-foreground-muted mt-0.5">เซลล์สีแดงต้องแก้ไขก่อนดำเนินการต่อ</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">4</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">กลับมาที่หน้านี้ แล้วกดปุ่ม "ตรวจสอบ" ด้านล่าง</p>
              <p className="text-xs text-foreground-muted mt-0.5">ระบบจะดึงข้อมูลล่าสุดจาก Google Sheet มาตรวจสอบ</p>
            </div>
          </li>
        </ol>

        <Button
          onClick={onValidate}
          disabled={isValidating}
          size="full"
        >
          {isValidating ? (
            <><Loader2 size={16} className="animate-spin" /> กำลังตรวจสอบ...</>
          ) : (
            <><Search size={16} /> ตรวจสอบ</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
