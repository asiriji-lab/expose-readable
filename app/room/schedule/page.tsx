'use client';

import { useMemo, useState } from 'react';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';
import FilterDropdown from '@/app/(admin)/schedule/_components/FilterDropdown';
import TeacherTimetableGrid from '@/app/teacher/components/TeacherTimetableGrid';
import TeacherSlotInfoOverlay from '@/app/teacher/components/TeacherSlotInfoOverlay';
import { ScheduleItem, ScheduleData } from '@/app/(admin)/schedule/_types/schedule.types';
import { useLatestSchedule } from '@/lib/hooks/useLatestSchedule';
import { getRoomCodes } from '@/lib/api/transform';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TOTAL_SLOTS = 5 * 12; // 5 days × 12 slots

export default function RoomSchedulePage() {
  const { dataset, loadState } = useLatestSchedule();

  const roomCodes = useMemo(() => getRoomCodes(dataset), [dataset]);

  const [roomCode, setRoomCode]           = useState('');
  const [selectedDay, setSelectedDay]     = useState('All days');
  const [isSlotOverlayOpen, setIsSlotOverlayOpen] = useState(false);
  const [activeSlot, setActiveSlot]       = useState<{ day: string; slot: number; item: ScheduleItem | null } | null>(null);

  const effectiveCode = roomCode && roomCodes.includes(roomCode)
    ? roomCode
    : (roomCodes[0] ?? '');

  const scheduleData: ScheduleData = dataset.rooms[effectiveCode] ?? {};

  const filledSlots = useMemo(
    () => Object.values(scheduleData).reduce((sum, daySlots) => sum + Object.keys(daySlots).length, 0),
    [scheduleData],
  );

  const uniqueTeachers = useMemo(() => {
    const codes = new Set<string>();
    Object.values(scheduleData).forEach(daySlots =>
      Object.values(daySlots).forEach(item => item.teacher && codes.add(item.teacher)));
    return codes.size;
  }, [scheduleData]);

  const uniqueClasses = useMemo(() => {
    const codes = new Set<string>();
    Object.values(scheduleData).forEach(daySlots =>
      Object.values(daySlots).forEach(item => item.classCode && codes.add(item.classCode)));
    return codes.size;
  }, [scheduleData]);

  // Derive room type from the data: if a single class dominates → homeroom, else specialist.
  const roomType = useMemo(() => {
    if (uniqueClasses <= 1 && filledSlots > 0) return 'homeroom';
    return 'specialist';
  }, [uniqueClasses, filledSlots]);

  const usagePct = Math.round((filledSlots / TOTAL_SLOTS) * 100);

  const visibleScheduleData = useMemo(() => {
    if (selectedDay === 'All days') return scheduleData;
    const filtered: ScheduleData = {};
    DAYS.forEach(day => {
      filtered[day] = selectedDay === day ? scheduleData[day] || {} : {};
    });
    return filtered;
  }, [scheduleData, selectedDay]);

  const handleSlotClick = (day: string, slot: number, item: ScheduleItem | null) => {
    if (!item) return;
    setActiveSlot({ day, slot, item });
    setIsSlotOverlayOpen(true);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <AdminHeader />

      {/* ── Room selector bar ── */}
      <header className="bg-surface border-b border-border px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FilterDropdown
                label="Room"
                value={effectiveCode}
                options={roomCodes.length ? roomCodes : [effectiveCode]}
                onChange={code => setRoomCode(code)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">Room name</span>
              <input
                type="text"
                readOnly
                value={effectiveCode}
                className="px-2 py-1 border border-border-strong rounded text-xs w-44 text-foreground bg-surface-alt cursor-default select-none"
              />
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                roomType === 'specialist'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {roomType === 'specialist' ? 'Specialist' : 'Homeroom'}
              </span>
              {loadState === 'loading' && (
                <span className="text-xs text-foreground-muted animate-pulse">กำลังโหลด...</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterDropdown
              label="Day"
              value={selectedDay}
              options={['All days', ...DAYS]}
              onChange={setSelectedDay}
              labelClassName="w-14"
            />
          </div>
        </div>
      </header>

      {/* ── Stats bar ── */}
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="flex gap-4">
          <StatCard label="Usage"    value={`${usagePct}%`}          sub="Room utilization" />
          <StatCard label="Teachers" value={String(uniqueTeachers)}  sub="Unique teachers" />
          <StatCard label="Classes"  value={String(uniqueClasses)}   sub="Unique classes" />
          <div className="flex items-center gap-3 px-4 py-2 bg-surface-alt border border-border rounded-lg">
            <span className="text-xs text-foreground-muted font-medium">Periods used</span>
            <span className="text-sm font-bold text-foreground">{filledSlots} / {TOTAL_SLOTS}</span>
          </div>
        </div>
      </div>

      {/* ── Timetable ── */}
      <main className="flex-1 overflow-auto p-6">
        <TeacherTimetableGrid
          scheduleData={visibleScheduleData}
          viewMode="room"
          onCellClick={handleSlotClick}
        />
      </main>

      <TeacherSlotInfoOverlay
        isOpen={isSlotOverlayOpen}
        day={activeSlot?.day || ''}
        slot={activeSlot?.slot || 1}
        item={activeSlot?.item || null}
        onClose={() => setIsSlotOverlayOpen(false)}
      />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2 bg-surface-alt border border-border rounded-lg min-w-[100px]">
      <span className="text-[11px] text-foreground-muted font-medium">{label}</span>
      <span className="text-lg font-bold text-foreground leading-tight">{value}</span>
      <span className="text-[11px] text-foreground-muted">{sub}</span>
    </div>
  );
}
