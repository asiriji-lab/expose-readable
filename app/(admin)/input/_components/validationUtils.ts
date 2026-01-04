import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Validation Rules by Column Index (0-based)
export const CURRICULUM_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: {
        pattern: /^([ก-ฮ]\d{5}|ม\.\d)$/,
        message: "Subject ID must be a Thai letter followed by 5 digits (e.g., ท21102) or Grade Header (e.g., ม.1)"
    },
    2: {
        pattern: /^\d+(\.\d+)?$/,
        message: "Periods per week must be a number (e.g., 3 or 1.5)"
    },
    3: {
        pattern: /^([TE]\d{3}|\[\s*'([TE]\d{3})'\s*(,\s*'([TE]\d{3})'\s*)*\])$/,
        message: "Teacher ID must be T/E followed by 3 digits (e.g., T001) or a list ['T001', 'E002']"
    },
    4: {
        pattern: /^\d(-\d)?$/,
        message: "Block pattern must be a single digit or range (e.g., 1 or 1-2)"
    },
    5: {
        pattern: /^\[\d+(\s*,\s*\d+)*\]$/,
        message: "Student class must be a list of numbers (e.g., [1, 2])"
    },
    8: {
        pattern: /^([A-Z]{3}_\d+(-[A-Z]{3}_\d+)?(,\s*)?)*$/,
        message: "Fixed period must match format like MON_1-MON_2"
    }
};

export const TEACHER_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { pattern: /^[TE]\d{3}$/, message: "Teacher ID must be T or E followed by 3 digits (e.g., T001)" },
    1: { pattern: /^.+$/, message: "Teacher name is required" },
    3: { pattern: /^([A-Z]{3}_\d+(-[A-Z]{3}_\d+)?(,\s*)?)*$/, message: "Unavailable slots must match format like MON_6-MON_8" }
};

export const STUDENT_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { pattern: /^\d\/\d$/, message: "Class ID must be in format like 1/1" },
    1: { pattern: /^ม\.\d$/, message: "Grade must be in format like ม.1" },
    2: { pattern: /^\d+$/, message: "Section must be a number" },
    3: { pattern: /^[A-Z0-9-]+$/, message: "Default room must be a valid Room ID" }
};

export const ROOM_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { pattern: /^.+$/, message: "Room ID is required" }
};

export const PERIOD_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { pattern: /^(\d+|.+)$/, message: "Period label is required" },
    1: { pattern: /^(\d{2}\.\d{2}-\d{2}\.\d{2}|\d+)$/, message: "Time must be range (08.05-08.55) or duration (10)" }
};

export const ELECTIVE_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { pattern: /^[ก-ฮ]\d{5}$/, message: "Subject ID must be a Thai letter followed by 5 digits" },
    2: { pattern: /^[TE]\d{3}$/, message: "Teacher ID must be T or E followed by 3 digits" }
    // Columns 4+ are slots, handled dynamically if needed, or we can add a generic check in the loop
};

export const SCOUT_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    // All columns are teacher IDs
    0: { pattern: /^[TE]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" },
    1: { pattern: /^[TE]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" },
    2: { pattern: /^[TE]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" }
};

export const CONSTRAINT_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    1: { pattern: /^([A-Za-z]+_\d+(-[A-Za-z]+_\d+)?)$/, message: "Period must match format like Everyday_1 or MON_10" },
    2: { pattern: /^(All|ม\.\d(,\s*ม\.\d)*)$/, message: "Apply to must be 'All' or list of grades (e.g., ม.1, ม.2)" }
};

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export const validateFile = (file: File, rules: Record<number, { pattern: RegExp; message: string }>): Promise<ValidationResult> => {
    return new Promise((resolve, reject) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const errors: string[] = [];

        const validateRows = (rows: string[][]) => {
            rows.forEach((row, r) => {
                // Skip header row
                if (r === 0) return;

                // Check for Grade Header (e.g., "ม.1") in the first column
                const firstColVal = row[0] ? String(row[0]) : '';
                const isGradeHeader = /^ม\.\d/.test(firstColVal);

                if (isGradeHeader) return;

                row.forEach((cell, c) => {
                    const rule = rules[c];
                    if (rule) {
                        const val = cell !== null && cell !== undefined ? String(cell).trim() : '';
                        // Allow empty values (unless we want strict required fields, but current logic allows empty)
                        if (val === '') return;

                        if (!rule.pattern.test(val)) {
                            errors.push(`Row ${r + 1}, Column ${c + 1} (${val}): ${rule.message}`);
                        }
                    }
                });
            });

            resolve({
                isValid: errors.length === 0,
                errors: errors.slice(0, 10) // Limit to first 10 errors to avoid spam
            });
        };

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    if (data) {
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
                        validateRows(jsonData);
                    } else {
                        resolve({ isValid: true, errors: [] }); // Empty file?
                    }
                } catch (err) {
                    console.error("Error parsing Excel for validation:", err);
                    resolve({ isValid: false, errors: ["Failed to parse Excel file"] });
                }
            };
            reader.onerror = () => resolve({ isValid: false, errors: ["Failed to read file"] });
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                complete: (results) => {
                    const parsedData = results.data as string[][];
                    validateRows(parsedData);
                },
                error: (error) => {
                    console.error('Error parsing CSV for validation:', error);
                    resolve({ isValid: false, errors: ["Failed to parse CSV file"] });
                },
                header: false
            });
        }
    });
};
