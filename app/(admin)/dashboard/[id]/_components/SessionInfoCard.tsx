'use client';

import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SessionInfo {
  name: string;
  semester: 1 | 2;
  year: number;
}

interface SessionInfoCardProps {
  value: SessionInfo;
  onChange: (value: SessionInfo) => void;
}

const CURRENT_YEAR = 2568;
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 2 + i);

const selectClass =
  'w-full h-8 px-2.5 py-1 text-sm rounded-lg border border-input bg-transparent outline-none ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors ' +
  'text-foreground';

export default function SessionInfoCard({ value, onChange }: SessionInfoCardProps) {
  function set<K extends keyof SessionInfo>(key: K, val: SessionInfo[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList size={18} className="text-foreground-muted" />
          ข้อมูลตารางสอน
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Name */}
          <div className="flex-1 space-y-1">
            <Label className="text-xs font-medium text-foreground-muted">
              ชื่อตาราง <span className="text-danger">*</span>
            </Label>
            <Input
              type="text"
              value={value.name}
              onChange={(e) => set('name', (e.target as HTMLInputElement).value)}
              placeholder="เช่น ตารางสอน ภาคเรียนที่ 1/2568"
            />
          </div>

          {/* Semester */}
          <div className="w-full sm:w-32 space-y-1">
            <Label className="text-xs font-medium text-foreground-muted">
              ภาคเรียน <span className="text-danger">*</span>
            </Label>
            <select
              value={value.semester}
              onChange={(e) => set('semester', Number(e.target.value) as 1 | 2)}
              className={selectClass}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          {/* Year */}
          <div className="w-full sm:w-36 space-y-1">
            <Label className="text-xs font-medium text-foreground-muted">
              ปีการศึกษา <span className="text-danger">*</span>
            </Label>
            <select
              value={value.year}
              onChange={(e) => set('year', Number(e.target.value))}
              className={selectClass}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
