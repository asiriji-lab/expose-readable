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
        ? 'bg-surface'
        : data.variant === 'red'
            ? 'bg-pink-100'
            : 'bg-green-50';

    return (
        <div className={`flex flex-col h-full w-full ${bgColor} ${className}`}>
            {/* Subject */}
            {visibleLabels.includes('Subject') && (
                <div className={`px-2 py-2 text-xs font-semibold text-primary h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Subject') > 0 ? 'border-t border-border' : ''}`}>
                    {data?.subject || ''}
                </div>
            )}
            {/* Teacher */}
            {visibleLabels.includes('Teacher') && (
                <div className={`px-2 py-2 text-xs font-semibold text-foreground h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Teacher') > 0 ? 'border-t border-border' : ''}`}>
                    {data?.teacherName?.charAt(0)} {data?.teacher}
                </div>
            )}
            {/* Class */}
            {visibleLabels.includes('Class') && (
                <div className={`px-2 py-2 text-xs text-foreground-muted h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Class') > 0 ? 'border-t border-border' : ''}`}>
                    {data?.classCode || ''}
                </div>
            )}
            {/* Room */}
            {visibleLabels.includes('Room') && (
                <div className={`px-2 py-2 text-xs text-foreground-muted h-10 flex items-center justify-center ${visibleLabels.length > 1 && visibleLabels.indexOf('Room') > 0 ? 'border-t border-border' : ''}`}>
                    {data?.room || ''}
                </div>
            )}
        </div>
    );
}
