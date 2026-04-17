'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AdminHeader from '../../_components/AdminHeader';
import SheetConnector from './_components/SheetConnector';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import { useValidation } from './_hooks/useValidation';
import { useGoogleSheet } from './_hooks/useGoogleSheet';
import { TabName, AllTabStates } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import DevTestPanel from './_components/DevTestPanel';
import { PageShell } from '@/components/layout/page-shell';
import { PageHeader } from '@/components/layout/page-header';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';
import { submitScheduleJob } from '@/api/schedule';

const ALL_TABS: TabName[] = ['period', 'room', 'teacher', 'student', 'preplace', 'scout', 'elective', 'curriculum'];

function buildExportData(tabStates: AllTabStates) {
  return Object.fromEntries(
    ALL_TABS.map((tab) => [tab, tabStates[tab].result?.parsedRows ?? []])
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  // ── Existing hooks ──
  const { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, clearSheet, loadData, updateTabRow } = useGoogleSheet();
  const { tabStates, isRunning, runValidation, resetStates } = useValidation(sheetData);

  // ── Session info ──
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    name: '',
    semester: 1,
    year: 2568,
  });

  // ── Sheet connection state ──
  const [connectedSheetId, setConnectedSheetId] = useState<string | null>(null);
  const [connectedSheetUrl, setConnectedSheetUrl] = useState<string | null>(null);

  // ── UI state ──
  const [openTab, setOpenTab] = useState<TabName | null>(null);
  const [generationState, setGenerationState] = useState<
    'idle' | 'generating' | 'completed' | 'failed'
  >('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ── Handlers ──

  const handleCreateSkeleton = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const adminEmail = session?.user?.email;

      const res = await fetch('/api/sheets/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail,
          title: sessionInfo.name?.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? 'สร้าง Google Sheet ไม่สำเร็จ');
      }

      const sheetId = body.spreadsheetId as string | undefined;
      const sheetUrl = body.spreadsheetUrl as string | undefined;
      if (!sheetId || !sheetUrl) {
        throw new Error('ไม่พบข้อมูลชีทที่สร้างใหม่');
      }

      setConnectedSheetId(sheetId);
      setConnectedSheetUrl(sheetUrl);
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error('[handleCreateSkeleton]', err);

      // Backward-compatible fallback for environments that still use template copy links.
      const templateId = process.env.NEXT_PUBLIC_GOOGLE_TEMPLATE_SHEET_ID;
      if (templateId) {
        window.open(`https://docs.google.com/spreadsheets/d/${templateId}/copy`, '_blank');
        return;
      }

      window.alert('สร้าง Google Sheet ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือวางลิงก์ชีทของคุณในโหมดนำเข้า');
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
      const toFile = (rows: Array<string[]> | undefined, name: string) => {
        if (!rows || rows.length === 0) return undefined;
        // Strip completely empty rows which crash the python backend
        let cleanRows = rows.filter(row => !row.every(c => !String(c).trim()));
        if (cleanRows.length === 0) return undefined;
        
        // Reverse Google Sheet's native date-mangling for student classes (e.g. 1/1/26 -> 1/1)
        if (name === 'student') {
          cleanRows = cleanRows.map((row, idx) => {
            if (idx === 0) return row; // Keep headers
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

      const params: Parameters<typeof submitScheduleJob>[0] = {
        curriculum: toFile(sheetData.curriculum, 'curriculum')!,
        room: toFile(sheetData.room, 'room')!,
        jobName: sessionInfo.name,
        academicYear: String(sessionInfo.year),
        semester: sessionInfo.semester,
      };

      if (sheetData.elective?.length) params.elective = toFile(sheetData.elective, 'elective');
      if (sheetData.teacher?.length) params.teacher = toFile(sheetData.teacher, 'teacher');
      if (sheetData.period?.length) params.period = toFile(sheetData.period, 'period');
      if (sheetData.student?.length) params.student = toFile(sheetData.student, 'student');
      if (sheetData.preplace?.length) params.preplace = toFile(sheetData.preplace, 'preplace');
      if (sheetData.scout?.length) params.scout = toFile(sheetData.scout, 'scout');

      const res = await submitScheduleJob(params);
      setJobId(res.job_id);
      setDownloadUrl(res.download_url ?? null); // might be provided in initial response or status
    } catch (e: any) {
      console.error('[handleSubmit]', e);
      setGenerationError(e?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
      setGenerationState('failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionInfo, sheetData]);

  return (
    <PageShell header={<AdminHeader />}>
      <PageHeader
        title="สร้างตารางสอนใหม่"
        description="เชื่อมต่อ Google Sheet กรอกข้อมูล แล้วตรวจสอบก่อนสร้างตาราง"
        breadcrumb={[
          { label: 'รายการตารางสอน', href: '/dashboard' },
          { label: 'สร้างตารางสอน' },
        ]}
      />

      {/* Session info */}
      <SessionInfoCard value={sessionInfo} onChange={setSessionInfo} />

      {/* Google Sheet connection (skeleton / import modes) */}
      <SheetConnector
        fetchStatus={fetchStatus}
        fetchError={fetchError}
        connectedSheetId={connectedSheetId}
        connectedSheetUrl={connectedSheetUrl}
        isCreatingSheet={false}
        onCreateSkeleton={handleCreateSkeleton}
        onConnectImport={handleConnectImport}
        onConnectSkeleton={handleConnectSkeleton}
      />

      {/* Dev testing panel — only in development */}
      {process.env.NODE_ENV === 'development' && (
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

      {/* Validation section */}
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

      {/* Generation status */}
      {generationState !== 'idle' && (
        <GenerationStatus
          state={generationState}
          sessionId={id}
          jobId={jobId}
          downloadUrl={downloadUrl}
          errorMessage={generationError}
          onCompleted={() => setGenerationState('completed')}
          onFailed={() => setGenerationState('failed')}
        />
      )}

      {/* Error panel slide-over */}
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
    </PageShell>
  );
}
