import ScheduleCellDisplay from '@/app/(admin)/schedule/_components/ScheduleCellDisplay';
import { ScheduleItem } from '@/app/(admin)/schedule/_utils/dummyData';

interface ScheduleData {
  [day: string]: {
    [slot: number]: ScheduleItem;
  };
}

interface TeacherTimetableGridProps {
  scheduleData: ScheduleData;
  viewMode: 'all' | 'teacher' | 'class' | 'room';
  onCellClick?: (day: string, slot: number, item: ScheduleItem | null) => void;
}

export default function TeacherTimetableGrid({ scheduleData, viewMode, onCellClick }: TeacherTimetableGridProps) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const visibleLabels =
    viewMode === 'teacher'
      ? ['Teacher']
      : viewMode === 'class'
      ? ['Class']
      : viewMode === 'room'
      ? ['Room']
      : ['Teacher', 'Class', 'Room'];

  return (
    <div className="flex gap-0 overflow-hidden">
      <div className="flex flex-col min-w-[100px]">
        <div className="px-3 py-2 h-10 border-b border-transparent" />
        {days.map((day) => (
          <div
            key={day}
            className="flex items-center justify-center bg-surface font-bold text-foreground text-sm"
            style={{ height: `${visibleLabels.length * 40}px` }}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex flex-1 border border-border-strong rounded-lg overflow-hidden ml-2">
        <div className="flex flex-col border-r border-border-strong">
          <div className="bg-surface-alt border-b border-border-strong px-3 py-2 h-10 text-center text-sm font-bold text-foreground-muted flex items-center justify-center">
            Slots
          </div>

          {days.map((day, dayIndex) => (
            <div
              key={day}
              className={`flex flex-col ${dayIndex < days.length - 1 ? 'border-b border-border-strong' : ''}`}
            >
              {visibleLabels.map((label, labelIndex) => (
                <div
                  key={label}
                  className={`px-3 py-2 text-xs text-foreground-muted bg-surface h-10 flex items-center justify-center min-w-[80px] ${
                    labelIndex < visibleLabels.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex">
            {slots.map((slot, slotIndex) => (
              <div
                key={slot}
                className={`flex flex-col flex-1 min-w-[80px] ${slotIndex < slots.length - 1 ? 'border-r border-border-strong' : ''}`}
              >
                <div className="bg-surface-alt border-b border-border-strong px-2 py-2 text-center text-sm font-bold text-foreground-muted h-10 flex items-center justify-center">
                  {slot}
                </div>

                {days.map((day, dayIndex) => {
                  const cellData = scheduleData[day]?.[slot];

                  return (
                    <div
                      key={day}
                      className={`flex flex-col cursor-pointer hover:opacity-85 transition-opacity ${dayIndex < days.length - 1 ? 'border-b border-border-strong' : ''}`}
                      onClick={() => onCellClick?.(day, slot, cellData || null)}
                    >
                      <ScheduleCellDisplay data={cellData} visibleLabels={visibleLabels} className="h-full" />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
