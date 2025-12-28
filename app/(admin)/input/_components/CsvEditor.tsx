import React, { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";

interface CsvEditorProps {
    file: File;
    onClose: () => void;
    onSave?: (newFile: File) => void;
    validationRules?: Record<number, { pattern: RegExp; message: string }>;
}

export default function CsvEditor({ file, onClose, onSave, validationRules }: CsvEditorProps) {
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const workbookRef = useRef<any>(null);
    const rulesRef = useRef<Record<number, { pattern: RegExp; message: string }> | undefined>(validationRules);
    const isInternalChange = useRef(false);

    // Update rules ref when prop changes
    useEffect(() => {
        rulesRef.current = validationRules;
    }, [validationRules]);

    // Helper to validate a single value against a rule
    // Returns null if valid, or error message string if invalid
    const validateValue = useCallback((colIndex: number, value: any): string | null => {
        // Allow empty values to be valid (reset to white)
        if (value === null || value === undefined || String(value).trim() === '') return null;

        const rules = rulesRef.current;
        if (!rules) return null;

        const rule = rules[colIndex];
        if (!rule) return null;

        const isValid = rule.pattern.test(String(value));
        return isValid ? null : rule.message;
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        const processData = (rows: string[][]) => {
            const celldata: any[] = [];

            rows.forEach((row, r) => {
                // Check for Grade Header (e.g., "ม.1") in the first column
                const isGradeHeader = r > 0 && row[0] && /^ม\.\d/.test(String(row[0]));

                row.forEach((cell, c) => {
                    if (cell !== null && cell !== undefined && cell !== '') {
                        let bg = undefined;
                        let ps = undefined;

                        // Validation Logic (Initial Load)
                        // Skip header row (r=0) and Grade Header rows
                        if (rulesRef.current && r > 0 && !isGradeHeader) {
                            const errorMsg = validateValue(c, cell);
                            if (errorMsg) {
                                bg = "#ffcccc";
                                ps = { value: errorMsg, isshow: false, width: 250, height: 120 };
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
                    console.error('Error parsing CSV:', error);
                    setIsLoading(false);
                },
                header: false
            });
        }
    }, [file, validateValue]);

    const getSheetData = () => {
        if (!workbookRef.current) return [];
        const sheets = workbookRef.current.getAllSheets();
        const sheet = sheets[0];

        let rows: string[][] = [];

        if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
            rows = sheet.data.map((row: any[]) => {
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

    // Use onOp to detect changes and validate
    const handleOp = useCallback((op: any) => {
        if (!workbookRef.current) return;

        // Ignore internal changes to prevent feedback loops
        if (isInternalChange.current) {
            console.log("Ignoring internal change");
            return;
        }

        // Handle array of ops or single op
        const ops = Array.isArray(op) ? op : [op];

        ops.forEach((o: any) => {
            if ((o.op === 'replace' || o.op === 'add' || o.op === 'remove') && o.path) {
                const path = o.path;
                console.log("Op:", o.op, "Path:", path, "Value:", o.value);

                // path: ["data", r, c, prop?] based on logs
                if (path[0] === 'data' && typeof path[1] === 'number' && typeof path[2] === 'number') {
                    const r = path[1];
                    const c = path[2];
                    const prop = path[3]; // 'v', 'm', 'bg', etc.

                    // Ignore style updates to prevent infinite loops
                    // We only care about value updates ('v') or whole cell updates
                    if (prop === 'bg' || prop === 'ps') {
                        console.log("Ignoring style update:", prop);
                        return;
                    }

                    // Only validate on 'v' change or whole cell change to avoid redundant checks
                    if (prop && prop !== 'v') {
                        console.log("Ignoring non-value prop:", prop);
                        return;
                    }

                    // Get new value
                    let newValue;
                    if (path.length === 3) {
                        // Replaced whole cell
                        // If 'v' is not present in the update object, assume value is unchanged
                        // This filters out style updates (bg, ps) or other prop updates that don't affect value
                        if (o.value && typeof o.value === 'object' && !('v' in o.value)) {
                            console.log("Ignoring whole cell update without 'v'");
                            return;
                        }
                        newValue = o.value?.v;
                    } else if (prop === 'v') {
                        // Replaced value
                        newValue = o.value;
                    } else {
                        // For remove op, newValue remains undefined
                    }

                    console.log("Processing value change. NewValue:", newValue);

                    // Ignore replace operations where newValue is null/undefined
                    // This prevents style updates from resetting validation
                    // Clearing a cell usually sends 'remove' op on 'v', which we handle below
                    if (o.op === 'replace' && (newValue === null || newValue === undefined)) {
                        console.log("Ignoring replace with null/undefined value");
                        return;
                    }

                    // Get first column value for Grade Header check
                    const sheet = workbookRef.current.getSheet(0);
                    const rowData = sheet.data?.[r];
                    let firstColValue;

                    if (c === 0) {
                        firstColValue = newValue;
                    } else {
                        firstColValue = rowData?.[0]?.v;
                    }

                    const isGradeHeader = firstColValue && /^ม\.\d/.test(String(firstColValue));

                    if (isGradeHeader) {
                        isInternalChange.current = true;
                        setTimeout(() => {
                            workbookRef.current.setCellFormat(r, c, "bg", "#ffffff");
                            workbookRef.current.setCellFormat(r, c, "ps", null);
                            setTimeout(() => { isInternalChange.current = false; }, 50);
                        }, 0);
                        return;
                    }

                    const errorMsg = validateValue(c, newValue);
                    const isValid = errorMsg === null;
                    const bg = isValid ? "#ffffff" : "#ffcccc";
                    // Set a larger size for the tooltip to prevent clipping
                    const ps = isValid ? null : { value: errorMsg, isshow: false, width: 250, height: 120 };

                    console.log("Validation result:", isValid, "Setting bg:", bg);

                    // Apply validation result
                    isInternalChange.current = true;
                    setTimeout(() => {
                        workbookRef.current.setCellFormat(r, c, "bg", bg);
                        workbookRef.current.setCellFormat(r, c, "ps", ps);
                        setTimeout(() => { isInternalChange.current = false; }, 50);
                    }, 0);
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
                        data={sheetData}
                        onOp={handleOp}
                    />
                )}
            </div>
        </div>
    );
}
