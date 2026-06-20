'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import AdminHeader from '../../_components/AdminHeader';
import InputPanel from './_components/InputPanel';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import WizardStepper, { WizardStep } from './_components/WizardStepper';
import { Button } from '@/components/ui/button';
import { useValidation } from './_hooks/useValidation';
import { useGoogleSheet } from './_hooks/useGoogleSheet';
import { TabName } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import { submitScheduleJob, getScheduleRecord } from '@/lib/api/scheduleApi';
import Papa from 'papaparse';
import { stripMarkerRows } from './_utils/csvHelpers';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  const { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, clearSheet, loadData, updateTabRow } = useGoogleSheet();
  const { tabStates, isRunning, runValidation, resetStates, allPassed } = useValidation(sheetData);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    name: '',
    semester: 1,
    year: 2568,
  });

  const [connectedSheetId, setConnectedSheetId] = useState<string | null>(null);
  const [connectedSheetUrl, setConnectedSheetUrl] = useState<string | null>(null);
  const connectedSheetUrlRef = useRef<string | null>(null);
  
  const setSheetUrl = useCallback((url: string | null) => {
    connectedSheetUrlRef.current = url;
    setConnectedSheetUrl(url);
  }, []);

  const [openTab, setOpenTab] = useState<TabName | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'completed' | 'failed'>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // When navigating to an existing job (non-new), load status + sheet_url from DB
  useEffect(() => {
    if (!id || id === 'new') return;
    getScheduleRecord(id)
      .then((res) => {
        const job = res.schedule;
        // Reopened jobs (in-progress, completed, or failed) jump straight to the Generate step.
        setCurrentStep(4);
        if (job.status === 'completed') {
          setJobId(id);
          setGenerationState('completed');
        } else if (job.status === 'failed') {
          setJobId(id);
          setGenerationError(job.error ?? 'สร้างตารางไม่สำเร็จ');
          setGenerationState('failed');
        } else {
          setJobId(id);
          setGenerationState('generating');
          if (job.sheet_url) {
            const sheetId = job.sheet_url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? null;
            setSheetUrl(job.sheet_url);
            setConnectedSheetId(sheetId);
            if (sheetId) fetchSheet(sheetId);
          }
        }
      })
      .catch(() => { /* ignore */ });
  }, [id, fetchSheet, setSheetUrl]);

  const handleCreateSkeleton = useCallback(async () => {
    setIsCreatingSheet(true);
    try {
      const res = await fetch('/api/sheets/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sessionInfo.name?.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      
      // If it's a quota error, open the manual copy link instead of showing an error
      if (res.status === 403 && body.fallbackUrl) {
        window.open(body.fallbackUrl, '_blank');
        setIsCreatingSheet(false);
        return;
      }

      if (!res.ok) throw new Error(body.error ?? 'สร้าง Google Sheet ไม่สำเร็จ');

      const sheetId = body.spreadsheetId as string | undefined;
      const sheetUrl = body.spreadsheetUrl as string | undefined;
      if (!sheetId || !sheetUrl) throw new Error('ไม่พบข้อมูลชีทที่สร้างใหม่');

      setConnectedSheetId(sheetId);
      setSheetUrl(sheetUrl);
      // Immediately fetch data from the new sheet to update status cards
      fetchSheet(sheetId);
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error('[handleCreateSkeleton]', err);
      window.alert('สร้าง Google Sheet ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreatingSheet(false);
    }
  }, [sessionInfo.name, setSheetUrl, fetchSheet]);

  const handleConnectImport = useCallback((sheetId: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    setConnectedSheetId(sheetId);
    setSheetUrl(url);
    // Don't clearSheet() or fetchSheet() here — DataCommandCenter already
    // loaded the data via onDataLoaded before calling this callback.
    // Only reset validation state so it can re-run on the fresh data.
    resetStates();
  }, [resetStates, setSheetUrl]);

  const handleValidate = useCallback(async () => {
    setIsFetchingSheet(true);
    resetStates();
    if (connectedSheetId) {
      const result = await fetchSheet(connectedSheetId);
      setIsFetchingSheet(false);
      if (result) runValidation(result.data);
    } else {
      setIsFetchingSheet(false);
      runValidation(sheetData);
    }
  }, [connectedSheetId, sheetData, resetStates, fetchSheet, runValidation]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setGenerationState('generating');
    setJobId(null);
    setDownloadUrl(null);
    try {

      const toFile = (rows: Array<string[]> | undefined, name: string) => {
        if (!rows || rows.length === 0) return undefined;
        let cleanRows = rows.filter(row => !row.every(c => !String(c).trim()));
        cleanRows = stripMarkerRows(cleanRows, name);
        if (cleanRows.length === 0) return undefined;

        if (name === 'student') {
          cleanRows = cleanRows.map((row, idx) => {
            if (idx === 0) return row;
            const newRow = [...row];
            let classId = String(newRow[0]);
            if (/^\d+\/\d+\/\d+$/.test(classId)) {
              classId = classId.split('/').slice(0, 2).join('/');
            } else if (/^\d+-[A-Za-z]+(-\d+)?$/.test(classId)) {
              const parts = classId.split('-');
              const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
              const m = months[parts[1].toLowerCase().substring(0, 3)];
              if (m) classId = `${parts[0]}/${m}`;
            }
            newRow[0] = classId;
            return newRow;
          });
        }

        const csv = Papa.unparse(cleanRows);
        return new File([csv], `${name}.csv`, { type: 'text/csv' });
      };

      const submitParams: Parameters<typeof submitScheduleJob>[0] = {
        curriculum: toFile(sheetData.curriculum, 'curriculum')!,
        room: toFile(sheetData.room, 'room')!,
        jobName: sessionInfo.name,
        academicYear: String(sessionInfo.year),
        semester: sessionInfo.semester,
        sheetUrl: connectedSheetUrlRef.current ?? undefined,
      };

      if (sheetData.elective?.length) submitParams.elective = toFile(sheetData.elective, 'elective');
      if (sheetData.teacher?.length) submitParams.teacher = toFile(sheetData.teacher, 'teacher');
      if (sheetData.period?.length) submitParams.period = toFile(sheetData.period, 'period');
      if (sheetData.student?.length) submitParams.student = toFile(sheetData.student, 'student');
      if (sheetData.preplace?.length) submitParams.preplace = toFile(sheetData.preplace, 'preplace');
      if (sheetData.scout?.length) submitParams.scout = toFile(sheetData.scout, 'scout');

      const res = await submitScheduleJob(submitParams);
      setJobId(res.job_id);
      setDownloadUrl(res.download_url ?? null);
    } catch (e: any) {
      console.error('[handleSubmit]', e);
      setGenerationError(e?.message || 'เกิดข้อผิดพลาดในการสร้างตาราง');
      setGenerationState('failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionInfo, sheetData]);

  // ── Wizard steps & per-step gating ──
  const WIZARD_STEPS: WizardStep[] = [
    { key: 'session', label: 'ข้อมูลตาราง' },
    { key: 'data', label: 'นำเข้าข้อมูล' },
    { key: 'validate', label: 'ตรวจสอบข้อมูล' },
    { key: 'generate', label: 'สร้างตาราง' },
  ];

  const isGenerating = generationState === 'generating';

  // Step 2 requires the same mandatory tabs that handleSubmit treats as non-optional.
  const requiredTabsLoaded = !!sheetData.curriculum && !!sheetData.room;

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 1: return sessionInfo.name.trim().length > 0;
      case 2: return requiredTabsLoaded;
      case 3: return allPassed;
      default: return false;
    }
  }, [currentStep, sessionInfo.name, requiredTabsLoaded, allPassed]);

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminHeader />
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="mb-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium font-bold">กลับไปแดชบอร์ด</span>
          </button>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">จัดการข้อมูลตารางสอน</h2>
          <p className="text-foreground-muted text-sm mt-1">ทำตามขั้นตอนเพื่อนำเข้าข้อมูล ตรวจสอบ และสร้างตารางสอน</p>
        </div>

        {/* Wizard progress indicator */}
        <WizardStepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={isGenerating ? undefined : setCurrentStep}
        />

        {/* ── Step 1: Session info ── */}
        {currentStep === 1 && (
          <SessionInfoCard value={sessionInfo} onChange={setSessionInfo} />
        )}

        {/* ── Step 2: Load data (Data Command Center) ── */}
        {currentStep === 2 && (
          <InputPanel
            currentData={sheetData}
            onDataLoaded={(data) => {
              loadData(data);
              resetStates();
            }}
            onClear={() => {
              clearSheet();
              resetStates();
              setConnectedSheetId(null);
              setSheetUrl(null);
            }}
            onSheetUrlConnected={handleConnectImport}
            connectedSheetId={connectedSheetId}
            connectedSheetUrl={connectedSheetUrl}
            isCreatingSheet={isCreatingSheet}
            onCreateSkeleton={handleCreateSkeleton}
            onTabClick={setOpenTab}
          />
        )}

        {/* ── Step 3: Validate ── */}
        {currentStep === 3 && (
          <ValidationSection
            tabStates={tabStates}
            isRunning={isFetchingSheet || isRunning}
            missingTabs={missingTabs}
            onValidate={handleValidate}
            onTabClick={setOpenTab}
            showSubmit={false}
          />
        )}

        {/* ── Step 4: Generate ── */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {generationState === 'idle' ? (
              <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">ตรวจทานก่อนสร้างตาราง</h3>
                  <p className="text-xs text-foreground-muted mt-1">ยืนยันข้อมูลด้านล่างแล้วกดสร้างตาราง</p>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-foreground-muted">ชื่อตาราง</dt>
                    <dd className="font-semibold text-foreground truncate">{sessionInfo.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground-muted">ภาคเรียน</dt>
                    <dd className="font-semibold text-foreground">{sessionInfo.semester}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground-muted">ปีการศึกษา</dt>
                    <dd className="font-semibold text-foreground">{sessionInfo.year}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground-muted">ข้อมูลที่โหลด</dt>
                    <dd className="font-semibold text-foreground">
                      {Object.values(sheetData).filter(Boolean).length}/8 แท็บ
                    </dd>
                  </div>
                </dl>
                <Button
                  variant="success"
                  size="full"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  data-testid="generate-button"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> กำลังส่ง...</>
                  ) : (
                    <><Send size={16} /> สร้างตารางสอน</>
                  )}
                </Button>
              </div>
            ) : (
              <GenerationStatus
                state={generationState}
                sessionId={id}
                jobId={jobId}
                downloadUrl={downloadUrl}
                errorMessage={generationError}
                onCompleted={() => setGenerationState('completed')}
                onFailed={(err) => { setGenerationError(err ?? null); setGenerationState('failed'); }}
              />
            )}
          </div>
        )}

        {/* ── Wizard navigation ── */}
        {generationState === 'idle' && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
              className={currentStep === 1 ? 'invisible' : ''}
            >
              <ChevronLeft size={16} /> ย้อนกลับ
            </Button>
            {currentStep < WIZARD_STEPS.length && (
              <Button onClick={goNext} disabled={!canAdvance} data-testid="wizard-next">
                ถัดไป <ChevronRight size={16} />
              </Button>
            )}
          </div>
        )}

        <ErrorPanel
          open={openTab !== null}
          tabName={openTab ?? 'period'}
          state={openTab ? tabStates[openTab] : tabStates['period']}
          sheetUrl={connectedSheetUrl ?? ''}
          onClose={() => setOpenTab(null)}
          onCellChange={(rowIndex, key, value) => {
            if (openTab) updateTabRow(openTab, rowIndex, key, value);
          }}
          onRevalidate={handleValidate}
          isRunning={isFetchingSheet || isRunning}
        />
      </main>
    </div>
  );
}
