'use client';

interface ViewModeToggleProps {
    activeMode: 'all' | 'teacher' | 'class' | 'room';
    onChange: (mode: 'all' | 'teacher' | 'class' | 'room') => void;
}

export default function ViewModeToggle({ activeMode, onChange }: ViewModeToggleProps) {
    const modes = [
        {
            id: 'all' as const,
            label: 'View all',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            )
        },
        {
            id: 'teacher' as const,
            label: "Teacher's view",
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )
        },
        {
            id: 'class' as const,
            label: 'Class view',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
            )
        },
        {
            id: 'room' as const,
            label: 'Room view',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        }
    ];

    const activeIndex = modes.findIndex((mode) => mode.id === activeMode);

    return (
        <div className="relative inline-grid grid-cols-4 rounded-xl bg-surface-alt p-1 border border-border overflow-hidden">
            <span
                className="absolute top-1 bottom-1 left-1 rounded-lg bg-surface border border-border shadow-sm transition-transform duration-300 ease-out"
                style={{
                    width: 'calc((100% - 8px) / 4)',
                    transform: `translateX(${activeIndex * 100}%)`,
                }}
            />
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onChange(mode.id)}
                    className={`relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeMode === mode.id
                            ? 'text-primary'
                            : 'text-foreground hover:bg-surface/60'
                        }`}
                >
                    {mode.icon}
                    <span>{mode.label}</span>
                </button>
            ))}
        </div>
    );
}
