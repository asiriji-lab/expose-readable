'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Header */}
      <AdminHeader />
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        {/* Grid Layout for Header Alignment */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-8 gap-y-2 py-2 items-start">

          {/* Column 1: Left Meta & Actions */}
          <div className="flex flex-col gap-2">

            {/* Row 1: Back & Title (Aligns with T.code row) */}
            <div className="flex items-center gap-3 h-8">
              <button onClick={() => router.back()} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </button>

              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900">Main Schedule 1/2025</h2>
                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold">Draft</span>
                <span className="text-xs text-gray-400">Semester 1/2025</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 h-10">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Draft</span>
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Publish</span>
              </button>
              <button className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button className="p-2 text-purple-500 hover:bg-purple-50 rounded transition-colors" title="AI Shuffle">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Column 2: Filter Grid */}
          <div className="grid grid-cols-[auto_auto] gap-x-2 gap-y-2 w-fit">

            {/* Row 1: T. code & T. name context */}
            <div className="contents">
              <div className="h-8 flex items-center">
                <FilterDropdown
                  label="T. code"
                  value={tCode}
                  options={['0301', '9301', '9302', '9303', '9304']}
                  onChange={setTCode}
                />
              </div>
              <div className="h-8 flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-black font-medium whitespace-nowrap w-20 text-right">T. name</label>
                  <input
                    type="text"
                    placeholder="T_name"
                    className="px-2 py-1 border border-gray-300 rounded text-xs w-20 text-black"
                    defaultValue="U10"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Teacher name"
                    className="px-2 py-1 border border-gray-300 rounded text-xs w-24 text-black"
                    defaultValue="ธนาโชค"
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    className="px-2 py-1 border border-gray-300 rounded text-xs w-24 text-black"
                    defaultValue="พัฒนา"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Class & Default Room */}
            <div className="contents">
              <div className="h-8 flex items-center">
                <FilterDropdown
                  label="Class"
                  value={classCode}
                  options={['6/15', '6/16', '6/17', '7/1', '7/2']}
                  onChange={setClassCode}
                />
              </div>
              <div className="h-8 flex items-center gap-2">
                <label className="text-xs text-black font-medium whitespace-nowrap w-20 text-right">Default Room</label>
                <input
                  type="text"
                  className="px-2 py-1 border border-gray-300 rounded text-xs w-20 text-black"
                  defaultValue="5410"
                />
              </div>
            </div>

            {/* Row 3: Room & Room Name */}
            <div className="contents">
              <div className="h-8 flex items-center">
                <FilterDropdown
                  label="Room"
                  value={room}
                  options={['7401', '7402', '7403', 'Computer room']}
                  onChange={setRoom}
                />
              </div>
              <div className="h-8 flex items-center gap-2">
                <label className="text-xs text-black font-medium whitespace-nowrap w-20 text-right">Room name</label>
                <input
                  type="text"
                  className="px-2 py-1 border border-gray-300 rounded text-xs w-32 text-black"
                  defaultValue="Computer room"
                />
              </div>
            </div>
          </div>

          {/* Column 3: View Mode Toggle (Row 2 aligned essentially, but flexed to right) */}
          <div className="flex justify-end items-end h-[68px]"> {/* Height covering 2 rows roughly */}
            <ViewModeToggle activeMode={viewMode} onChange={setViewMode} />
          </div>

        </div>
      </header>

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