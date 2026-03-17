'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import AdminHeader from '@/app/(admin)/_components/AdminHeader';
import FilterDropdown from '@/app/(admin)/schedule/_components/FilterDropdown';
import ViewModeToggle from '@/app/(admin)/schedule/_components/ViewModeToggle';
import { getClassSchedule, ScheduleItem, ScheduleData, CLASS_META } from '@/app/(admin)/schedule/_utils/dummyData';
import InboxOverlay, { InboxMessage } from '@/app/teacher/components/InboxOverlay';
import TeacherSlotInfoOverlay from '@/app/teacher/components/TeacherSlotInfoOverlay';
import TeacherTimetableGrid from '@/app/teacher/components/TeacherTimetableGrid';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentSchedulePage() {
  const router = useRouter();
  const [scheduleData, setScheduleData] = useState<ScheduleData>({});
  const [classCode, setClassCode] = useState('6/1');
  const [selectedDay, setSelectedDay] = useState('All days');
  const [viewMode, setViewMode] = useState<'all' | 'teacher' | 'class' | 'room'>('class');
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isSlotOverlayOpen, setIsSlotOverlayOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: string; slot: number; item: ScheduleItem | null } | null>(null);

  const inboxMessages: InboxMessage[] = [
    {
      id: 1,
      senderName: 'Academic Office',
      topic: 'Class exchange approved for Tuesday period 3',
      since: '08:45',
      unread: true,
    },
    {
      id: 2,
      senderName: 'Schedule Team',
      topic: 'Classroom switch: Friday period 6 moved to Room 7402',
      since: 'Yesterday',
      unread: false,
    },
  ];

  useEffect(() => {
    setScheduleData(getClassSchedule(classCode));
  }, [classCode]);

  const totalPeriods = useMemo(() => {
    return Object.values(scheduleData).reduce((sum, daySlots) => sum + Object.keys(daySlots).length, 0);
  }, [scheduleData]);

  const visibleScheduleData = useMemo(() => {
    if (selectedDay === 'All days') return scheduleData;

    const filtered: ScheduleData = {};
    DAYS.forEach((day) => {
      filtered[day] = selectedDay === day ? scheduleData[day] || {} : {};
    });
    return filtered;
  }, [scheduleData, selectedDay]);

  const handleSlotClick = (day: string, slot: number, item: ScheduleItem | null) => {
    setActiveSlot({ day, slot, item });
    setIsSlotOverlayOpen(true);
  };

  const hasUnreadInbox = inboxMessages.some((message) => message.unread);

  return (
    <div className="flex flex-col h-screen bg-background">
      <AdminHeader roleLabel="Student" />

      <header className="bg-surface border-b border-border px-6 py-3">
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-8 gap-y-2 py-2 items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 h-8">
              <button
                onClick={() => router.push('/student/dashboard')}
                className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </button>

              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">My Class Schedule</h2>
                <span className="px-1.5 py-0.5 bg-primary-light text-primary rounded text-xs font-semibold">Read only</span>
              </div>
            </div>

            <div className="flex items-center gap-2 h-10">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-strong rounded text-sm text-foreground-muted">
                <span className="font-medium">Total periods:</span>
                <span className="font-bold text-foreground">{totalPeriods}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[auto_auto] gap-x-2 gap-y-2 w-fit">
            <div className="contents">
              <div className="h-8 flex items-center">
                <FilterDropdown
                  label="Class"
                  value={classCode}
                  options={['6/1', '6/2', '6/3', '6/4', '7/1', '7/2', '7/3', '7/4']}
                  onChange={setClassCode}
                />
              </div>
              <div className="h-8 flex items-center gap-2">
                <label className="text-xs text-foreground font-medium whitespace-nowrap w-20 text-right">Default Room</label>
                <input
                  type="text"
                  className="px-2 py-1 border border-border-strong rounded text-xs w-24 text-foreground bg-background"
                  value={CLASS_META[classCode]?.defaultRoom ?? ''}
                  readOnly
                />
              </div>
            </div>

            <div className="contents">
              <div className="h-8 flex items-center">
                <FilterDropdown
                  label="Day"
                  value={selectedDay}
                  options={['All days', ...DAYS]}
                  onChange={setSelectedDay}
                  labelClassName="w-14"
                />
              </div>
              <div className="h-8 flex items-center gap-2" />
            </div>
          </div>

          <div className="flex justify-end items-end h-[68px] gap-2">
            <ViewModeToggle activeMode={viewMode} onChange={setViewMode} />
            <button
              type="button"
              onClick={() => setIsInboxOpen(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-primary bg-primary text-white hover:bg-primary-hover transition-colors"
              aria-label="Inbox"
              title="Inbox"
            >
              <Mail className="h-6 w-6" strokeWidth={2.25} />
              {hasUnreadInbox && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[12px] font-bold text-white shadow-sm">
                  !
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <TeacherTimetableGrid scheduleData={visibleScheduleData} viewMode={viewMode} onCellClick={handleSlotClick} />
      </main>

      <InboxOverlay isOpen={isInboxOpen} onClose={() => setIsInboxOpen(false)} messages={inboxMessages} />

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
