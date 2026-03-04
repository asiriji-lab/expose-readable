'use client';

import { useState, useCallback } from 'react';
import { SheetData, TabName } from '../../../validators/types';
import { ALL_TAB_NAMES, TAB_KEY_MAP } from '../_utils/csvHelpers';

export type FetchStatus = 'idle' | 'fetching' | 'success' | 'error';

export interface UseGoogleSheetReturn {
  sheetData: SheetData;
  fetchStatus: FetchStatus;
  fetchError: string | null;
  missingTabs: TabName[];
  fetchSheet: (spreadsheetId: string) => Promise<void>;
  clearSheet: () => void;
}

/**
 * Stub hook — replace `fetchTabData` with real Google Sheets API call
 * when the service account integration is ready.
 */
export function useGoogleSheet(): UseGoogleSheetReturn {
  const [sheetData, setSheetData] = useState<SheetData>({});
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [missingTabs, setMissingTabs] = useState<TabName[]>([]);

  const fetchSheet = useCallback(async (spreadsheetId: string) => {
    setFetchStatus('fetching');
    setFetchError(null);

    try {
      /**
       * TODO: Replace this stub with actual Google Sheets API call.
       *
       * Expected API call:
       *   GET /api/sheets?id={spreadsheetId}
       *
       * Expected response shape:
       *   {
       *     tabs: {
       *       [tabTitle: string]: string[][]   // raw rows × cols
       *     }
       *   }
       */
      const res = await fetch(`/api/sheets?id=${spreadsheetId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const json: { tabs: Record<string, string[][]> } = await res.json();

      // Map tab titles → our TabName keys
      const result: SheetData = {};
      for (const [title, rows] of Object.entries(json.tabs)) {
        const key = TAB_KEY_MAP[title.trim()];
        if (key) result[key] = rows;
      }

      // Detect missing tabs
      const missing = ALL_TAB_NAMES.filter((t) => !result[t]);
      setMissingTabs(missing);
      setSheetData(result);
      setFetchStatus('success');
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Unknown error');
      setFetchStatus('error');
    }
  }, []);

  const clearSheet = useCallback(() => {
    setSheetData({});
    setFetchStatus('idle');
    setFetchError(null);
    setMissingTabs([]);
  }, []);

  return { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, clearSheet };
}
