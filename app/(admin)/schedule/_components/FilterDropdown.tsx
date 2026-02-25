'use client';

import { useState } from 'react';

interface FilterDropdownProps {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    labelClassName?: string;
}

export default function FilterDropdown({ label, value, options, onChange, labelClassName = "w-14" }: FilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

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
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        />
                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-auto">
                            {options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => {
                                        onChange(option);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${value === option ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
