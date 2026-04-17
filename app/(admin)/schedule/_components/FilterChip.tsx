'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { TEACHER_META, CLASS_META, ROOM_META } from '../_utils/dummyData';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FilterEntityType = 'teacher' | 'class' | 'room';

interface FilterRecord {
    value: string;
    fields: Record<string, string>;
}

interface FilterChipProps {
    entityType: FilterEntityType;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    /** Called when the clear (✕) button is pressed */
    onClear?: () => void;
    /** If false, hides the clear button */
    clearable?: boolean;
}

// ─── Config per entity type ────────────────────────────────────────────────-

const ENTITY_CONFIG: Record<
    FilterEntityType,
    {
        label: string;
        color: { dot: string; chipBg: string; chipBorder: string; chipText: string; activeBg: string };
        searchableFields: string[];
        placeholder: string;
    }
> = {
    teacher: {
        label: 'T',
        color: {
            dot: 'bg-purple-500',
            chipBg: 'bg-purple-50',
            chipBorder: 'border-purple-200',
            chipText: 'text-purple-800',
            activeBg: 'bg-purple-100',
        },
        searchableFields: ["Teacher's code", "Teacher's name", "Teacher's surname"],
        placeholder: 'Search teacher…',
    },
    class: {
        label: 'C',
        color: {
            dot: 'bg-green-500',
            chipBg: 'bg-green-50',
            chipBorder: 'border-green-200',
            chipText: 'text-green-800',
            activeBg: 'bg-green-100',
        },
        searchableFields: ['Class', "Default Room's code"],
        placeholder: 'Search class…',
    },
    room: {
        label: 'R',
        color: {
            dot: 'bg-orange-500',
            chipBg: 'bg-orange-50',
            chipBorder: 'border-orange-200',
            chipText: 'text-orange-800',
            activeBg: 'bg-orange-100',
        },
        searchableFields: ["Room's code", "Room's name"],
        placeholder: 'Search room…',
    },
};

// ─── Helper: display name after selection ─────────────────────────────────--

function getEntityDisplayName(entityType: FilterEntityType, value: string): string {
    if (entityType === 'teacher') {
        const meta = TEACHER_META[value];
        return meta ? `${meta.firstName} ${meta.lastName}` : '';
    }
    if (entityType === 'class') {
        return CLASS_META[value]?.defaultRoom ? `Rm ${CLASS_META[value].defaultRoom}` : '';
    }
    if (entityType === 'room') {
        return ROOM_META[value]?.name ?? '';
    }
    return '';
}

// ─── Helper: build records list ────────────────────────────────────────────--

function buildRecords(entityType: FilterEntityType, options: string[]): FilterRecord[] {
    if (entityType === 'teacher') {
        return options.map(opt => {
            const meta = TEACHER_META[opt];
            return {
                value: opt,
                fields: {
                    "Teacher's code": opt,
                    "Teacher's name": meta?.firstName ?? opt,
                    "Teacher's surname": meta?.lastName ?? '',
                },
            };
        });
    }
    if (entityType === 'class') {
        return options.map(opt => ({
            value: opt,
            fields: {
                'Class': opt,
                "Default Room's code": CLASS_META[opt]?.defaultRoom ?? '',
            },
        }));
    }
    // room
    return options.map(opt => ({
        value: opt,
        fields: {
            "Room's code": opt,
            "Room's name": ROOM_META[opt]?.name ?? opt,
        },
    }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FilterChip({
    entityType,
    value,
    options,
    onChange,
    onClear,
    clearable = true,
}: FilterChipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const config = ENTITY_CONFIG[entityType];
    const searchableFields = config.searchableFields;
    const [selectedFields, setSelectedFields] = useState<string[]>([searchableFields[0]]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSelectedFields([searchableFields[0]]);
        setSearchText('');
    }, [entityType, searchableFields]);

    useEffect(() => {
        if (isOpen) {
            // defer so the input is mounted
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    const records = useMemo(() => buildRecords(entityType, options), [entityType, options]);

    const filteredRecords = useMemo(() => {
        const kw = searchText.trim().toLowerCase();
        if (!kw) return records;
        return records.filter(r =>
            selectedFields.some(f => (r.fields[f] ?? '').toLowerCase().includes(kw))
        );
    }, [records, searchText, selectedFields]);

    const toggleField = (field: string) => {
        setSelectedFields(prev => {
            if (prev.includes(field)) {
                return prev.length === 1 ? prev : prev.filter(f => f !== field);
            }
            return [...prev, field];
        });
    };

    const displayName = getEntityDisplayName(entityType, value);
    const c = config.color;

    return (
        <div className="relative inline-flex items-center">
            {/* Chip trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${c.chipBg} ${c.chipBorder} ${c.chipText} hover:${c.activeBg}`}
            >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className="font-semibold">{config.label}:</span>
                <span>{value}</span>
                {displayName && <span className="text-xs font-normal opacity-70">— {displayName}</span>}
                <svg className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Clear button */}
            {clearable && onClear && (
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onClear(); }}
                    className={`ml-0.5 p-0.5 rounded-full hover:bg-black/10 transition-colors ${c.chipText}`}
                    title="Clear filter"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}

            {/* Anchored popover */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => { setIsOpen(false); setSearchText(''); }} />
                    <div className="absolute left-0 top-full mt-1 z-40 w-[380px] max-w-[92vw] rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
                        {/* Popover header with entity color */}
                        <div className={`flex items-center gap-2 px-3 py-2 border-b border-border ${c.chipBg}`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wide ${c.chipText}`}>
                                {entityType === 'teacher' ? 'Teacher' : entityType === 'class' ? 'Class' : 'Room'}
                            </span>
                        </div>

                        {/* Search input */}
                        <div className="px-3 py-2 border-b border-border">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-foreground-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    placeholder={config.placeholder}
                                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
                                />
                            </div>
                        </div>

                        {/* Field filter chips */}
                        <div className="px-3 py-1.5 border-b border-border flex flex-wrap gap-1.5">
                            {searchableFields.map(field => (
                                <button
                                    key={field}
                                    type="button"
                                    onClick={() => toggleField(field)}
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${selectedFields.includes(field)
                                        ? 'bg-primary text-white'
                                        : 'bg-surface-alt text-foreground-muted hover:bg-border'
                                    }`}
                                >
                                    {field}
                                </button>
                            ))}
                        </div>

                        {/* Results table */}
                        <div className="max-h-[240px] overflow-auto">
                            {/* Table header */}
                            <div
                                className="grid sticky top-0 bg-surface-alt text-xs font-semibold text-foreground-muted border-b border-border"
                                style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}
                            >
                                {searchableFields.map(field => (
                                    <div key={field} className="px-3 py-1.5 border-r border-border last:border-r-0 truncate">{field}</div>
                                ))}
                            </div>

                            {/* Table rows */}
                            {filteredRecords.map(record => (
                                <button
                                    key={record.value}
                                    type="button"
                                    onClick={() => { onChange(record.value); setIsOpen(false); setSearchText(''); }}
                                    className={`grid w-full text-left text-sm border-b border-border last:border-b-0 hover:bg-surface-alt transition-colors ${
                                        value === record.value ? 'bg-primary/10 font-medium' : 'text-foreground-muted'
                                    }`}
                                    style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}
                                >
                                    {searchableFields.map(field => (
                                        <span key={field} className="px-3 py-1.5 border-r border-border last:border-r-0 truncate text-foreground">
                                            {record.fields[field] ?? '—'}
                                        </span>
                                    ))}
                                </button>
                            ))}
                            {filteredRecords.length === 0 && (
                                <p className="px-3 py-4 text-center text-sm text-foreground-muted">No results</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
