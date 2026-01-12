import { ScheduleItem } from '../_utils/dummyData';
export interface DragPayload {
    source: 'GRID' | 'SIDEBAR';
    item: ScheduleItem;
    day?: string;
    slot?: number;
    index?: number;
}
import ScheduleCellDisplay from './ScheduleCellDisplay';

interface ScheduleData {
    [day: string]: {
        [slot: number]: ScheduleItem;
    };
}

interface TimetableGridProps {
    scheduleData: ScheduleData;
    viewMode: 'all' | 'teacher' | 'class' | 'room';
    onCellClick?: (day: string, slot: number) => void;
    onDropPayload?: (day: string, slot: number, payload: DragPayload) => void;
}

export default function TimetableGrid({ scheduleData, viewMode, onCellClick, onDropPayload }: TimetableGridProps) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Summary'];
    const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Determine which labels to show based on viewMode
    // ALWAYS show all labels as per "like View All" request
    const allLabels = ['Teacher', 'Class', 'Room'];
    const visibleLabels = allLabels;
    // Previous logic removed to show full info in all views
    // Previous logic removed to show full info in all views
    // if (viewMode === 'teacher') visibleLabels = ['Teacher'];
    // ...

    return (
        <div className="flex gap-0 overflow-hidden">
            {/* First column: Days (Monday-Friday, Summary) */}
            <div className="flex flex-col min-w-[100px]">
                {/* Header - Empty space above days */}
                <div className="px-3 py-2 h-10 border-b border-transparent">
                </div>

                {/* Day cells */}
                {days.map((day, dayIndex) => (
                    <div
                        key={day}
                        // Multiply height by number of visible labels
                        className={`flex items-center justify-center bg-white font-bold text-gray-800 text-sm`}
                        style={{ height: `${visibleLabels.length * 40}px` }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Wrapper for the Grid part (Labels + Slots) to have a unified border */}
            <div className="flex flex-1 border border-gray-300 rounded-lg overflow-hidden ml-2">
                {/* Second column: Labels (Teacher, Class, Room) */}
                <div className="flex flex-col border-r border-gray-300">
                    {/* Slots header cell */}
                    <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 h-10 text-center text-sm font-bold text-gray-700 flex items-center justify-center">Slots</div>

                    {/* Labels repeated for each day */}
                    {days.map((day, dayIndex) => (
                        <div key={day} className={`flex flex-col ${dayIndex < days.length - 1 ? 'border-b border-gray-300' : ''}`}>
                            {visibleLabels.map((label, labelIndex) => (
                                <div
                                    key={label}
                                    className={`px-3 py-2 text-xs text-gray-600 bg-white h-10 flex items-center justify-center min-w-[80px] ${labelIndex < visibleLabels.length - 1 ? 'border-b border-gray-200' : ''}`}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Right section: Slot columns (1-12) */}
                <div className="flex-1 overflow-x-auto">
                    <div className="flex">
                        {slots.map((slot, slotIndex) => (
                            <div key={slot} className={`flex flex-col flex-1 min-w-[80px] ${slotIndex < slots.length - 1 ? 'border-r border-gray-300' : ''}`}>
                                {/* Slot header */}
                                <div className="bg-gray-100 border-b border-gray-300 px-2 py-2 text-center text-sm font-bold text-gray-700 h-10 flex items-center justify-center">
                                    {slot}
                                </div>

                                {/* Day cells */}
                                {days.map((day, dayIndex) => {
                                    const cellData = scheduleData[day]?.[slot];
                                    const hasData = cellData?.teacher || cellData?.classCode || cellData?.room;

                                    return (
                                        <div
                                            key={day}
                                            draggable={!!hasData}
                                            onDragStart={(e) => {
                                                if (hasData && cellData) {
                                                    const payload: DragPayload = {
                                                        source: 'GRID',
                                                        item: cellData,
                                                        day,
                                                        slot
                                                    };
                                                    const json = JSON.stringify(payload);
                                                    e.dataTransfer.setData('application/json', json);
                                                    e.dataTransfer.setData('text/plain', json);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();

                                                let data = e.dataTransfer.getData('application/json');
                                                if (!data) data = e.dataTransfer.getData('text/plain'); // Fallback

                                                if (data && data.trim().startsWith('{')) {
                                                    try {
                                                        const payload = JSON.parse(data) as DragPayload;
                                                        onDropPayload?.(day, slot, payload);
                                                    } catch (err) {
                                                        console.warn('Failed to parse dropped data:', err);
                                                    }
                                                }
                                            }}
                                            className={`flex flex-col cursor-pointer hover:opacity-80 transition-opacity ${dayIndex < days.length - 1 ? 'border-b border-gray-300' : ''}`}
                                            onClick={() => onCellClick?.(day, slot)}
                                        >
                                            <ScheduleCellDisplay
                                                data={cellData}
                                                visibleLabels={visibleLabels}
                                                className="h-full"
                                            />
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
