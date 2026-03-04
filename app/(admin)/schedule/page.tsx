'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Upload, Download, Save, Trash2, Sparkles, MoreHorizontal, ChevronDown } from 'lucide-react';
import FilterDropdown from './_components/FilterDropdown';
import ViewModeToggle from './_components/ViewModeToggle';
import TimetableGrid from './_components/TimetableGrid';
import TeachingSlotSidebar from './_components/TeachingSlotSidebar';
import EditOverlay from './_components/EditOverlay';
import { generateScheduleItem, ScheduleItem } from './_utils/dummyData';
import AdminHeader from '../_components/AdminHeader';

interface ScheduleData {
  [day: string]: {
    [slot: number]: ScheduleItem;
  };
}

// Mock data matching the design
// Mock data replaced by dynamic generation


export default function SchedulePage() {
  const router = useRouter();
  const [tCode, setTCode] = useState('9301');
  const [classCode, setClassCode] = useState('6/15');
  const [room, setRoom] = useState('7401');
  const [viewMode, setViewMode] = useState<'all' | 'teacher' | 'class' | 'room'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schedule Data State
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  // Sidebar Presets State (Lifted up)
  const [presets, setPresets] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    // Generate dummy data on mount
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const newScheduleData: ScheduleData = {};

    days.forEach(day => {
      newScheduleData[day] = {};
      slots.forEach(slot => {
        // 40% chance of empty, just for variety
        if (Math.random() > 0.4) {
          newScheduleData[day][slot] = generateScheduleItem();
        }
      });
    });
    setScheduleData(newScheduleData);
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

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

      if (!response.ok) {
        throw new Error('Failed to import JSON');
      }

      const result = await response.json();
      console.log('Import Successful:', result.data);
      alert('JSON imported successfully (check console for payload)! Integration into grid will happen in a later phase.');
      // Here you would transform result.data into ScheduleData state format
      // setScheduleData(transformJSONToScheduleData(result.data));

    } catch (e) {
      console.error('Import error:', e);
      alert('Failed to parse or import JSON file.');
    } finally {
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportClick = async () => {
    try {
      // We pass the current schedule state, but as planned, it should ultimately 
      // generate the format like 'sample don't change.json'
      // For now, testing the API connection with dummy wrapper
      const exportData = {
        config: {
          academic_year: "2026",
          semester: 1,
          columns: [
            { key: "day", label: "Day", type: "text" },
            { key: "1", label: "1", time: "08.30-09.20" },
            { key: "2", label: "2", time: "09.25-10.15" },
            { key: "3", label: "3", time: "10.20-11.10" }
          ]
        },
        teachers: [],
        students: [],
        rooms: [],
        // Raw data included for debugging/future transformation
        _rawState: scheduleData
      };

      const response = await fetch('/api/schedule/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate export');
      }

      // Trigger download
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



  // Handle drop onto the Grid
  const handleGridDrop = (targetDay: string, targetSlot: number, payload: any) => {
    // Note: payload is typed as 'any' here due to import limitations in this context but strictly it is DragPayload
    // In a real app we'd import DragPayload. For now we assume the shape.
    const { source, item, day: sourceDay, slot: sourceSlot, index: sourceIndex } = payload;

    // Check for existing item using current state
    const existingItem = scheduleData[targetDay]?.[targetSlot];

    // Prepare new schedule data
    const nextSchedule = { ...scheduleData };

    // 1. Logic for GRID source
    if (source === 'GRID' && sourceDay && sourceSlot) {
      // Remove dragged item from source
      if (nextSchedule[sourceDay]) {
        const sourceDayData = { ...nextSchedule[sourceDay] };
        delete sourceDayData[sourceSlot];
        nextSchedule[sourceDay] = sourceDayData;

        // If there was an existing item at target, move it to source (SWAP)
        if (existingItem) {
          nextSchedule[sourceDay] = {
            ...nextSchedule[sourceDay],
            [sourceSlot]: existingItem
          };
        }
      }
    }

    // 2. Logic for SIDEBAR source
    if (source === 'SIDEBAR' && typeof sourceIndex === 'number') {
      // Remove dragged item from sidebar presets
      setPresets(prevPresets => {
        const newPresets = prevPresets.filter((_, i) => i !== sourceIndex);

        // If there was an existing item at target, add it to presets (SWAP/DISPLACE)
        if (existingItem) {
          return [...newPresets, existingItem];
        }
        return newPresets;
      });
    }

    // 3. Place dragged item at target
    const targetDayData = { ...(nextSchedule[targetDay] || {}) };
    targetDayData[targetSlot] = item;
    nextSchedule[targetDay] = targetDayData;

    setScheduleData(nextSchedule);
  };

  // --- Modal Logic ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParams, setEditingParams] = useState<{ day: string; slot: number } | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  const handleCellClick = (day: string, slot: number) => {
    const item = scheduleData[day]?.[slot] || null;
    setEditingParams({ day, slot });
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleModalSave = (data: Partial<ScheduleItem>) => {
    if (!editingParams) return;
    const { day, slot } = editingParams;

    const newItem: ScheduleItem = {
      teacher: data.teacher || '',
      teacherName: data.teacherName || '',
      classCode: data.classCode || '',
      room: data.room || '',
      roomName: data.roomName || '',
      subjectCode: data.subjectCode || '',
      subject: data.subject || '',
      variant: data.variant || 'green', // Default
    };

    setScheduleData(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [slot]: newItem
      }
    }));

    setIsModalOpen(false);
    setEditingParams(null);
    setEditingItem(null);
  };

  // Keep all view modes aligned to teacher schedule style (full timetable shown)
  const filteredScheduleData = scheduleData;

  // Handle drop onto the Sidebar
  const handleSidebarDrop = (payload: any) => {
    const { source, item, day: sourceDay, slot: sourceSlot } = payload;

    if (source === 'GRID' && sourceDay && sourceSlot) {
      // Remove from Grid
      setScheduleData(prev => {
        const next = { ...prev };
        if (next[sourceDay]) {
          const { [sourceSlot]: removed, ...rest } = next[sourceDay];
          next[sourceDay] = rest;
        }
        return next;
      });

      // Add to Sidebar
      setPresets(prev => [...prev, item]);
    }

    // If source is SIDEBAR, do nothing (or reorder in future)
  };

  // Handler for internal sidebar delete (optional, passed down if needed, but sidebar can emit an event)
  const handleDeletePreset = (index: number) => {
    setPresets(prev => prev.filter((_, i) => i !== index));
  };

  // State for actions overflow menu
  const [actionsOpen, setActionsOpen] = useState(false);
  // State for filter bar visibility
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Header */}
      <AdminHeader />

      {/* ═══════════════════════════════════════════════════
          TIER 1 — Primary Bar (always visible)
          Back · Title/Status · ViewToggle · Publish
         ═══════════════════════════════════════════════════ */}
      <header className="bg-surface border-b border-border px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Title + badges */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.back()} className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Back</span>
            </button>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate">Main Schedule 1/2025</h2>
              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold flex-shrink-0">Draft</span>
              <span className="text-xs text-foreground-muted hidden md:inline flex-shrink-0">Semester 1/2025</span>
            </div>
          </div>

          {/* Right: ViewToggle + Key actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ViewModeToggle activeMode={viewMode} onChange={setViewMode} />

            <div className="h-5 w-px bg-border hidden sm:block" />

            {/* Publish (always visible — primary CTA) */}
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="hidden sm:inline">Publish</span>
            </button>

            {/* Actions overflow menu */}
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="p-2 rounded-lg text-foreground-muted hover:bg-surface-alt hover:text-foreground transition-colors"
                title="More actions"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 w-48 bg-surface border border-border rounded-xl shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button onClick={() => { handleImportClick(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                      <Upload className="w-4 h-4 text-foreground-muted" />
                      Import JSON
                    </button>
                    <button onClick={() => { handleExportClick(); setActionsOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                      <Download className="w-4 h-4 text-foreground-muted" />
                      Export JSON
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-surface-alt transition-colors">
                      <Save className="w-4 h-4 text-foreground-muted" />
                      Save Draft
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-purple-600 hover:bg-surface-alt transition-colors">
                      <Sparkles className="w-4 h-4" />
                      AI Shuffle
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger-light transition-colors">
                      <Trash2 className="w-4 h-4" />
                      Delete Schedule
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          TIER 2 — Filters (collapsible)
          T.code · Class · Room + context inputs
         ═══════════════════════════════════════════════════ */}
      <div className="bg-surface border-b border-border">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-foreground-muted uppercase tracking-wide hover:bg-surface-alt transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersExpanded ? '' : '-rotate-90'}`} />
          Filters
        </button>

        {filtersExpanded && (
          <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
            {/* T.code + T.name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDropdown label="T. code" value={tCode} options={['0301', '9301', '9302', '9303', '9304']} onChange={setTCode} />
              <input type="text" placeholder="T_name" className="px-2 py-1 border border-border-strong rounded text-xs w-16 text-foreground" defaultValue="U10" />
              <input type="text" placeholder="Name" className="px-2 py-1 border border-border-strong rounded text-xs w-20 text-foreground" defaultValue="ธนาโชค" />
              <input type="text" placeholder="Subject" className="px-2 py-1 border border-border-strong rounded text-xs w-20 text-foreground" defaultValue="พัฒนา" />
            </div>

            {/* Class + Default Room row */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDropdown label="Class" value={classCode} options={['6/15', '6/16', '6/17', '7/1', '7/2']} onChange={setClassCode} />
              <label className="text-xs text-foreground-muted font-medium ml-2">Def. Room</label>
              <input type="text" className="px-2 py-1 border border-border-strong rounded text-xs w-16 text-foreground" defaultValue="5410" />
            </div>

            {/* Room + Room name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterDropdown label="Room" value={room} options={['7401', '7402', '7403', 'Computer room']} onChange={setRoom} />
              <label className="text-xs text-foreground-muted font-medium ml-2">Name</label>
              <input type="text" className="px-2 py-1 border border-border-strong rounded text-xs w-24 text-foreground" defaultValue="Computer room" />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area with Grid and Sidebar */}
      <main className="flex-1 overflow-auto p-6">
        <div className="flex gap-4">
          {/* Timetable Grid */}
          {/* TimetableGrid */}
          <div className="flex-1">
            <TimetableGrid
              scheduleData={filteredScheduleData}
              viewMode={viewMode}
              onCellClick={handleCellClick}
              onDropPayload={handleGridDrop}
            />
          </div>

          {/* Teaching Slot Sidebar */}
          {/* Teaching Slot Sidebar */}
          <TeachingSlotSidebar
            presets={presets}
            onDropPayload={handleSidebarDrop}
            onDeletePreset={handleDeletePreset}
          />
        </div>
      </main>

      <EditOverlay
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
        initialData={editingItem}
      />
    </div>
  );
}