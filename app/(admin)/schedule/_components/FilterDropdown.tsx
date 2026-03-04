'use client';

import { useEffect, useMemo, useState } from 'react';

interface FilterDropdownProps {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    labelClassName?: string;
}

interface SearchRecord {
    value: string;
    fields: Record<string, string>;
}

export default function FilterDropdown({ label, value, options, onChange, labelClassName = "w-14" }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');

    const searchableFields = useMemo(() => {
        if (label.toLowerCase().includes('t.')) {
            return ["Teacher's code", "Teacher's name", "Teacher's surname"];
        }
        if (label.toLowerCase().includes('room')) {
            return ["Room's code", "Room's name"];
        }
        return ['Class', "Default Room's code"];
    }, [label]);

    const [selectedFields, setSelectedFields] = useState<string[]>(() => [searchableFields[0]]);

    useEffect(() => {
        setSelectedFields([searchableFields[0]]);
        setSearchText('');
    }, [searchableFields]);

    const records = useMemo<SearchRecord[]>(() => {
        if (label.toLowerCase().includes('t.')) {
            const teacherNames = ['ธนาโชค', 'ณัฐกร', 'วิชิรวิทย์', 'ธัญญวุฒิ', 'ศศิธร'];
            const teacherSurnames = ['ใจดี', 'วงศ์ประเสริฐ', 'อำนาจกิจ', 'เพ็ชร์ดี', 'กล้าหาญ'];

            return options.map((option, index) => ({
                value: option,
                fields: {
                    "Teacher's code": option,
                    "Teacher's name": teacherNames[index % teacherNames.length],
                    "Teacher's surname": teacherSurnames[index % teacherSurnames.length],
                },
            }));
        }

        if (label.toLowerCase().includes('room')) {
            const roomNameByCode: Record<string, string> = {
                '7401': 'Computer room',
                '7402': 'Chemistry Lab',
                '7403': 'Science Lab',
            };

            return options.map((option) => ({
                value: option,
                fields: {
                    "Room's code": option,
                    "Room's name": roomNameByCode[option] || option,
                },
            }));
        }

        const defaultRoomByClass: Record<string, string> = {
            '6/15': '5410',
            '6/16': '5409',
            '6/17': '5408',
            '7/1': '5407',
            '7/2': '5406',
        };

        return options.map((option) => ({
            value: option,
            fields: {
                Class: option,
                "Default Room's code": defaultRoomByClass[option] || '5401',
            },
        }));
    }, [label, options]);

    const filteredRecords = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();
        if (!keyword) return records;

        return records.filter((record) => {
            return selectedFields.some((field) => (record.fields[field] || '').toLowerCase().includes(keyword));
        });
    }, [records, searchText, selectedFields]);

    const searchTitle = useMemo(() => {
        if (label.toLowerCase().includes('t.')) return 'Teacher';
        if (label.toLowerCase().includes('room')) return 'Room';
        return 'Class';
    }, [label]);

    const toggleField = (field: string) => {
        setSelectedFields((prev) => {
            if (prev.includes(field)) {
                if (prev.length === 1) return prev;
                return prev.filter((item) => item !== field);
            }
            return [...prev, field];
        });
    };

    return (
        <div className="flex items-center gap-2">
            {/* Label on the left with fixed width */}
            <label className={`text-xs text-foreground font-medium whitespace-nowrap ${labelClassName}`}>{label}</label>

            {/* Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 border border-border-strong rounded bg-surface hover:bg-background transition-colors text-xs min-w-[100px]"
                >
                    <span className="text-foreground">{value}</span>
                    <svg
                        className={`w-3 h-3 text-foreground-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <>
                        {/* Transparent backdrop — closes dropdown on outside click */}
                        <div
                            className="fixed inset-0 z-30"
                            onClick={() => {
                                setIsOpen(false);
                                setSearchText('');
                            }}
                        />

                        {/* Anchored popover */}
                        <div className="absolute left-0 top-full mt-1 z-40 w-[380px] max-w-[90vw] rounded-xl border border-border bg-surface shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
                            {/* Search input (always visible at top) */}
                            <div className="px-3 py-2 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-foreground-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        placeholder={`Search ${searchTitle.toLowerCase()}…`}
                                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Field filter chips */}
                            <div className="px-3 py-1.5 border-b border-border flex flex-wrap gap-1.5">
                                {searchableFields.map((field) => (
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
                            <div className="max-h-[260px] overflow-auto">
                                {/* Table header */}
                                <div
                                    className="grid sticky top-0 bg-surface-alt text-xs font-semibold text-foreground-muted border-b border-border"
                                    style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}
                                >
                                    {searchableFields.map((field) => (
                                        <div key={field} className="px-3 py-1.5 border-r border-border last:border-r-0 truncate">{field}</div>
                                    ))}
                                </div>

                                {/* Table rows */}
                                {filteredRecords.map((record) => (
                                    <button
                                        key={record.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(record.value);
                                            setIsOpen(false);
                                            setSearchText('');
                                        }}
                                        className={`grid w-full text-left text-sm border-b border-border last:border-b-0 hover:bg-surface-alt transition-colors ${value === record.value ? 'bg-primary-light text-primary font-medium' : 'text-foreground-muted'}`}
                                        style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}
                                    >
                                        {searchableFields.map((field) => (
                                            <span key={field} className="px-3 py-1.5 border-r border-border last:border-r-0 truncate">
                                                {record.fields[field] || '-'}
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
        </div>
    );
}
