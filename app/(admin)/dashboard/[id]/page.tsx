'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import AdminHeader from '../../_components/AdminHeader';
import SheetEmbed from './_components/SheetEmbed';
import ValidationSection from './_components/ValidationSection';
import ErrorPanel from './_components/ErrorPanel';
import GenerationStatus from './_components/GenerationStatus';
import { useValidation } from './_hooks/useValidation';
import { TabName, SheetData } from '../../validators/types';
import SessionInfoCard, { SessionInfo } from './_components/SessionInfoCard';
import DevTestPanel from './_components/DevTestPanel';
import { ALL_TAB_NAMES } from './_utils/csvHelpers';
import { PageShell } from '@/components/layout/page-shell';
import { PageHeader } from '@/components/layout/page-header';

export default function SessionDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  /**
   * TODO: Fetch real session from Supabase by `id`.
   * Shape: { id, name, semester, googleSheetId, status }
   */

  // Sheet data — populated by DevTestPanel in dev, or useGoogleSheet() in prod
  const [sheetData, setSheetData] = useState<SheetData>({});
  const missingTabs = ALL_TAB_NAMES.filter((t) => !sheetData[t]);

  /**
   * TODO: Replace sheetData state with useGoogleSheet() once API is ready:
   *   const { sheetData, fetchSheet, missingTabs } = useGoogleSheet();
   */
  const { tabStates, isRunning, runValidation, resetStates } = useValidation(sheetData);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    name: '',
    semester: 1,
    year: 2568,
  });

  const [openTab, setOpenTab] = useState<TabName | null>(null);
  const [generationState, setGenerationState] = useState<
    'idle' | 'generating' | 'completed' | 'failed'
  >('idle');

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

      {/* Google Sheet setup (skeleton — coming soon) */}
      <SheetEmbed />

      {/* Dev testing panel — only in development */}
      {process.env.NODE_ENV === 'development' && (
        <DevTestPanel
          currentData={sheetData}
          onDataLoaded={(data) => { setSheetData(data); resetStates(); }}
          onClear={() => { setSheetData({}); resetStates(); }}
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

      {/* Error panel slide-over (Sheet: always rendered, controlled via open) */}
      <ErrorPanel
        open={openTab !== null}
        tabName={openTab ?? 'period'}
        state={openTab ? tabStates[openTab] : tabStates['period']}
        sheetUrl=""
        onClose={() => setOpenTab(null)}
      />
    </PageShell>
  );
}
