import { ScheduleItem, DragPayload } from '../_utils/dummyData';
import ScheduleCellDisplay from './ScheduleCellDisplay';

interface TeachingSlotSidebarProps {
    presets: ScheduleItem[];
    onDropPayload?: (payload: DragPayload) => void;
    onDeletePreset?: (index: number) => void;
}

export default function TeachingSlotSidebar({ presets, onDropPayload, onDeletePreset }: TeachingSlotSidebarProps) {

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Essential to allow dropping
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        let data = e.dataTransfer.getData('application/json');
        if (!data) data = e.dataTransfer.getData('text/plain');

        if (data && data.trim().startsWith('{')) {
            try {
                const payload = JSON.parse(data) as DragPayload;
                // Add to presets logic is handled by parent if payload is valid
                onDropPayload?.(payload);
            } catch (err) {
                console.warn('Failed to parse dropped data', err);
            }
        }
    };

    return (
        <div
            className="bg-orange-50 border border-orange-200 rounded-lg p-3 w-[200px] flex flex-col h-full"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-300 relative">
                <div className="absolute -top-6 -left-4 bg-orange-400 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-sm z-10 border border-white">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-semibold text-xs">Teaching slot</span>
                </div>
            </div>

            {/* Presets List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar pt-2">
                {presets.length === 0 ? (
                    <div className="text-xs text-orange-400 text-center py-4 border-2 border-dashed border-orange-200 rounded-lg">
                        Drag a class here
                    </div>
                ) : (
                    presets.map((item, index) => (
                        <div
                            key={index}
                            draggable
                            onDragStart={(e) => {
                                const payload: DragPayload = {
                                    source: 'SIDEBAR',
                                    item: item,
                                    index: index
                                };
                                const json = JSON.stringify(payload);
                                e.dataTransfer.setData('application/json', json);
                                e.dataTransfer.setData('text/plain', json); // Fallback
                                e.dataTransfer.effectAllowed = 'move';
                            }}
                            className="bg-white border border-gray-400 rounded-lg shadow-sm relative group cursor-grab hover:shadow-md transition-shadow overflow-hidden mx-auto w-[160px] h-[100px]"
                        >
                            {/* Content */}
                            <ScheduleCellDisplay
                                data={item}
                                visibleLabels={['Teacher', 'Class', 'Room']}
                                className="h-full"
                            />

                            {/* Delete button (only for manual cleanup, but drag also removes now) */}
                            <button
                                onClick={() => onDeletePreset?.(index)}
                                className="absolute top-1 right-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
