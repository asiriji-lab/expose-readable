import { ScheduleItem } from '@/app/(admin)/schedule/_utils/dummyData';
import UnifiedScheduleCell, { buildRowsForMode, ROW_HEIGHT } from '@/app/(admin)/schedule/_components/UnifiedScheduleCell';

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DAY_ABBREV: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};

export default function TeacherTimetableGrid({ scheduleData, viewMode, onCellClick }: TeacherTimetableGridProps) {
  const visibleLabels =
    viewMode === 'teacher'
      ? ['Subject', 'Class', 'Room']
      : viewMode === 'class'
      ? ['Subject', 'Teacher', 'Room']
      : viewMode === 'room'
      ? ['Subject', 'Teacher', 'Class']
      : ['Subject', 'Class', 'Room'];

  const cellHeight = 3 * ROW_HEIGHT;

  return (
    <div className="overflow-hidden rounded-xl border border-border-strong shadow-sm bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${76 * SLOTS.length + 134}px` }}>
          <thead>
            <tr className="bg-surface-alt">
              <th className="sticky left-0 z-20 bg-surface-alt w-[72px] min-w-[72px] border-b border-r border-border-strong">
                <div className="h-9 flex items-center justify-center text-[9px] font-bold text-foreground-muted uppercase tracking-wider">Day</div>
              </th>
              <th className="sticky left-[72px] z-20 bg-surface-alt w-[62px] min-w-[62px] border-b border-r border-border-strong">
                <div className="h-9 flex items-center justify-center text-[9px] font-bold text-foreground-muted uppercase tracking-wider">Info</div>
              </th>
              {SLOTS.map(slot => (
                <th key={slot} className="border-b border-border-strong min-w-[76px]">
                  <div className="h-9 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{slot}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day} className={di < DAYS.length - 1 ? 'border-b border-border' : ''}>
                <td className="sticky left-0 z-10 bg-surface-alt border-r border-border-strong">
                  <div className="flex items-center justify-center font-bold text-foreground text-xs" style={{ height: `${cellHeight}px` }}>
                    <span className="hidden lg:inline">{day}</span>
                    <span className="lg:hidden">{DAY_ABBREV[day]}</span>
                  </div>
                </td>
                <td className="sticky left-[72px] z-10 bg-surface border-r border-border-strong">
                  <div className="flex flex-col" style={{ height: `${cellHeight}px` }}>
                    {visibleLabels.map((label, li) => (
                      <div
                        key={label}
                        className={`flex items-center justify-center text-[9px] text-foreground-muted/70 ${li > 0 ? 'border-t border-border/40' : ''}`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </td>
                {SLOTS.map((slot, si) => {
                  const cellData = scheduleData[day]?.[slot];
                  const rows = buildRowsForMode(viewMode, cellData);

                  return (
                    <td key={slot} className={`p-0 ${si < SLOTS.length - 1 ? 'border-r border-border/30' : ''}`}>
                      <UnifiedScheduleCell
                        mode="individual"
                        rows={rows}
                        variant={cellData?.variant}
                        onClick={() => onCellClick?.(day, slot, cellData || null)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
