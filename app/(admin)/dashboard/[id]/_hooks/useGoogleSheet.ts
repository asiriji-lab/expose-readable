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
  loadData: (data: SheetData) => void;
  clearSheet: () => void;
  updateTabRow: (tabName: TabName, rowIndex: number, key: string, value: string) => void;
}

export function useGoogleSheet(): UseGoogleSheetReturn {
  const [sheetData, setSheetData] = useState<SheetData>({});
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [missingTabs, setMissingTabs] = useState<TabName[]>([]);

  const fetchSheet = useCallback(async (spreadsheetId: string) => {
    setFetchStatus('fetching');
    setFetchError(null);

    try {
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

      const missing = ALL_TAB_NAMES.filter((t) => !result[t]);
      setMissingTabs(missing);
      setSheetData(result);
      setFetchStatus('success');
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Unknown error');
      setFetchStatus('error');
    }
  }, []);

  const loadData = useCallback((data: SheetData) => {
    const missing = ALL_TAB_NAMES.filter((t) => !data[t]);
    setMissingTabs(missing);
    setSheetData(data);
    setFetchStatus('success');
    setFetchError(null);
  }, []);

  const clearSheet = useCallback(() => {
    setSheetData({});
    setFetchStatus('idle');
    setFetchError(null);
    setMissingTabs([]);
  }, []);

  /**
   * Edit a single cell in the in-memory sheet data.
   * rowIndex is 0-based into parsedRows (i.e. raw row index + 1 to skip header).
   */
  const updateTabRow = useCallback((tabName: TabName, rowIndex: number, key: string, value: string) => {
    setSheetData((prev) => {
      const tab = prev[tabName];
      if (!tab) return prev;
      const headers = tab[0];
      const colIdx = headers.indexOf(key);
      if (colIdx === -1) return prev;
      const newTab = tab.map((r, ri) => {
        if (ri !== rowIndex + 1) return r; // +1 to skip header row
        const newRow = [...r];
        newRow[colIdx] = value;
        return newRow;
      });
      return { ...prev, [tabName]: newTab };
    });
  }, []);

  return { sheetData, fetchStatus, fetchError, missingTabs, fetchSheet, loadData, clearSheet, updateTabRow };
}