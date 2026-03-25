'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import AdminHeader from '../../_components/AdminHeader';
import SheetEmbed from './_components/SheetEmbed';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import { useValidation } from './_hooks/useValidation';
import { useGoogleSheet } from './_hooks/useGoogleSheet';
import { TabName } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import DevTestPanel from './_components/DevTestPanel';
import { PageShell } from '@/components/layout/page-shell';
import { PageHeader } from '@/components/layout/page-header';

export default function SessionDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  const { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, loadData, clearSheet, updateTabRow } = useGoogleSheet();
  const { tabStates, isRunning, runValidation, resetStates } = useValidation(sheetData);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    name: '',
    semester: 1,
    year: 2568,
  });

  const [openTab, setOpenTab] = useState<TabName | null>(null);
  const [generationState, _setGenerationState] = useState<
    'idle' | 'generating' | 'completed' | 'failed'
  >('idle');

  function handleFetchSheet(spreadsheetId: string) {
    clearSheet();
    resetStates();
    fetchSheet(spreadsheetId);
  }

  return (
    <PageShell header={<AdminHeader />}>
      <PageHeader
        title="นำเข้าข้อมูลตารางสอน"
        description="เชื่อมต่อ Google Sheet ที่มีข้อมูล 8 แท็บ แล้วตรวจสอบก่อนสร้างตาราง"
        breadcrumb={[
          { label: 'รายการตารางสอน', href: '/dashboard' },
          { label: 'นำเข้าข้อมูล' },
        ]}
      />

      {/* Session info */}
      <SessionInfoCard value={sessionInfo} onChange={setSessionInfo} />

      {/* Google Sheet connection */}
      <SheetEmbed
        fetchStatus={fetchStatus}
        fetchError={fetchError}
        onFetch={handleFetchSheet}
      />

      {/* Dev testing panel — only in development */}
      {process.env.NODE_ENV === 'development' && (
        <DevTestPanel
          currentData={sheetData}
          onDataLoaded={(data) => { loadData(data); resetStates(); }}
          onClear={() => { clearSheet(); resetStates(); }}
        />
      )}

      {/* Validation section */}
      {generationState === 'idle' && (
        <ValidationSection
          tabStates={tabStates}
          isRunning={isRunning}
          missingTabs={missingTabs}
          onValidate={runValidation}
          onTabClick={setOpenTab}
        />
      )}

      {/* Generation status */}
      {generationState !== 'idle' && (
        <GenerationStatus state={generationState} sessionId={id} />
      )}

      {/* Error panel slide-over */}
      <ErrorPanel
        open={openTab !== null}
        tabName={openTab ?? 'period'}
        state={openTab ? tabStates[openTab] : tabStates['period']}
        sheetUrl=""
        onClose={() => setOpenTab(null)}
        onCellChange={(rowIndex, key, value) => {
          if (openTab) updateTabRow(openTab, rowIndex, key, value);
        }}
        onRevalidate={runValidation}
        isRunning={isRunning}
      />
    </PageShell>
  );
}