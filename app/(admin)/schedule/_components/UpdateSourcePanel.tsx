'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { ExternalLink, RefreshCw, Calendar, X, AlertCircle } from 'lucide-react';
import { EntityMeta } from '../_types/schedule.types';
import {
    extractSheetId,
    fetchAllPublicTabs,
    stripMarkerRows,
    ALL_TAB_NAMES,
} from '../../dashboard/[id]/_utils/csvHelpers';

interface UpdateSourcePanelProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    sheetUrl: string | null;
    onMetaRefreshed: (meta: EntityMeta) => void;
}

type PanelStatus = 'idle' | 'fetching-sheet' | 'uploading' | 'done' | 'error';

export default function UpdateSourcePanel({
    isOpen,
    onClose,
    jobId,
    sheetUrl,
    onMetaRefreshed,
}: UpdateSourcePanelProps) {
    const [status, setStatus] = useState<PanelStatus>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleRefreshMeta = async () => {
        setError(null);
        setStatus('fetching-sheet');
        setStatusMsg('Fetching data from Google Sheets…');

        // ── 1. Parse sheet ID ──────────────────────────────────────────────────
        const sheetId = sheetUrl ? extractSheetId(sheetUrl) : null;
        if (!sheetId) {
            setError('No valid Google Sheet URL is linked to this schedule.');
            setStatus('error');
            return;
        }

        // ── 2. Fetch all tabs from the sheet ───────────────────────────────────
        let sheetData: Awaited<ReturnType<typeof fetchAllPublicTabs>>['data'];
        try {
            const result = await fetchAllPublicTabs(sheetId);
            sheetData = result.data;
            if (result.missingTabs.length > 0) {
                setStatusMsg(`Fetched — missing tabs: ${result.missingTabs.join(', ')}. Continuing…`);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to fetch Google Sheet data');
            setStatus('error');
            return;
        }

        if (!sheetData.curriculum) {
            setError("'curriculum' tab not found in the sheet — it is required.");
            setStatus('error');
            return;
        }

        // ── 3. Convert tab data to CSV File objects ────────────────────────────
        setStatus('uploading');
        setStatusMsg('Sending data to server…');

        const form = new FormData();
        for (const tabName of ALL_TAB_NAMES) {
            const rows = sheetData[tabName];
            if (!rows || rows.length === 0) continue;
            const stripped = stripMarkerRows(rows, tabName);
            const csv = Papa.unparse(stripped);
            const file = new File([csv], `${tabName}.csv`, { type: 'text/csv' });
            form.append(tabName, file, `${tabName}.csv`);
        }

        // ── 4. POST to backend ─────────────────────────────────────────────────
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://dev.winscloud.net/api/v1';
            const res = await fetch(
                `${API_URL}/schedules/${encodeURIComponent(jobId)}/refresh-meta`,
                { method: 'POST', body: form },
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Server error');

            onMetaRefreshed(data.entity_meta as EntityMeta);
            setStatus('done');
            setStatusMsg('Metadata updated successfully.');
            setTimeout(onClose, 1200);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update metadata');
            setStatus('error');
        }
    };

    const isBusy = status === 'fetching-sheet' || status === 'uploading';

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-surface rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-surface-alt border-b border-border px-5 py-3.5 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-foreground">Update Google Sheet</p>
                        <p className="text-xs text-foreground-muted">Pull latest data from the linked sheet</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-foreground-muted hover:bg-surface hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Sheet URL row */}
                <div className="px-5 pt-4 pb-3">
                    <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wide mb-1.5">
                        Linked Sheet
                    </p>
                    {sheetUrl ? (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 py-2">
                            <span className="text-xs text-foreground truncate flex-1 min-w-0">{sheetUrl}</span>
                            <a
                                href={sheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 text-primary hover:text-primary-hover transition-colors"
                                title="Open in Google Sheets"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <span className="text-xs text-amber-700">No Google Sheet linked to this schedule.</span>
                        </div>
                    )}
                </div>

                {/* Status message */}
                {(status !== 'idle' && status !== 'error') && (
                    <div className="px-5 pb-2">
                        <p className={`text-xs ${status === 'done' ? 'text-emerald-600' : 'text-foreground-muted'}`}>
                            {statusMsg}
                        </p>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="px-5 pb-3">
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{error}</p>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="px-5 pb-5 flex flex-col gap-2">
                    <div className="my-1 border-t border-border" />

                    {/* Refresh Metadata */}
                    <button
                        onClick={handleRefreshMeta}
                        disabled={isBusy || !sheetUrl}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <RefreshCw className={`w-4 h-4 text-emerald-600 ${isBusy ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Refresh Metadata</p>
                            <p className="text-[11px] text-foreground-muted">Re-compute teachers, classes &amp; rooms from sheet</p>
                        </div>
                    </button>

                    {/* Reschedule — placeholder */}
                    <button
                        disabled
                        title="Coming soon — runs a new GA pass with the updated input data"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface opacity-40 cursor-not-allowed text-left"
                    >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Reschedule</p>
                            <p className="text-[11px] text-foreground-muted">Re-run the GA with updated input — coming soon</p>
                        </div>
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
