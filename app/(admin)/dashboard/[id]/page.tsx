'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AdminHeader from '../../_components/AdminHeader';
import SheetConnector from './_components/SheetConnector';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import { useSimpleValidation } from './_hooks/useSimpleValidation';
import { useGoogleSheet } from './_hooks/useGoogleSheet';
import { TabName, AllTabStates } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import { PageShell } from '@/components/layout/page-shell';
import { PageHeader } from '@/components/layout/page-header';

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
  const { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, clearSheet, updateTabRow } = useGoogleSheet();
  const { tabStates, isRunning, runValidation, resetStates } = useSimpleValidation(sheetData);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ── Handlers ──

  const handleCreateSkeleton = useCallback(() => {
    const templateId = process.env.NEXT_PUBLIC_GOOGLE_TEMPLATE_SHEET_ID;
    if (!templateId) return;
    window.open(`https://docs.google.com/spreadsheets/d/${templateId}/copy`, '_blank');
  }, []);

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
    if (!connectedSheetId) return;
    resetStates();
    const result = await fetchSheet(connectedSheetId);
    if (result) runValidation(result.data);
  }, [connectedSheetId, resetStates, fetchSheet, runValidation]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setGenerationState('generating');
    setJobId(null);
    setDownloadUrl(null);
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: sessionInfo,
          data: buildExportData(tabStates),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scheduler error');
      setJobId(data.job_id ?? null);
      setDownloadUrl(data.download_url ?? null);
    } catch (e) {
      console.error('[handleSubmit]', e);
      setGenerationState('failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionInfo, tabStates]);

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
