import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx-js-style';
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";

import { ColumnRule } from './validationUtils';

interface CsvEditorProps {
    file: File;
    onClose: () => void;
    onSave?: (newFile: File) => void;
    validationRules?: Record<number, ColumnRule>;
    catchAllRule?: ColumnRule;
}

interface SheetData {
    name: string;
    celldata: CellData[];
    order: number;
    status: number;
}

interface CellData {
    r: number;
    c: number;
    v: CellValue | null;
}

interface CellValue {
    v: string | number | undefined;
    m?: string | number;
    bg?: string;
    ps?: {
        value: string;
        isShow: boolean;
    } | undefined;
    ct?: { fa: string; t: string };
}

interface Op {
    op: 'replace' | 'add' | 'remove';
    path: (string | number)[];
    value?: any;
}

interface WorkbookInstance {
    getAllSheets: () => any[];
    getSheet: (index: number) => { data: any[] };
    setCellFormat: (r: number, c: number, key: string, value: any) => void;
}

export default function CsvEditor({ file, onClose, onSave, validationRules, catchAllRule }: CsvEditorProps) {
    const [sheetData, setSheetData] = useState<SheetData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const workbookRef = useRef<any>(null); // Using any for library ref compatibility
    const rulesRef = useRef<Record<number, ColumnRule> | undefined>(validationRules);
    const catchAllRef = useRef<ColumnRule | undefined>(catchAllRule);
    // Fix #1: track pending cell-format timeouts so we can cancel stale ones on rapid typing
    const pendingFormatOps = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Update rules ref when prop changes
    useEffect(() => {
        rulesRef.current = validationRules;
        catchAllRef.current = catchAllRule;
    }, [validationRules, catchAllRule]);

    // Helper to validate a single value against a rule
    // Returns null if valid, or error message string if invalid
    // `row` is the full row of string values needed for cross-column `validate()` rules
    const validateValue = useCallback((
        colIndex: number,
        value: string | number | null | undefined,
        row: (string | number | null | undefined)[] = []
    ): string | null => {
        const rule = rulesRef.current?.[colIndex] || catchAllRef.current;
        if (!rule) return null;

        const val = value !== null && value !== undefined ? String(value).trim() : '';
        const stringRow = row.map(v => (v !== null && v !== undefined ? String(v) : ''));

        if (rule.required && val === '') {
            return "Required field missing.";
        }

        if (val === '') {
            // Even if empty, run custom validate() because it might be required based on other columns
            if (rule.validate) {
                const customError = rule.validate(val, stringRow);
                if (customError) return customError;
            }
            return null;
        }

        if (rule.pattern && !rule.pattern.test(val)) {
            return rule.message || "Invalid value";
        }

        // Run cross-column custom validation if present
        if (rule.validate) {
            const customError = rule.validate(val, stringRow);
            if (customError) return customError;
        }

        return null;
    }, []);

    useEffect(() => {
        // Fix #2: guard against stale async parses when file prop changes mid-flight
        let cancelled = false;
        setIsLoading(true);
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        const processData = (rows: string[][]) => {
            if (cancelled) return;
            const celldata: CellData[] = [];

            rows.forEach((row, r) => {
                // Check for Grade Header (e.g., "ม.1") in the first column
                const isGradeHeader = r > 0 && row[0] && /^ม\.\d/.test(String(row[0]));

                row.forEach((cell, c) => {
                    if (cell !== null && cell !== undefined && cell !== '') {
                        let bg = undefined;
                        let ps = undefined;

                        // Validation Logic (Initial Load)
                        // Skip header row (r=0) and Grade Header rows
                        // Pass the full `row` for cross-column rule support
                        if ((rulesRef.current || catchAllRef.current) && r > 0 && !isGradeHeader) {
                            const errorMsg = validateValue(c, cell, row);
                            if (errorMsg) {
                                bg = "#ffcccc";
                                ps = {
                                    value: errorMsg,
                                    isShow: false
                                } as any;
                            }
                        }

                        celldata.push({
                            r,
                            c,
                            v: {
                                v: cell,
                                m: String(cell),
                                bg: bg,
                                ps: ps,
                                ct: { fa: "General", t: "g" }
                            }
                        });
                    }
                });
            });

            setSheetData([{
                name: "Sheet1",
                celldata: celldata,
                order: 0,
                status: 1
            }]);
            setIsLoading(false);
        };

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result;
                if (data) {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
                    processData(jsonData);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                complete: (results) => {
                    const parsedData = results.data as string[][];
                    processData(parsedData);
                },
                error: (error) => {
                    if (cancelled) return;
                    console.error('Error parsing CSV:', error);
                    setIsLoading(false);
                },
                header: false
            });
        }
        // Fix #2: cleanup — mark any in-flight parse as cancelled
        return () => { cancelled = true; };
    }, [file, validateValue]);

    const getSheetData = () => {
        if (!workbookRef.current) return [];
        const sheets = workbookRef.current.getAllSheets();
        const sheet = sheets[0];

        let rows: string[][] = [];

        if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
            rows = sheet.data.map((row: CellValue[]) => {
                if (!Array.isArray(row)) return [];
                return row.map(cell => {
                    if (cell && cell.v !== undefined) return String(cell.v);
                    return '';
                });
            });
        } else {
            let maxRow = 0;
            let maxCol = 0;
            const celldata = sheet.celldata || [];

            const dataMap = new Map<string, any>();
            celldata.forEach((cell: any) => {
                if (cell.r > maxRow) maxRow = cell.r;
                if (cell.c > maxCol) maxCol = cell.c;
                dataMap.set(`${cell.r},${cell.c}`, cell.v?.v || '');
            });

            for (let r = 0; r <= maxRow; r++) {
                const row: string[] = [];
                for (let c = 0; c <= maxCol; c++) {
                    const val = dataMap.get(`${r},${c}`);
                    row.push(val !== undefined ? String(val) : '');
                }
                rows.push(row);
            }
        }
        return rows;
    };

    const handleSave = () => {
        if (!onSave) return;
        const rows = getSheetData();
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        if (isExcel) {
            const worksheet = XLSX.utils.aoa_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const newFile = new File([excelBuffer], file.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            onSave(newFile);
        } else {
            const csvString = Papa.unparse(rows);
            const newFile = new File([csvString], file.name, { type: 'text/csv' });
            onSave(newFile);
        }

        onClose();
    };

    const handleDownload = () => {
        const rows = getSheetData();
        const csvString = Papa.unparse(rows);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "edited_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOp = useCallback((op: any) => {
        if (!workbookRef.current) return;

        const ops = Array.isArray(op) ? op : [op];

        ops.forEach((o: any) => {
            if ((o.op === 'replace' || o.op === 'add' || o.op === 'remove') && o.path) {
                const path = o.path;

                if (path[0] === 'data' && typeof path[1] === 'number' && typeof path[2] === 'number') {
                    const r = path[1];
                    const c = path[2];
                    const prop = path[3];

                    // Ignore formatting operations completely to prevent infinite loops (race condition fix)
                    if (prop === 'bg' || prop === 'ps') return;
                    if (prop && prop !== 'v' && prop !== 'm') return;

                    let newValue: string | number | undefined;
                    if (path.length === 3) {
                        // Replaced the whole cell object
                        // If it's just entering edit mode, FortuneSheet might omit 'v' or send it as null.
                        // We fallback to 'm' (formatted text) to prevent triggering "Required field missing" while editing.
                        if (o.value && typeof o.value === 'object') {
                            if (!('v' in o.value) && !('m' in o.value)) return;
                            newValue = o.value.v !== undefined && o.value.v !== null ? o.value.v : o.value.m;
                        } else {
                            newValue = o.value?.v;
                        }
                    } else if (prop === 'v' || prop === 'm') {
                        // Replaced specific string value 'v'
                        newValue = o.value;
                    }

                    // If newValue is still undefined after extraction, this op is a no-value event
                    // (e.g. FortuneSheet activating/entering edit mode for the cell without changing it).
                    // The cell already has the correct validation colour from initial load — skip re-validation
                    // to avoid falsely marking required-but-populated cells as errors.
                    if (newValue === undefined) return;

                    // Get first column value for Grade Header check
                    // Also extract the full row for cross-column rule validation
                    const sheet = workbookRef.current.getSheet(0);
                    const rowData = sheet.data?.[r];
                    let firstColValue;

                    if (c === 0) {
                        firstColValue = newValue;
                    } else {
                        firstColValue = rowData?.[0]?.v;
                    }

                    // Build the full row array, injecting the in-flight new value at its column
                    const fullRow: (string | number | null | undefined)[] = [];
                    if (Array.isArray(rowData)) {
                        rowData.forEach((cell: any, idx: number) => {
                            fullRow[idx] = idx === c ? newValue : (cell?.v ?? null);
                        });
                    } else {
                        fullRow[c] = newValue;
                    }

                    const isGradeHeader = firstColValue && /^ม\.\d/.test(String(firstColValue));

                    // Validation processing
                    // Skip if index 0 (headers) or if it's a Grade Header row
                    if (r === 0 || isGradeHeader) {
                        workbookRef.current.setCellFormat(r, c, "bg", "#ffffff");
                        workbookRef.current.setCellFormat(r, c, "ps", undefined);
                    } else {
                        // Pass full row for cross-column custom validate() functions
                        const errorMsg = validateValue(c, newValue, fullRow);
                        const isValid = errorMsg === null;
                        const bg = isValid ? "#ffffff" : "#ffcccc";
                        const ps = isValid ? undefined : {
                            value: errorMsg,
                            isShow: false
                        } as any;

                        // Fix #1: cancel any previous pending format update for this cell
                        // before scheduling a new one, to prevent stale ops from racing ahead
                        const cellKey = `${r},${c}`;
                        if (pendingFormatOps.current.has(cellKey)) {
                            clearTimeout(pendingFormatOps.current.get(cellKey));
                        }
                        // Update formats asynchronously so FortuneSheet commits the text change before we paint the background
                        const timerId = setTimeout(() => {
                            pendingFormatOps.current.delete(cellKey);
                            if (workbookRef.current) {
                                workbookRef.current.setCellFormat(r, c, "bg", bg);
                                workbookRef.current.setCellFormat(r, c, "ps", ps);
                            }
                        }, 0);
                        pendingFormatOps.current.set(cellKey, timerId);
                    }
                }
            }
        });
    }, [validateValue]);

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Edit {file.name.endsWith('.xlsx') ? 'Excel' : 'CSV'}</h1>
                        <p className="text-sm text-gray-500">{file.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download CSV
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                        onClick={handleSave}
                    >
                        Save Changes
                    </button>
                </div>
            </header>

            {/* Editor Content */}
            <div className="flex-1 bg-gray-50 overflow-hidden relative">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <Workbook
                        key={file.name + file.lastModified}
                        ref={workbookRef}
                        data={sheetData as any}
                        onOp={handleOp}
                    />
                )}
            </div>
        </div>
    );
}
