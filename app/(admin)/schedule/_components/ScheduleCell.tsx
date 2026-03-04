interface ScheduleCellProps {
    teacher?: string;
    classCode?: string;
    room?: string;
    variant?: 'red' | 'green' | 'empty';
    onClick?: () => void;
}

export default function ScheduleCell({ teacher, classCode, room, variant = 'empty', onClick }: ScheduleCellProps) {
    const variantStyles = {
        red: 'bg-red-200 border-red-300 hover:bg-red-250',
        green: 'bg-green-200 border-green-300 hover:bg-green-250',
        empty: 'bg-surface border-border hover:bg-background'
    };

    if (!teacher && !classCode && !room) {
        return (
            <div
                className={`border ${variantStyles.empty} transition-colors cursor-pointer min-h-[60px]`}
                onClick={onClick}
            />
        );
    }

    return (
        <div
            className={`border ${variantStyles[variant]} transition-colors cursor-pointer p-2 min-h-[60px] flex flex-col justify-center`}
            onClick={onClick}
        >
            <div className="text-xs font-semibold text-foreground">{teacher}</div>
            <div className="text-xs text-foreground-muted">{classCode}</div>
            <div className="text-xs text-foreground-muted">{room}</div>
        </div>
    );
}
