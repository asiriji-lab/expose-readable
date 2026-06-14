'use client';

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Trash2, Sparkles, MoreHorizontal, Save, RefreshCw, Sheet, FileSpreadsheet } from 'lucide-react';
import { exportScheduleExcel } from '@/lib/api/scheduleApi';
import ViewModeToggle from './_components/ViewModeToggle';
import TimetableGridV2 from './_components/TimetableGridV2';
import TimetableGridSkeleton from './_components/TimetableGridSkeleton';
import PaletteSidebar from './_components/PaletteSidebar';
import ScheduleDndProvider from './_components/ScheduleDndProvider';
import EditOverlay from './_components/EditOverlay';
import FilterDropdown from './_components/FilterDropdown';
import AdminHeader from '../_components/AdminHeader';
import ConflictWarningDialog, { PendingDropState } from './_components/ConflictWarningDialog';
import PreplaceWarningDialog, { PendingPreplaceState } from './_components/PreplaceWarningDialog';
import EjectionNotice from './_components/EjectionNotice';
import { computeOverlayData } from './_utils/overlayUtils';
import {
    moveItem,
    moveTeamItem,
    hasConflict,
    removeItemFromDataset,
    removeTeamItemFromDataset,
    autoEjectConflicts,
    findConflictsAtSlot,
    findConflictsForTeamItem,
    checkSwapFeasibility,
    swapItems,
    isTeamItem,
} from './_utils/scheduleLogic';
import {
    FullDataset,
    ScheduleItem,
    ScheduleData,
    ViewMode,
    OverlayCellData,
    EntityType,
    DragPayload,
    EntityMeta,
    GroupedSlots,
} from './_types/schedule.types';
import OverlayInspectPopover from './_components/OverlayInspectPopover';
import UpdateSourcePanel from './_components/UpdateSourcePanel';
import BandHoverTooltip from './_components/BandHoverTooltip';
import ClassCurriculumStrip from './_components/ClassCurriculumStrip';
import {
    transformToFullDataset,
    reconcileFullDataset,
    getTeacherCodes,
    getClassCodes,
    getRoomCodes,
    emptyDataset,
    deriveEntityMetaFromSchedule,
    BackendSchedule,
} from '@/lib/api/transform';
import MergeConflictDialog from './_components/MergeConflictDialog';
import { type MergeConflict, type SlotKey, diffDatasets, applyAutoMerge, applyResolutions } from './_utils/datasetDiff';

function parseScheduleRecord(data: unknown): FullDataset | null {
    const d = data as Record<string, unknown>;
    const raw = (d?.schedule as Record<string, unknown>)?.data ?? d?.data ?? null;
    if (!raw) return null;
    const rawAny = raw as Record<string, unknown>;
    if (Array.isArray(rawAny.teachers)) {
        const { dataset } = transformToFullDataset(raw as BackendSchedule);
        const { dataset: clean } = autoEjectConflicts(dataset);
        return clean;
    }
    return reconcileFullDataset(raw as FullDataset);
}

function SchedulePageContent() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [jobName, setJobName] = useState('ตารางสอน');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [dataset, setDataset] = useState<FullDataset | null>(null);
    const [groupedSlots, setGroupedSlots] = useState<GroupedSlots>({});
    const [entityMeta, setEntityMeta] = useState<EntityMeta | null>(null);
    const [scheduleColumns, setScheduleColumns] = useState<Array<{ key: string; label: string; time?: string }>>([]);
    const [sheetUrl, setSheetUrl] = useState<string | null>(null);
    const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(false);

    const baseDatasetRef = useRef<FullDataset | null>(null);
    const [pendingMergeConflicts, setPendingMergeConflicts] = useState<MergeConflict[]>([]);
    const [pendingServerDataset, setPendingServerDataset] = useState<FullDataset | null>(null);
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ─── Dirty / save-guard ───────────────────────────────────────────────────
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // ─── Conflict warning dialog ──────────────────────────────────────────────
    const [pendingDrop, setPendingDrop] = useState<PendingDropState | null>(null);

    // ─── Preplace warning dialog ──────────────────────────────────────────────
    const [pendingPreplaceDrop, setPendingPreplaceDrop] = useState<PendingPreplaceState | null>(null);

    // ─── Ejection notice (non-dismissing, undo support) ───────────────────────
    const [ejectionNotice, setEjectionNotice] = useState<{
        ejected: ScheduleItem[];
        previousDataset: FullDataset;
    } | null>(null);

    // ─── Derived filter options ───────────────────────────────────────────────
    const teacherCodes = useMemo(() => dataset ? getTeacherCodes(dataset) : [], [dataset]);
    const classCodes = useMemo(() => dataset ? getClassCodes(dataset) : [], [dataset]);
    const roomCodes = useMemo(() => dataset ? getRoomCodes(dataset) : [], [dataset]);

    // ─── Filter state ─────────────────────────────────────────────────────────
    const [tCode, setTCode] = useState('');
    const [classCode, setClassCode] = useState('');
    const [room, setRoom] = useState('');

    useEffect(() => {
        if (teacherCodes.length) setTCode(c => teacherCodes.includes(c) ? c : teacherCodes[0]);
    }, [teacherCodes]);
    useEffect(() => {
        if (classCodes.length) setClassCode(c => classCodes.includes(c) ? c : classCodes[0]);
    }, [classCodes]);
    useEffect(() => {
        if (roomCodes.length) setRoom(r => roomCodes.includes(r) ? r : roomCodes[0]);
    }, [roomCodes]);

    // ─── Active entity ────────────────────────────────────────────────────────
    const [activeEntity, setActiveEntity] = useState<EntityType>('teacher');
    const handleTCodeChange = (val: string) => { setTCode(val); setActiveEntity('teacher'); };
    const handleClassChange = (val: string) => { setClassCode(val); setActiveEntity('class'); };
    const handleRoomChange = (val: string) => { setRoom(val); setActiveEntity('room'); };

    // ─── Load schedule on mount ───────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');

        if (scheduleId) {
            const loadSchedule = async () => {
                try {
                    const cachedDataset = sessionStorage.getItem(`schedule_dataset_cache_${scheduleId}`);
                    const cachedMeta = sessionStorage.getItem(`entity_meta_cache_${scheduleId}`);
                    const cachedSheetUrl = sessionStorage.getItem(`sheet_url_cache_${scheduleId}`);

                    console.log('[load] keys in storage:', {
                        hasDatasetCache: !!cachedDataset,
                        hasRawCache: !!sessionStorage.getItem(`schedule_cache_${scheduleId}`),
                        hasMeta: !!cachedMeta,
                    });

                    // Post-save cache: already-transformed FullDataset — skip transform entirely
                    if (cachedDataset) {
                        try {
                            const { dataset: ds, groupedSlots: gs, columns: cols } = JSON.parse(cachedDataset) as { dataset: FullDataset; groupedSlots: GroupedSlots; columns?: Array<{ key: string; label: string; time?: string }> };
                            console.log('[load] HIT dataset cache — teachers type:', Array.isArray((ds as any).teachers) ? 'array(OLD)' : 'object(new)', 'keys:', Object.keys((ds as any).teachers ?? {}).slice(0, 3));
                            setDataset(ds);
                            setGroupedSlots(gs ?? {});
                            setScheduleColumns(cols ?? []);
                            if (cachedMeta) setEntityMeta(JSON.parse(cachedMeta) as EntityMeta);
                            if (cachedSheetUrl) setSheetUrl(cachedSheetUrl);
                            baseDatasetRef.current = ds;
                            return;
                        } catch {
                            // Corrupted — clear and fall through to network fetch
                            sessionStorage.removeItem(`schedule_dataset_cache_${scheduleId}`);
                        }
                    }

                    // Original raw BackendSchedule cache — needs transform
                    const cached = sessionStorage.getItem(`schedule_cache_${scheduleId}`);
                    if (cached) {
                        try {
                            console.log('[load] HIT raw cache (BackendSchedule) — this is OLD format');
                            const raw = JSON.parse(cached) as BackendSchedule;
                            const { dataset: transformed, groupedSlots: gs } = transformToFullDataset(raw);
                            const { dataset: clean } = autoEjectConflicts(transformed);
                            setDataset(clean);
                            setGroupedSlots(gs);
                            setScheduleColumns(raw.config?.columns ?? []);
                            setJobName(raw.config?.academic_year || 'ตารางสอน');
                            if (cachedMeta) setEntityMeta(JSON.parse(cachedMeta) as EntityMeta);
                            if (cachedSheetUrl) setSheetUrl(cachedSheetUrl);
                            baseDatasetRef.current = clean;
                            return;
                        } catch {
                            // Corrupted (e.g. wrong format from old save bug) — clear and fall through
                            sessionStorage.removeItem(`schedule_cache_${scheduleId}`);
                        }
                    }

                    console.log('[load] MISS all caches — fetching from network');
                    const res = await fetch(`/api/schedule/record?schedule_id=${encodeURIComponent(scheduleId)}`, { cache: 'no-store' });
                    const data = await res.json();

                    if (!res.ok) throw new Error(data?.error ?? 'Backend error');

                    // Try multiple response shapes the backend may return
                    const raw: BackendSchedule | null =
                        data.schedule?.data ??   // { schedule: { data: BackendSchedule } }
                        data.data ??             // { data: BackendSchedule }
                        null;
                    let meta: EntityMeta | null =
                        data.schedule?.entity_meta ??
                        data.entity_meta ??
                        null;

                    if (raw) {
                        const rawAny = raw as any;
                        let transformed: FullDataset;
                        let gs: GroupedSlots;

                        if (Array.isArray(rawAny.teachers)) {
                            console.log('[load] network: teachers is ARRAY → BackendSchedule, running transform');
                            // Normal BackendSchedule (arrays) — transform + conflict-eject required
                            ({ dataset: transformed, groupedSlots: gs } = transformToFullDataset(raw));
                            if (!meta) {
                                try { meta = deriveEntityMetaFromSchedule(raw); } catch { /* non-fatal */ }
                            }
                            const { dataset: clean } = autoEjectConflicts(transformed);
                            setDataset(clean);
                            setGroupedSlots(gs);
                            setScheduleColumns(raw.config?.columns ?? []);
                            baseDatasetRef.current = clean;
                            console.log('[load] writing to schedule_cache (raw BackendSchedule)');
                            sessionStorage.setItem(`schedule_cache_${scheduleId}`, JSON.stringify(raw));
                        } else {
                            console.log('[load] network: teachers is OBJECT → FullDataset, using directly. keys:', Object.keys(rawAny.teachers ?? {}).slice(0, 3));
                            // Already FullDataset (manually saved) — reconcile only (no conflict-eject)
                            // Reconcile heals old data: fills missing class/room slots and empty teacher codes
                            const fullDataset = reconcileFullDataset(rawAny as FullDataset);
                            gs = {};
                            setDataset(fullDataset);
                            setGroupedSlots(gs);
                            setScheduleColumns((rawAny as any).config?.columns ?? []);
                            baseDatasetRef.current = fullDataset;
                            console.log('[load] writing to schedule_dataset_cache (FullDataset)');
                            sessionStorage.setItem(`schedule_dataset_cache_${scheduleId}`, JSON.stringify({ dataset: fullDataset, groupedSlots: gs, columns: (rawAny as any).config?.columns ?? [] }));
                        }
                        if (meta) {
                            setEntityMeta(meta);
                            sessionStorage.setItem(`entity_meta_cache_${scheduleId}`, JSON.stringify(meta));
                            fetch(`/api/schedule/record?schedule_id=${encodeURIComponent(scheduleId)}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ entity_meta: meta }),
                            }).catch(() => { /* non-fatal */ });
                        }
                        setJobName(data.schedule?.job_name || raw.config?.academic_year || 'ตารางสอน');
                        const fetchedSheetUrl = data.schedule?.sheet_url ?? null;
                        setSheetUrl(fetchedSheetUrl);
                        if (fetchedSheetUrl) {
                            sessionStorage.setItem(`sheet_url_cache_${scheduleId}`, fetchedSheetUrl);
                        }
                    } else {
                        console.warn('[SchedulePage] No schedule data found. Full response:', JSON.stringify(data, null, 2));
                        setDataset(emptyDataset());
                    }
                } catch (err: any) {
                    console.error('[SchedulePage] fetch result:', err);
                    setLoadError(String(err.message ?? err));
                    setDataset(emptyDataset());
                }
            };

            loadSchedule();
        } else {
            setDataset(emptyDataset());
        }
    }, []);

    // ─── Derived schedules ────────────────────────────────────────────────────
    const teacherSchedule = useMemo(() => dataset?.teachers[tCode] ?? null, [dataset, tCode]);
    const classSchedule = useMemo(() => dataset?.classes[classCode] ?? null, [dataset, classCode]);
    const roomSchedule = useMemo(() => dataset?.rooms[room] ?? null, [dataset, room]);

    const activeSchedule = useMemo<ScheduleData>(() => {
        if (viewMode === 'teacher') return teacherSchedule ?? {};
        if (viewMode === 'class') return classSchedule ?? {};
        if (viewMode === 'room') return roomSchedule ?? {};
        return {};
    }, [viewMode, teacherSchedule, classSchedule, roomSchedule]);

    const overlayData = useMemo(
        () => computeOverlayData(teacherSchedule, classSchedule, roomSchedule, dataset),
        [teacherSchedule, classSchedule, roomSchedule, dataset],
    );

    // ─── Actions menu ─────────────────────────────────────────────────────────
    const [actionsOpen, setActionsOpen] = useState(false);

    // ─── Import / Export ──────────────────────────────────────────────────────
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const jsonPayload = JSON.parse(text);
            const response = await fetch('/api/schedule/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonPayload),
            });
            if (!response.ok) throw new Error('Failed to import JSON');
            const result = await response.json();
            const payload = result.data.schedule ? result.data.schedule : result.data;
            const { dataset: transformed, groupedSlots: gs } = transformToFullDataset(payload as BackendSchedule);
            const { dataset: clean } = autoEjectConflicts(transformed);
            setDataset(clean);
            setGroupedSlots(gs);
            setJobName(payload.job_name || 'Imported Schedule');
            setIsDirty(true);
            alert('JSON imported successfully!');
        } catch (e) {
            console.error('Import error:', e);
            alert('Failed to parse or import JSON file.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExportClick = async () => {
        try {
            const exportData = {
                config: { academic_year: '2026', semester: 1 },
                teachers: dataset?.teachers ?? {},
                classes: dataset?.classes ?? {},
                rooms: dataset?.rooms ?? {},
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `schedule_export_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e) {
            console.error('Export error:', e);
            alert('Failed to export schedule.');
        }
    };

    const handleExportExcel = async () => {
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');
        if (!scheduleId) {
            alert('No schedule ID found.');
            return;
        }
        if (isDirty) {
            alert('Please save the schedule before exporting to Excel.');
            return;
        }
        try {
            await exportScheduleExcel(scheduleId, `schedule_${jobName}.xlsx`);
        } catch (e: any) {
            console.error('Export Excel error:', e);
            alert(e?.message ?? 'Failed to export Excel.');
        }
    };

    const handleDeleteJob = async () => {
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');
        if (!scheduleId) return;
        if (isDirty && !confirm('You have unsaved changes. Delete schedule without saving?')) return;
        if (!confirm('Delete this schedule? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/schedule/delete?schedule_id=${encodeURIComponent(scheduleId)}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? 'Delete failed');
            }
            router.refresh();
            router.push('/dashboard');
        } catch (e) {
            console.error('Delete error:', e);
            alert('Failed to delete schedule.');
        }
    };

    const handleSaveSchedule = async () => {
        if (isSaving) return;
        if (pendingMergeConflicts.length > 0) {
            alert(`Resolve ${pendingMergeConflicts.length} sync conflict${pendingMergeConflicts.length !== 1 ? 's' : ''} before saving.`);
            return;
        }
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');
        if (!scheduleId || !dataset) return;

        setIsSaving(true);
        try {
            const exportData = {
                config: { academic_year: '2026', semester: 1, columns: scheduleColumns },
                teachers: dataset.teachers,
                classes: dataset.classes,
                rooms: dataset.rooms,
            };
            const res = await fetch(`/api/schedule/record?schedule_id=${encodeURIComponent(scheduleId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: exportData, entity_meta: entityMeta }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? 'Save failed');
            }
            // Write already-transformed dataset cache (different format from raw BackendSchedule cache)
            sessionStorage.setItem(
                `schedule_dataset_cache_${scheduleId}`,
                JSON.stringify({ dataset, groupedSlots, columns: scheduleColumns }),
            );
            // Remove stale raw cache so it doesn't shadow the dataset cache on next load
            sessionStorage.removeItem(`schedule_cache_${scheduleId}`);
            setIsDirty(false);
            baseDatasetRef.current = structuredClone(dataset);
            alert('Schedule saved successfully.');
        } catch (e) {
            console.error('Save error:', e);
            alert('Failed to save schedule.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMetaRefreshed = (newMeta: EntityMeta) => {
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');
        setEntityMeta(newMeta);
        if (scheduleId) {
            sessionStorage.setItem(`entity_meta_cache_${scheduleId}`, JSON.stringify(newMeta));
        }
    };

    const handleCheckForUpdates = async () => {
        if (!baseDatasetRef.current || !dataset) return;
        const params = new URLSearchParams(window.location.search);
        const scheduleId = params.get('schedule_id');
        if (!scheduleId) return;
        setIsCheckingUpdates(true);
        try {
            const res = await fetch(`/api/schedule/record?schedule_id=${encodeURIComponent(scheduleId)}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? 'Fetch failed');
            const serverDataset = parseScheduleRecord(data);
            if (!serverDataset) { alert('Could not parse server data.'); return; }
            const { conflicts, autoChanges, hasChanges } = diffDatasets(baseDatasetRef.current, dataset, serverDataset);
            if (!hasChanges) { alert('Already up to date.'); return; }
            let merged = dataset;
            if (autoChanges.length > 0) {
                merged = applyAutoMerge(merged, autoChanges);
                setDataset(merged);
                baseDatasetRef.current = merged; // advance base past auto-merged slots
            }
            if (conflicts.length > 0) {
                setPendingMergeConflicts(conflicts);
                setPendingServerDataset(serverDataset);
            } else {
                baseDatasetRef.current = serverDataset;
                alert(`Synced ${autoChanges.length} change${autoChanges.length !== 1 ? 's' : ''}.`);
            }
        } catch (err: unknown) {
            alert(`Failed to check for updates: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsCheckingUpdates(false);
        }
    };

    const handleMergeComplete = (resolutions: Map<SlotKey, 'mine' | 'theirs'>) => {
        if (!dataset || !pendingServerDataset) return;
        const merged = applyResolutions(dataset, pendingMergeConflicts, resolutions);
        setDataset(merged);
        setIsDirty(true);
        baseDatasetRef.current = pendingServerDataset;
        setPendingMergeConflicts([]);
        setPendingServerDataset(null);
    };

    // ─── Back with dirty guard ────────────────────────────────────────────────
    const handleBack = () => {
        if (isDirty && !confirm('You have unsaved changes. Leave without saving?')) return;
        router.back();
    };

    // ─── Core drop execution ──────────────────────────────────────────────────
    const executeDrop = useCallback((
        targetDay: string,
        targetSlot: number,
        item: ScheduleItem,
        source: 'GRID' | 'SIDEBAR',
        sourceDay?: string,
        sourceSlot?: number,
    ) => {
        if (!dataset) return;
        const prev = dataset;
        const srcDay = source === 'GRID' ? sourceDay : undefined;
        const srcSlot = source === 'GRID' ? sourceSlot : undefined;
        const { dataset: newDataset, ejected } = isTeamItem(item)
            ? moveTeamItem(prev, item, targetDay, targetSlot, srcDay, srcSlot)
            : moveItem(prev, item, targetDay, targetSlot, srcDay, srcSlot);
        setDataset(newDataset);
        setIsDirty(true);
        if (ejected.length > 0) {
            setEjectionNotice({ ejected, previousDataset: prev });
        } else {
            setEjectionNotice(null);
        }
    }, [dataset]);

    const executeSwap = useCallback((
        itemA: ScheduleItem, dayA: string, slotA: number,
        itemB: ScheduleItem, dayB: string, slotB: number,
    ) => {
        if (!dataset) return;
        setDataset(swapItems(dataset, itemA, dayA, slotA, itemB, dayB, slotB));
        setIsDirty(true);
        setEjectionNotice(null);
    }, [dataset]);

    // ─── Grid drag-drop ───────────────────────────────────────────────────────
    const handleGridDrop = useCallback((targetDay: string, targetSlot: number, payload: DragPayload) => {
        const { source, item, day: sourceDay, slot: sourceSlot } = payload;
        if (viewMode !== 'all' || !dataset) return;

        // Same-cell no-op
        if (source === 'GRID' && sourceDay === targetDay && sourceSlot === targetSlot) return;

        // Build virtual dataset without the source item (for GRID→GRID)
        const isTeam = isTeamItem(item);
        const virtualDataset =
            source === 'GRID' && sourceDay && sourceSlot !== undefined
                ? (isTeam
                    ? removeTeamItemFromDataset(dataset, item, sourceDay, sourceSlot)
                    : removeItemFromDataset(dataset, item, sourceDay, sourceSlot))
                : dataset;

        const conflicts = isTeam
            ? findConflictsForTeamItem(virtualDataset, targetDay, targetSlot, item)
            : findConflictsAtSlot(virtualDataset, targetDay, targetSlot, item);

        // Preplace/elective item — always warn before moving
        if (item.isPreplace) {
            setPendingPreplaceDrop({ targetDay, targetSlot, item, conflicts, source, sourceDay, sourceSlot });
            return;
        }

        if (conflicts.length === 0) {
            executeDrop(targetDay, targetSlot, item, source, sourceDay, sourceSlot);
            return;
        }

        // Has conflicts — show warning dialog
        const isTeamSplit = conflicts.some(
            c => c.existingItem.teachingType === 'team' || c.existingItem.teachingType === 'split',
        );

        let canSwap = false;
        if (
            source === 'GRID' &&
            sourceDay &&
            sourceSlot !== undefined &&
            conflicts.length === 1 &&
            !isTeamSplit
        ) {
            canSwap = checkSwapFeasibility(
                dataset, item, sourceDay, sourceSlot,
                conflicts[0].existingItem, targetDay, targetSlot,
            );
        }

        setPendingDrop({
            targetDay, targetSlot, item, conflicts, isTeamSplit, canSwap,
            source, sourceDay, sourceSlot,
        });
    }, [viewMode, dataset, executeDrop]);

    // ─── Conflict dialog callbacks ────────────────────────────────────────────
    const handleConfirmDrop = useCallback((editedItem: ScheduleItem) => {
        if (!pendingDrop) return;
        const { targetDay, targetSlot, source, sourceDay, sourceSlot } = pendingDrop;
        setPendingDrop(null);
        executeDrop(targetDay, targetSlot, editedItem, source, sourceDay, sourceSlot);
    }, [pendingDrop, executeDrop]);

    const handleSwapDrop = useCallback(() => {
        if (!pendingDrop?.canSwap || !pendingDrop.sourceDay || pendingDrop.sourceSlot === undefined) return;
        const { item, sourceDay, sourceSlot, targetDay, targetSlot, conflicts } = pendingDrop;
        setPendingDrop(null);
        executeSwap(item, sourceDay, sourceSlot, conflicts[0].existingItem, targetDay, targetSlot);
    }, [pendingDrop, executeSwap]);

    const handleCancelDrop = useCallback(() => setPendingDrop(null), []);

    const handleConfirmPreplace = useCallback(() => {
        if (!pendingPreplaceDrop) return;
        const { targetDay, targetSlot, item, source, sourceDay, sourceSlot } = pendingPreplaceDrop;
        setPendingPreplaceDrop(null);
        executeDrop(targetDay, targetSlot, item, source, sourceDay, sourceSlot);
    }, [pendingPreplaceDrop, executeDrop]);

    const handleCancelPreplace = useCallback(() => setPendingPreplaceDrop(null), []);

    // ─── Ejection notice callbacks ────────────────────────────────────────────
    const handleUndo = useCallback(() => {
        if (!ejectionNotice) return;
        setDataset(ejectionNotice.previousDataset);
        setIsDirty(true);
        setEjectionNotice(null);
    }, [ejectionNotice]);

    const handleAcceptEjection = useCallback(() => setEjectionNotice(null), []);

    // ─── Unschedule (drag to sidebar) ─────────────────────────────────────────
    const handleUnschedule = (item: ScheduleItem, day: string, slot: number) => {
        setDataset(prev => prev ? removeItemFromDataset(prev, item, day, slot) : prev);
        setIsDirty(true);
    };

    const handleSidebarDrop = (payload: DragPayload) => {
        const { source, item, day: sourceDay, slot: sourceSlot } = payload;
        if (source !== 'GRID' || !sourceDay || sourceSlot === undefined) return;
        if (isTeamItem(item)) {
            setDataset(prev => prev ? removeTeamItemFromDataset(prev, item, sourceDay, sourceSlot) : prev);
            setIsDirty(true);
        } else {
            handleUnschedule(item, sourceDay, sourceSlot);
        }
    };

    const checkOverlayConflict = useCallback(
        (targetDay: string, targetSlot: number, payload: DragPayload): boolean => {
            if (!dataset || viewMode !== 'all') return false;
            const { item, day: sourceDay, slot: sourceSlot, source } = payload;
            if (isTeamItem(item)) {
                const virtualDataset =
                    source === 'GRID' && sourceDay && sourceSlot !== undefined
                        ? removeTeamItemFromDataset(dataset, item, sourceDay, sourceSlot)
                        : dataset;
                return findConflictsForTeamItem(virtualDataset, targetDay, targetSlot, item).length > 0;
            }
            return hasConflict(
                dataset, targetDay, targetSlot, item,
                source === 'GRID' ? sourceDay : undefined,
                source === 'GRID' ? sourceSlot : undefined,
            );
        },
        [dataset, viewMode],
    );

    // ─── Edit overlay ─────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingParams, setEditingParams] = useState<{ day: string; slot: number } | null>(null);
    const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

    // ─── Hover tooltip ────────────────────────────────────────────────────────
    const [hoverTooltip, setHoverTooltip] = useState<{
        item: ScheduleItem; entityType: EntityType; rect: DOMRect;
    } | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBandHover = useCallback((entityType: EntityType, rect: DOMRect, item: ScheduleItem) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoverTooltip({ item, entityType, rect }), 150);
    }, []);

    const handleBandHoverEnd = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
        setHoverTooltip(null);
    }, []);

    const [bandInspect, setBandInspect] = useState<{
        day: string; slot: number; entityType: EntityType; data: OverlayCellData;
    } | null>(null);

    const handleCellClick = (day: string, slot: number) => {
        if (viewMode !== 'all') return;
        const cellData = overlayData?.[day]?.[slot];
        if (cellData?.allFree) {
            setEditingParams({ day, slot });
            setEditingItem(null);
            setIsModalOpen(true);
        }
    };

    const handleBandClick = (day: string, slot: number, entityType: EntityType, data: OverlayCellData) => {
        handleBandHoverEnd();
        const item = entityType === 'teacher' ? data.teacher
            : entityType === 'class' ? data.class
                : data.room;
        if (!item) return;
        setBandInspect({ day, slot, entityType, data });
    };

    const handleBandEdit = () => {
        if (!bandInspect) return;
        const { day, slot, data } = bandInspect;
        setBandInspect(null);
        setEditingParams({ day, slot });
        setEditingItem(data.teacher ?? null);
        setIsModalOpen(true);
    };

    const handleModalSave = (data: Partial<ScheduleItem>) => {
        if (!editingParams || !dataset) return;
        const { day, slot } = editingParams;
        const newItem: ScheduleItem = {
            teacher: data.teacher ?? '',
            teacherName: data.teacherName ?? '',
            classCode: data.classCode ?? '',
            room: data.room ?? '',
            roomName: data.roomName ?? '',
            subjectCode: data.subjectCode ?? '',
            subject: data.subject ?? '',
            variant: data.variant ?? '_activity',
        };

        const prev = dataset;
        // Explicitly remove the original item first (fixes orphaned-item bug)
        let current = editingItem
            ? removeItemFromDataset(prev, editingItem, day, slot)
            : prev;
        const { dataset: updated, ejected } = moveItem(current, newItem, day, slot);

        setDataset(updated);
        setIsDirty(true);
        if (ejected.length > 0) {
            setEjectionNotice({ ejected, previousDataset: prev });
        }
        setIsModalOpen(false);
        setEditingParams(null);
        setEditingItem(null);
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <AdminHeader />

            <header className="bg-surface border-b border-border px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm font-medium hidden sm:inline">Back</span>
                        </button>
                        <div className="h-5 w-px bg-border hidden sm:block" />
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-sm font-bold text-foreground truncate">{jobName}</h2>
                            {isDirty && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold shrink-0">
                                    Unsaved
                                </span>
                            )}
                            {pendingMergeConflicts.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-semibold shrink-0">
                                    {pendingMergeConflicts.length} conflict{pendingMergeConflicts.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {loadError && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold shrink-0" title={loadError}>
                                    Load error
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {viewMode === 'teacher' && teacherCodes.length > 0 && (
                            <FilterDropdown label="T. code" value={tCode} options={teacherCodes} onChange={handleTCodeChange} labelClassName="text-primary font-semibold w-14" entityMeta={entityMeta} />
                        )}
                        {viewMode === 'class' && classCodes.length > 0 && (
                            <FilterDropdown label="Class" value={classCode} options={classCodes} onChange={handleClassChange} labelClassName="text-primary font-semibold w-14" entityMeta={entityMeta} />
                        )}
                        {viewMode === 'room' && roomCodes.length > 0 && (
                            <FilterDropdown label="Room" value={room} options={roomCodes} onChange={handleRoomChange} labelClassName="text-primary font-semibold w-14" entityMeta={entityMeta} />
                        )}
                        {viewMode !== 'all' && <div className="h-5 w-px bg-border hidden sm:block" />}
                        <ViewModeToggle activeMode={viewMode} onChange={setViewMode} />
                        <div className="h-5 w-px bg-border hidden sm:block" />

                        <button
                            onClick={handleSaveSchedule}
                            disabled={isSaving || pendingMergeConflicts.length > 0}
                            title={pendingMergeConflicts.length > 0 ? `Resolve ${pendingMergeConflicts.length} conflict${pendingMergeConflicts.length !== 1 ? 's' : ''} first` : 'Save schedule'}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
                            <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save'}</span>
                        </button>
                        <button
                            onClick={handleCheckForUpdates}
                            disabled={isCheckingUpdates}
                            title="Check for updates from server"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{isCheckingUpdates ? 'Checking…' : 'Sync'}</span>
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setActionsOpen(!actionsOpen)}
                                className="p-2 rounded-lg text-foreground-muted hover:bg-surface-alt hover:text-foreground transition-colors"
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                            {actionsOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-surface border border-border rounded-xl shadow-lg py-1">
                                        <button
                                            disabled
                                            title="Complete all lessons before publishing"
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-4 h-4 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Publish
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button
                                            onClick={() => { setIsSourcePanelOpen(true); setActionsOpen(false); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors"
                                        >
                                            <Sheet className="w-4 h-4 text-foreground-muted" /> Update Google Sheet
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button onClick={() => { handleExportClick(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                                            <Download className="w-4 h-4 text-foreground-muted" /> Export JSON
                                        </button>
                                        <button onClick={() => { handleExportExcel(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                                            <FileSpreadsheet className="w-4 h-4 text-foreground-muted" /> Export Excel
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-purple-600 hover:bg-surface-alt transition-colors">
                                            <Sparkles className="w-4 h-4" /> AI Shuffle
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button onClick={() => { handleDeleteJob(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-4 h-4" /> Delete Schedule
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {viewMode === 'all' && (
                <div className="bg-surface border-b border-border px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {teacherCodes.length > 0 && (
                            <FilterDropdown
                                label="T. code"
                                value={tCode}
                                options={teacherCodes}
                                onChange={handleTCodeChange}
                                labelClassName={activeEntity === 'teacher' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                                entityMeta={entityMeta}
                            />
                        )}
                        {classCodes.length > 0 && (
                            <FilterDropdown
                                label="Class"
                                value={classCode}
                                options={classCodes}
                                onChange={handleClassChange}
                                labelClassName={activeEntity === 'class' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                                entityMeta={entityMeta}
                            />
                        )}
                        {roomCodes.length > 0 && (
                            <FilterDropdown
                                label="Room"
                                value={room}
                                options={roomCodes}
                                onChange={handleRoomChange}
                                labelClassName={activeEntity === 'room' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                                entityMeta={entityMeta}
                            />
                        )}
                        {!dataset && <span className="text-xs text-foreground-muted">กำลังโหลดข้อมูล...</span>}
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-auto p-4">
                <ScheduleDndProvider
                    viewMode={viewMode}
                    onGridDrop={handleGridDrop}
                    onSidebarDrop={handleSidebarDrop}
                    onCheckConflict={viewMode === 'all' ? checkOverlayConflict : undefined}
                >
                    <div className="flex gap-4 h-full">
                        <div className="flex-1 min-w-0">
                            {!dataset ? (
                                <TimetableGridSkeleton />
                            ) : (
                                <TimetableGridV2
                                    scheduleData={activeSchedule}
                                    viewMode={viewMode}
                                    onCellClick={handleCellClick}
                                    onBandClick={handleBandClick}
                                    overlayData={viewMode === 'all' ? overlayData : undefined}
                                    onBandHover={handleBandHover}
                                    onBandHoverEnd={handleBandHoverEnd}
                                    activeEntity={viewMode === 'all' ? activeEntity : undefined}
                                />
                            )}
                            {viewMode === 'all' && dataset && (
                                <ClassCurriculumStrip
                                    classCode={classCode}
                                    dataset={dataset}
                                    entityMeta={entityMeta}
                                />
                            )}
                        </div>
                        {viewMode === 'all' && (
                            <PaletteSidebar
                                teacherCode={tCode}
                                dataset={dataset}
                                entityMeta={entityMeta}
                            />
                        )}
                    </div>
                </ScheduleDndProvider>
            </main>

            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

            <EditOverlay
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleModalSave}
                initialData={editingItem}
                entityMeta={entityMeta}
            />

            {hoverTooltip && (
                <BandHoverTooltip
                    item={hoverTooltip.item}
                    entityType={hoverTooltip.entityType}
                    anchorRect={hoverTooltip.rect}
                />
            )}

            <OverlayInspectPopover
                isOpen={bandInspect !== null}
                onClose={() => setBandInspect(null)}
                onEdit={bandInspect?.entityType === 'teacher' ? handleBandEdit : undefined}
                day={bandInspect?.day ?? ''}
                slot={bandInspect?.slot ?? 1}
                data={bandInspect?.data ?? null}
                focusedEntity={bandInspect?.entityType ?? activeEntity}
                groupedSlots={groupedSlots}
            />

            <UpdateSourcePanel
                isOpen={isSourcePanelOpen}
                onClose={() => setIsSourcePanelOpen(false)}
                jobId={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('schedule_id') ?? ''}
                sheetUrl={sheetUrl}
                onMetaRefreshed={handleMetaRefreshed}
            />

            {/* Preplace warning dialog */}
            {pendingPreplaceDrop && (
                <PreplaceWarningDialog
                    pendingDrop={pendingPreplaceDrop}
                    onConfirm={handleConfirmPreplace}
                    onCancel={handleCancelPreplace}
                />
            )}

            {/* Conflict warning dialog */}
            {pendingDrop && dataset && (
                <ConflictWarningDialog
                    pendingDrop={pendingDrop}
                    dataset={dataset}
                    entityMeta={entityMeta}
                    onConfirm={handleConfirmDrop}
                    onSwap={handleSwapDrop}
                    onCancel={handleCancelDrop}
                />
            )}

            {/* Merge conflict dialog */}
            {pendingMergeConflicts.length > 0 && (
                <MergeConflictDialog
                    conflicts={pendingMergeConflicts}
                    onResolve={handleMergeComplete}
                    onCancel={() => { setPendingMergeConflicts([]); setPendingServerDataset(null); }}
                />
            )}

            {/* Ejection notice */}
            {ejectionNotice && (
                <EjectionNotice
                    ejected={ejectionNotice.ejected}
                    onUndo={handleUndo}
                    onAccept={handleAcceptEjection}
                />
            )}
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
            <SchedulePageContent />
        </Suspense>
    );
}
