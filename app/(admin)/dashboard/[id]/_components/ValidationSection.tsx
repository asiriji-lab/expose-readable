'use client';

import { Play, Loader2, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { cn } from '@/lib/utils';
import { TabName, AllTabStates } from '../../../validators/types';
import TabCard from './TabCard';

const PHASE_1_TABS: TabName[] = ['period', 'room', 'teacher', 'student'];
const PHASE_2_TABS: TabName[] = ['preplace', 'scout', 'elective', 'curriculum'];

interface ValidationSectionProps {
  tabStates: AllTabStates;
  isRunning: boolean;
  missingTabs: TabName[];
  onValidate: () => void;
  onTabClick: (tabName: TabName) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export default function ValidationSection({
  tabStates,
  isRunning,
  missingTabs,
  onValidate,
  onTabClick,
  onSubmit,
  isSubmitting = false,
}: ValidationSectionProps) {
  const phase1Done = PHASE_1_TABS.every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings' || s === 'errors';
  });

  const allPassed = [...PHASE_1_TABS, ...PHASE_2_TABS].every((t) => {
    const s = tabStates[t].status;
    return s === 'passed' || s === 'warnings';
  });

  const hasErrors = [...PHASE_1_TABS, ...PHASE_2_TABS].some((t) => tabStates[t].status === 'errors');

  const totalErrors   = Object.values(tabStates).reduce((s, t) => s + (t.result?.errors.length ?? 0), 0);
  const totalWarnings = Object.values(tabStates).reduce((s, t) => s + (t.result?.warnings.length ?? 0), 0);
  const totalRows     = Object.values(tabStates).reduce((s, t) => s + (t.result?.rowCount ?? 0), 0);

  const phase1Passed = PHASE_1_TABS.filter((t) => tabStates[t].status !== 'errors').length;
  const phase2Passed = PHASE_2_TABS.filter((t) => tabStates[t].status !== 'errors' && tabStates[t].status !== 'locked').length;
  const phase2Done   = phase1Done && PHASE_2_TABS.every((t) => tabStates[t].status !== 'locked');

  return (
    <div className="space-y-6">
      {/* Missing tabs warning */}
      {missingTabs.length > 0 && (
        <Card className="border-warning-border bg-warning-light">
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-warning">
            <AlertTriangle size={16} className="shrink-0" />
            ไม่พบแท็บ:{' '}
            <span className="font-semibold">{missingTabs.join(', ')}</span>
            {' '}— ตรวจสอบชื่อแท็บใน Google Sheet
          </CardContent>
        </Card>
      )}

      {/* Phase 1 */}
      <div className="space-y-3">
        <SectionHeader
          title="PHASE 1 — ตรวจโครงสร้าง"
          counter={phase1Done ? { current: phase1Passed, total: 4 } : undefined}
          status={phase1Done && phase1Passed === 4 ? 'success' : phase1Done ? 'danger' : 'neutral'}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASE_1_TABS.map((tab) => (
            <TabCard key={tab} tabName={tab} state={tabStates[tab]} onClick={onTabClick} />
          ))}
        </div>
      </div>

      {/* Phase 2 */}
      <div className="space-y-3">
        <SectionHeader
          title="PHASE 2 — ตรวจความสัมพันธ์"
          counter={phase2Done ? { current: phase2Passed, total: 4 } : undefined}
          status={phase2Done && phase2Passed === 4 ? 'success' : phase2Done ? 'danger' : 'neutral'}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASE_2_TABS.map((tab) => (
            <TabCard key={tab} tabName={tab} state={tabStates[tab]} onClick={onTabClick} />
          ))}
        </div>
      </div>

      {/* Validate button */}
      <Button
        onClick={onValidate}
        disabled={isRunning}
        size="full"
        data-testid="main-validate-button"
      >
        {isRunning ? (
          <><Loader2 size={16} className="animate-spin" /> กำลังตรวจสอบ...</>
        ) : (
          <><Play size={16} /> ตรวจสอบข้อมูลทั้งหมด</>
        )}
      </Button>

      {/* Summary + submit */}
      {phase1Done && !isRunning && (
        <Card className={cn(
          'border',
          hasErrors ? 'border-danger-border bg-danger-light' : 'border-success-border bg-success-light',
        )}>
          <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-foreground-muted">{totalRows} แถว</span>
              <span className={totalErrors > 0 ? 'text-danger font-semibold' : 'text-success'}>{totalErrors} ข้อผิดพลาด</span>
              <span className={totalWarnings > 0 ? 'text-warning font-semibold' : 'text-foreground-muted'}>{totalWarnings} คำเตือน</span>
            </div>
            <SubmitButton allPassed={allPassed} hasErrors={hasErrors} onSubmit={onSubmit} isSubmitting={isSubmitting} />
          </CardContent>
          {totalWarnings > 0 && !hasErrors && (
            <p className="text-xs text-warning px-4 pb-3 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              คำเตือนจะไม่บล็อคการส่ง แต่อาจมีผลกับการจัดตาราง
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function SubmitButton({
  allPassed,
  hasErrors,
  onSubmit,
  isSubmitting,
}: {
  allPassed: boolean;
  hasErrors: boolean;
  onSubmit?: () => void;
  isSubmitting: boolean;
}) {
  if (hasErrors) {
    return (
      <Button variant="outline" disabled size="sm">
        <Send size={14} /> ส่งข้อมูล (ปิดใช้งาน)
      </Button>
    );
  }
  if (!allPassed) return null;
  return (
    <Button variant="success" size="sm" onClick={onSubmit} disabled={isSubmitting}>
      {isSubmitting ? (
        <><Loader2 size={14} className="animate-spin" /> กำลังส่ง...</>
      ) : (
        <><Send size={14} /> ส่งข้อมูลสร้างตาราง</>
      )}
    </Button>
  );
}
