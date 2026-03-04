import { ScheduleItem } from '../_utils/dummyData';

interface ScheduleCellDisplayProps {
    data: ScheduleItem;
    visibleLabels?: string[]; // Optional, defaults to all if not provided
    className?: string; // For additional styling (borders etc)
}

export default function ScheduleCellDisplay({ data, visibleLabels = ['Teacher', 'Class', 'Room'], className = '' }: ScheduleCellDisplayProps) {
    const hasData = !!data;

    // Determine background color based on variant
    const bgColor = !hasData
        ? 'bg-white'
        : data.variant === 'red'
            ? 'bg-pink-100'
            : 'bg-green-50';

    return (
        <div className={`flex flex-col h-full w-full ${bgColor} ${className}`}>
            {/* Subject */}
            {visibleLabels.includes('Subject') && (
                <div className={`px-2 py-2 text-xs font-semibold text-blue-700 h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Subject') > 0 ? 'border-t border-gray-200' : ''}`}>
                    {data?.subject || ''}
                </div>
            )}
            {/* Teacher */}
            {visibleLabels.includes('Teacher') && (
                <div className={`px-2 py-2 text-xs font-semibold text-gray-800 h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Teacher') > 0 ? 'border-t border-gray-200' : ''}`}>
                    {data?.teacherName?.charAt(0)} {data?.teacher}
                </div>
            )}
            {/* Class */}
            {visibleLabels.includes('Class') && (
                <div className={`px-2 py-2 text-xs text-gray-700 h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Class') > 0 ? 'border-t border-gray-200' : ''}`}>
                    {data?.classCode || ''}
                </div>
            )}
            {/* Room */}
            {visibleLabels.includes('Room') && (
                <div className={`px-2 py-2 text-xs text-gray-700 h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Room') > 0 ? 'border-t border-gray-200' : ''}`}>
                    {data?.room || ''}
                </div>
            )}
        </div>
    );
}
