'use client';

/**
 * Shimmer skeleton matching TimetableGrid layout.
 * Shows while schedule data is loading.
 */
export default function TimetableGridSkeleton() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Summary'];
    const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rows = 3; // matches default visibleLabels count

    return (
        <div className="flex gap-0 overflow-hidden animate-pulse">
            {/* Day column */}
            <div className="flex flex-col min-w-[100px]">
                <div className="px-3 py-2 h-10 border-b border-transparent" />
                {days.map((day) => (
                    <div
                        key={day}
                        className="flex items-center justify-center bg-surface text-sm font-bold text-foreground-muted"
                        style={{ height: `${rows * 40}px` }}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex flex-1 border border-border-strong rounded-lg overflow-hidden ml-2">
                {/* Labels column */}
                <div className="flex flex-col border-r border-border-strong">
                    <div className="bg-surface-alt border-b border-border-strong px-3 py-2 h-10 text-center text-sm font-bold text-foreground-muted flex items-center justify-center">
                        Slots
                    </div>
                    {days.map((day, dayIndex) => (
                        <div key={day} className={dayIndex < days.length - 1 ? 'border-b border-border-strong' : ''}>
                            {['Teacher', 'Class', 'Room'].map((label, i) => (
                                <div
                                    key={label}
                                    className={`px-3 py-2 text-xs text-foreground-muted bg-surface h-10 flex items-center justify-center min-w-[80px] ${i < rows - 1 ? 'border-b border-border' : ''}`}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Slot columns */}
                <div className="flex-1 overflow-x-auto">
                    <div className="flex">
                        {slots.map((slot, slotIndex) => (
                            <div key={slot} className={`flex flex-col flex-1 min-w-[80px] ${slotIndex < slots.length - 1 ? 'border-r border-border-strong' : ''}`}>
                                <div className="bg-surface-alt border-b border-border-strong px-2 py-2 text-center text-sm font-bold text-foreground-muted h-10 flex items-center justify-center">
                                    {slot}
                                </div>
                                {days.map((day, dayIndex) => (
                                    <div
                                        key={day}
                                        className={`${dayIndex < days.length - 1 ? 'border-b border-border-strong' : ''}`}
                                        style={{ height: `${rows * 40}px` }}
                                    >
                                        {/* Shimmer block — only some cells filled to mimic real data */}
                                        {(slotIndex + dayIndex) % 3 !== 0 ? (
                                            <div className="h-full p-1.5 flex flex-col gap-1">
                                                <div className="h-3 w-10 bg-border rounded" />
                                                <div className="h-3 w-8 bg-border rounded" />
                                                <div className="h-3 w-12 bg-border rounded" />
                                            </div>
                                        ) : (
                                            <div className="h-full" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
