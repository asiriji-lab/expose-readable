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
            <label className={`text-xs text-black font-medium whitespace-nowrap ${labelClassName}`}>{label}</label>

            {/* Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors text-xs min-w-[100px]"
                >
                    <span className="text-gray-900">{value}</span>
                    <svg
                        className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-30 bg-black/20"
                            onClick={() => {
                                setIsOpen(false);
                                setSearchText('');
                            }}
                        />
                        <div className="fixed top-1/2 left-1/2 z-40 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                            <div className="bg-indigo-100 px-5 py-3 border-b border-gray-200">
                                <h3 className="text-2xl font-semibold text-gray-900">Search : {searchTitle}</h3>
                            </div>

                            <div className="px-5 py-4 border-b border-gray-100">
                                <p className="text-3xl leading-none mb-3 text-gray-900">Filter</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
                                    {searchableFields.map((field) => (
                                        <label key={field} className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                                                checked={selectedFields.includes(field)}
                                                onChange={() => toggleField(field)}
                                            />
                                            <span>{field}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="px-3 py-1 rounded bg-indigo-100 border border-indigo-200 text-sm font-semibold text-gray-700"
                                    >
                                        Search
                                    </button>
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(event) => setSearchText(event.target.value)}
                                        placeholder="Text"
                                        className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm text-gray-700"
                                    />
                                </div>
                            </div>

                            <div className="max-h-[320px] overflow-auto px-5 py-3">
                                <div className="border border-gray-300 rounded-sm overflow-hidden">
                                    <div className="grid border-b border-gray-300 bg-indigo-100 text-xs font-semibold text-gray-700" style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}>
                                        {searchableFields.map((field) => (
                                            <div key={field} className="px-3 py-2 border-r border-gray-300 last:border-r-0">{field}</div>
                                        ))}
                                    </div>

                                    {filteredRecords.map((record) => (
                                        <button
                                            key={record.value}
                                            type="button"
                                            onClick={() => {
                                                onChange(record.value);
                                                setIsOpen(false);
                                                setSearchText('');
                                            }}
                                            className={`grid w-full text-left text-sm border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors ${value === record.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                            style={{ gridTemplateColumns: `repeat(${searchableFields.length}, minmax(0, 1fr))` }}
                                        >
                                            {searchableFields.map((field) => (
                                                <span key={field} className="px-3 py-2 border-r border-gray-200 last:border-r-0 truncate">
                                                    {record.fields[field] || '-'}
                                                </span>
                                            ))}
                                        </button>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <p className="px-3 py-6 text-center text-sm text-gray-500">No result found</p>
                                    )}
                                </div>
                            </div>

                            <div className="px-5 py-3 flex justify-end border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        setSearchText('');
                                    }}
                                    className="px-6 py-1 rounded bg-indigo-100 text-gray-700 font-semibold hover:bg-indigo-200 transition-colors"
                                >
                                    Back
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
