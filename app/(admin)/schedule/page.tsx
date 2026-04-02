'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, Download, Save, Trash2, Sparkles, MoreHorizontal } from 'lucide-react';
import ViewModeToggle from './_components/ViewModeToggle';
import TimetableGridV2 from './_components/TimetableGridV2';
import TimetableGridSkeleton from './_components/TimetableGridSkeleton';
import PaletteSidebar from './_components/PaletteSidebar';
import ScheduleDndProvider from './_components/ScheduleDndProvider';
import EditOverlay from './_components/EditOverlay';
import FilterDropdown from './_components/FilterDropdown';
import AdminHeader from '../_components/AdminHeader';
import {
    generateFullScheduleDataset,
    TEACHER_CODES,
    CLASS_CODES,
    ROOM_CODES,
    DragPayload,
} from './_utils/dummyData';
import { computeOverlayData } from './_utils/overlayUtils';
import { moveItem, hasConflict, removeItemFromDataset, autoEjectConflicts } from './_utils/scheduleLogic';
import { FullDataset, ScheduleItem, ScheduleData, ViewMode, OverlayCellData, EntityType } from './_types/schedule.types';
import OverlayInspectPopover from './_components/OverlayInspectPopover';
import BandHoverTooltip from './_components/BandHoverTooltip';

export default function SchedulePage() {
    const router = useRouter();
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Filter state ──────────────────────────────────────────────────────
    const [tCode, setTCode] = useState(TEACHER_CODES[0]);
    const [classCode, setClassCode] = useState(CLASS_CODES[0]);
    const [room, setRoom] = useState(ROOM_CODES[0]);

    // ─── Active entity — tracks which filter was last interacted with ────
    const [activeEntity, setActiveEntity] = useState<EntityType>('teacher');
    const handleTCodeChange = (val: string) => { setTCode(val); setActiveEntity('teacher'); };
    const handleClassChange = (val: string) => { setClassCode(val); setActiveEntity('class'); };
    const handleRoomChange = (val: string) => { setRoom(val); setActiveEntity('room'); };

    // ─── Full dataset ──────────────────────────────────────────────────────
    const [dataset, setDataset] = useState<FullDataset | null>(null);

    useEffect(() => {
        const { dataset: clean } = autoEjectConflicts(generateFullScheduleDataset());
        setDataset(clean);
    }, []);

    // ─── Derived schedules ─────────────────────────────────────────────────
    const teacherSchedule = useMemo(
        () => dataset?.teachers[tCode] ?? null,
        [dataset, tCode]
    );
    const classSchedule = useMemo(
        () => dataset?.classes[classCode] ?? null,
        [dataset, classCode]
    );
    const roomSchedule = useMemo(
        () => dataset?.rooms[room] ?? null,
        [dataset, room]
    );

    const activeSchedule = useMemo<ScheduleData>(() => {
        if (viewMode === 'teacher') return teacherSchedule ?? {};
        if (viewMode === 'class')   return classSchedule ?? {};
        if (viewMode === 'room')    return roomSchedule ?? {};
        return {};
    }, [viewMode, teacherSchedule, classSchedule, roomSchedule]);

    const overlayData = useMemo(
        () => computeOverlayData(teacherSchedule, classSchedule, roomSchedule, dataset),
        [teacherSchedule, classSchedule, roomSchedule, dataset]
    );



    // ─── Actions menu ──────────────────────────────────────────────────────
    const [actionsOpen, setActionsOpen] = useState(false);

    // ─── Import / Export ───────────────────────────────────────────────────
    const handleImportClick = () => fileInputRef.current?.click();

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
            console.log('Import Successful:', result.data);
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
            const response = await fetch('/api/schedule/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exportData),
            });
            if (!response.ok) throw new Error('Failed to generate export');
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = 'schedule.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e) {
            console.error('Export error:', e);
            alert('Failed to export schedule.');
        }
    };

    // ─── Grid drag-drop ────────────────────────────────────────────────────
    const handleGridDrop = (targetDay: string, targetSlot: number, payload: DragPayload) => {
        const { source, item, day: sourceDay, slot: sourceSlot } = payload;

        if (viewMode === 'all') {
            setDataset(prev => {
                if (!prev) return prev;
                const { dataset: newDataset } = moveItem(
                    prev,
                    item,
                    targetDay,
                    targetSlot,
                    source === 'GRID' ? sourceDay : undefined,
                    source === 'GRID' ? sourceSlot : undefined,
                );
                return newDataset;
            });
            return;
        }

        console.warn('handleGridDrop called in individual view mode — ignored');
    };

    const handleUnschedule = (item: ScheduleItem, day: string, slot: number) => {
        setDataset(prev => {
            if (!prev) return prev;
            return removeItemFromDataset(prev, item, day, slot);
        });
    };

    // handleSidebarDrop: called when a GRID card is dropped on the sidebar dropzone
    const handleSidebarDrop = (payload: DragPayload) => {
        const { source, item, day: sourceDay, slot: sourceSlot } = payload;
        if (source !== 'GRID' || !sourceDay || sourceSlot === undefined) return;
        handleUnschedule(item, sourceDay, sourceSlot);
    };

    // ─── Conflict check (View All) ──────────────────────────────────────
    const checkOverlayConflict = useCallback(
        (targetDay: string, targetSlot: number, payload: DragPayload): boolean => {
            if (!dataset || viewMode !== 'all') return false;
            const { item, day: sourceDay, slot: sourceSlot, source } = payload;
            return hasConflict(
                dataset,
                targetDay,
                targetSlot,
                item,
                source === 'GRID' ? sourceDay : undefined,
                source === 'GRID' ? sourceSlot : undefined,
            );
        },
        [dataset, viewMode]
    );

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingParams, setEditingParams] = useState<{ day: string; slot: number } | null>(null);
    const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

    // ─── Hover tooltip for busy bands ──────────────────────────────────
    const [hoverTooltip, setHoverTooltip] = useState<{
        item: ScheduleItem;
        entityType: EntityType;
        rect: DOMRect;
    } | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBandHover = useCallback((entityType: EntityType, rect: DOMRect, item: ScheduleItem) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoverTooltip({ item, entityType, rect });
        }, 150);
    }, []);

    const handleBandHoverEnd = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
        setHoverTooltip(null);
    }, []);

    // bandInspect: set when any occupied band is clicked in View All
    const [bandInspect, setBandInspect] = useState<{
        day: string;
        slot: number;
        entityType: EntityType;
        data: OverlayCellData;
    } | null>(null);

    const handleCellClick = (day: string, slot: number) => {
        if (viewMode !== 'all') return; // individual views are read-only
        const cellData = overlayData?.[day]?.[slot];
        if (cellData?.allFree) {
            setEditingParams({ day, slot });
            setEditingItem(null);
            setIsModalOpen(true);
        }
        // Non-free cells are handled by band clicks
    };

    // Called when any colored band in View All is clicked
    const handleBandClick = (day: string, slot: number, entityType: EntityType, data: OverlayCellData) => {
        handleBandHoverEnd(); // dismiss hover tooltip
        const item = entityType === 'teacher' ? data.teacher
                   : entityType === 'class'   ? data.class
                   : data.room;
        if (!item) return; // empty band — nothing to show
        setBandInspect({ day, slot, entityType, data });
    };

    // Edit slot from band inspect — only available when teacher band was clicked
    const handleBandEdit = () => {
        if (!bandInspect) return;
        const { day, slot, data } = bandInspect;
        setBandInspect(null);
        setEditingParams({ day, slot });
        setEditingItem(data.teacher ?? null);
        setIsModalOpen(true);
    };

    const handleModalSave = (data: Partial<ScheduleItem>) => {
        if (!editingParams) return;
        const { day, slot } = editingParams;
        const newItem: ScheduleItem = {
            teacher: data.teacher ?? '',
            teacherName: data.teacherName ?? '',
            classCode: data.classCode ?? '',
            room: data.room ?? '',
            roomName: data.roomName ?? '',
            subjectCode: data.subjectCode ?? '',
            subject: data.subject ?? '',
            variant: data.variant ?? 'green',
        };
        setDataset(prev => {
            if (!prev) return prev;
            // Use moveItem to write to all 3 entity maps consistently
            // First remove old item at this slot if exists
            const currentItem = activeSchedule[day]?.[slot];
            let current: FullDataset = prev;
            if (currentItem) {
                current = removeItemFromDataset(current, currentItem, day, slot);
            }
            const { dataset: updated } = moveItem(current, newItem, day, slot);
            return updated;
        });
        setIsModalOpen(false);
        setEditingParams(null);
        setEditingItem(null);
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            <AdminHeader />

            {/* ── Tier 1: Primary bar ── */}
            <header className="bg-surface border-b border-border px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Back + Title */}
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span className="text-sm font-medium hidden sm:inline">Back</span>
                        </button>
                        <div className="h-5 w-px bg-border hidden sm:block" />
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-sm font-bold text-foreground truncate">Main Schedule 1/2025</h2>
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold shrink-0">Draft</span>
                            <span className="text-xs text-foreground-muted hidden md:inline shrink-0">Semester 1/2025</span>
                        </div>
                    </div>

                    {/* Right: Inline filter (individual views) + ViewToggle + Publish + Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Inline filter for individual views — avoids a separate filter bar row */}
                        {viewMode === 'teacher' && (
                            <FilterDropdown label="T. code" value={tCode} options={TEACHER_CODES} onChange={handleTCodeChange} labelClassName="text-primary font-semibold w-14" />
                        )}
                        {viewMode === 'class' && (
                            <FilterDropdown label="Class" value={classCode} options={CLASS_CODES} onChange={handleClassChange} labelClassName="text-primary font-semibold w-14" />
                        )}
                        {viewMode === 'room' && (
                            <FilterDropdown label="Room" value={room} options={ROOM_CODES} onChange={handleRoomChange} labelClassName="text-primary font-semibold w-14" />
                        )}
                        {viewMode !== 'all' && <div className="h-5 w-px bg-border hidden sm:block" />}
                        <ViewModeToggle activeMode={viewMode} onChange={setViewMode} />
                        <div className="h-5 w-px bg-border hidden sm:block" />

                        <button
                            disabled
                            title="Complete all lessons before publishing"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">Publish</span>
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
                                        <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                        <button onClick={() => { handleImportClick(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                                            <Upload className="w-4 h-4 text-foreground-muted" /> Import JSON
                                        </button>
                                        <button onClick={() => { handleExportClick(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                                            <Download className="w-4 h-4 text-foreground-muted" /> Export JSON
                                        </button>
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                                            <Save className="w-4 h-4 text-foreground-muted" /> Save Draft
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-purple-600 hover:bg-surface-alt transition-colors">
                                            <Sparkles className="w-4 h-4" /> AI Shuffle
                                        </button>
                                        <div className="my-1 border-t border-border" />
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-4 h-4" /> Delete Schedule
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Tier 2: Filter bar (View All only — individual views use inline filter in header) ── */}
            {viewMode === 'all' && (
                <div className="bg-surface border-b border-border px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <FilterDropdown
                            label="T. code"
                            value={tCode}
                            options={TEACHER_CODES}
                            onChange={handleTCodeChange}
                            labelClassName={activeEntity === 'teacher' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                        />
                        <FilterDropdown
                            label="Class"
                            value={classCode}
                            options={CLASS_CODES}
                            onChange={handleClassChange}
                            labelClassName={activeEntity === 'class' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                        />
                        <FilterDropdown
                            label="Room"
                            value={room}
                            options={ROOM_CODES}
                            onChange={handleRoomChange}
                            labelClassName={activeEntity === 'room' ? 'text-primary font-semibold border-l-2 border-primary pl-2 w-14' : 'w-14'}
                        />
                    </div>
                </div>
            )}

            {/* ── Main content ── */}
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
                        </div>
                        {viewMode === 'all' && (
                            <PaletteSidebar
                                teacherCode={tCode}
                                dataset={dataset}
                            />
                        )}
                    </div>
                </ScheduleDndProvider>
            </main>

            <EditOverlay
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleModalSave}
                initialData={editingItem}
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
            />
        </div>
    );
}
