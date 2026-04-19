'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import AdminHeader from '../../_components/AdminHeader';
import SheetConnector from './_components/SheetConnector';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import { useValidation } from './_hooks/useValidation';
import { useGoogleSheet } from './_hooks/useGoogleSheet';
import { TabName } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import DevTestPanel from './_components/DevTestPanel';
import { submitScheduleJob, getJobStatus } from '@/lib/api/scheduleApi';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';
import { stripMarkerRows } from './_utils/csvHelpers';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  const { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, clearSheet, loadData, updateTabRow } = useGoogleSheet();
  const { tabStates, isRunning, runValidation, resetStates } = useValidation(sheetData);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    name: '',
    semester: 1,
    year: 2568,
  });

  const [connectedSheetId, setConnectedSheetId] = useState<string | null>(null);
  const [connectedSheetUrl, setConnectedSheetUrl] = useState<string | null>(null);

  const [openTab, setOpenTab] = useState<TabName | null>(null);
  const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'completed' | 'failed'>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [isDev, setIsDev] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  useEffect(() => { setIsDev(process.env.NODE_ENV === 'development'); }, []);

  // When navigating to an existing job (non-new), check its current status
  useEffect(() => {
    if (!id || id === 'new') return;
    getJobStatus(id)
      .then((job) => {
        if (job.status === 'completed') {
          setJobId(id);
          setGenerationState('completed');
        } else if (job.status === 'failed') {
          setJobId(id);
          setGenerationError(job.error ?? 'สร้างตารางไม่สำเร็จ');
          setGenerationState('failed');
        } else if (job.status !== 'created') {
          // in progress
          setJobId(id);
          setGenerationState('generating');
        }
      })
      .catch(() => { /* job may not exist yet, show normal UI */ });
  }, [id]);

  const handleCreateSkeleton = useCallback(async () => {
    setIsCreatingSheet(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      const res = await fetch('/api/sheets/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          title: sessionInfo.name?.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'สร้าง Google Sheet ไม่สำเร็จ');

      const sheetId = body.spreadsheetId as string | undefined;
      const sheetUrl = body.spreadsheetUrl as string | undefined;
      if (!sheetId || !sheetUrl) throw new Error('ไม่พบข้อมูลชีทที่สร้างใหม่');

      setConnectedSheetId(sheetId);
      setConnectedSheetUrl(sheetUrl);
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error('[handleCreateSkeleton]', err);
      const templateId = process.env.NEXT_PUBLIC_GOOGLE_TEMPLATE_SHEET_ID;
      if (templateId) {
        window.open(`https://docs.google.com/spreadsheets/d/${templateId}/copy`, '_blank');
        return;
      }
      window.alert('สร้าง Google Sheet ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreatingSheet(false);
    }
  }, [sessionInfo.name]);

  const handleConnectSkeleton = useCallback(() => {
    if (!connectedSheetId) return;
    clearSheet();
    resetStates();
    fetchSheet(connectedSheetId);
  }, [connectedSheetId, clearSheet, resetStates, fetchSheet]);

  const handleConnectImport = useCallback((sheetId: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    setConnectedSheetId(sheetId);
    setConnectedSheetUrl(url);
    window.open(url, '_blank');
    clearSheet();
    resetStates();
    fetchSheet(sheetId);
  }, [clearSheet, resetStates, fetchSheet]);

  const handleValidate = useCallback(async () => {
    resetStates();
    if (connectedSheetId) {
      const result = await fetchSheet(connectedSheetId);
      if (result) runValidation(result.data);
    } else {
      runValidation(sheetData);
    }
  }, [connectedSheetId, sheetData, resetStates, fetchSheet, runValidation]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setGenerationState('generating');
    setJobId(null);
    setDownloadUrl(null);
    try {
      // Get the backend user_id for associating the job
      let backendUserId: string | undefined;
      try {
        const syncRes = await fetch('/api/user/sync', { method: 'POST' });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          backendUserId = syncData.user_id ?? undefined;
        }
      } catch { /* non-fatal */ }

      const toFile = (rows: Array<string[]> | undefined, name: string) => {
        if (!rows || rows.length === 0) return undefined;
        // Strip empty rows and marker rows before export
        let cleanRows = rows.filter(row => !row.every(c => !String(c).trim()));
        cleanRows = stripMarkerRows(cleanRows);
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
        userId: backendUserId,
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
      setGenerationError(e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setGenerationState('failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionInfo, sheetData]);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="mb-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">กลับไปแดชบอร์ด</span>
          </button>
          <h2 className="text-2xl font-bold text-foreground">สร้างตารางสอนใหม่</h2>
          <p className="text-foreground-muted text-sm mt-1">เชื่อมต่อ Google Sheet กรอกข้อมูล แล้วตรวจสอบก่อนสร้างตาราง</p>
        </div>

        <SessionInfoCard value={sessionInfo} onChange={setSessionInfo} />

        <SheetConnector
          fetchStatus={fetchStatus}
          fetchError={fetchError}
          connectedSheetId={connectedSheetId}
          connectedSheetUrl={connectedSheetUrl}
          isCreatingSheet={isCreatingSheet}
          onCreateSkeleton={handleCreateSkeleton}
          onConnectImport={handleConnectImport}
          onConnectSkeleton={handleConnectSkeleton}
        />

        {isDev && (
          <DevTestPanel
            currentData={sheetData}
            onDataLoaded={(data) => {
              loadData(data);
              resetStates();
            }}
            onClear={() => {
              clearSheet();
              resetStates();
            }}
          />
        )}

        {generationState === 'idle' && (
          <ValidationSection
            tabStates={tabStates}
            isRunning={isRunning}
            missingTabs={missingTabs}
            onValidate={handleValidate}
            onTabClick={setOpenTab}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {generationState !== 'idle' && (
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
          isRunning={isRunning}
        />
      </main>
    </div>
  );
}
