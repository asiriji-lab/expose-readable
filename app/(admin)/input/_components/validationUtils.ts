import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ColumnRule {
    pattern?: RegExp;
    message?: string;
    required?: boolean;
    validate?: (val: string, row: string[]) => string | null;
}

// Validation Rules by Column Index (0-based)
export const CURRICULUM_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: {
        required: false, // Continuation rows leave this blank
        pattern: /^([ก-ฮa-zA-Z0-9.]+)?$/,
        message: "Subject ID must be a Thai letter followed by digits (e.g., ท21102) or alphanumeric"
    },
    1: {
        required: false,
        validate: (val, row) => {
            const subjectId = row[0] ? String(row[0]).trim() : '';
            if (subjectId !== '' && val === '') return "Subject name is required if Subject ID is provided.";
            return null;
        }
    },
    2: {
        required: true,
        pattern: /^\d+(\.\d+)?$/,
        message: "Periods per week must be a number (e.g., 3 or 1.5)"
    },
    3: {
        required: false,
        // Single quotes are optional: accepts T001, ['T001', 'T002'], or [T001, T002]
        pattern: /^([A-Z]\d{3}|\[\s*'?([A-Z]\d{3})'?\s*(,\s*'?([A-Z]\d{3})'?\s*)*\])$/,
        message: "Teacher ID must be a letter followed by 3 digits (e.g., T001) or a list ['T001', 'E002']",
        validate: (val, row) => {
            const constraint = row[6] ? String(row[6]).trim() : '';
            if (constraint.includes('type=TEAM') && !val.includes('[')) {
                return "TEAM constraints require an array of multiple teachers.";
            }
            return null;
        }
    },
    4: {
        required: true,
        pattern: /^(\d+(\s*-\s*\d+)*)?$/,
        message: "Block pattern must be a single digit or range (e.g., 1, 2, 1-2, 2-2)"
    },
    5: {
        required: true,
        // Extremely relaxed student class regex to allow brackets, digits, and any spacing/quotes
        pattern: /^(\[?\s*'?\d+'?\s*(,\s*'?\d+'?\s*)*\s*\]?)?$/,
        message: "Student class must be a list of numbers (e.g., [1, 2, 3])"
    },
    6: {
        required: false
    },
    7: {
        required: false,
        // Single quotes optional: accepts C108, ['D203','D204'], or [D203, D204]
        pattern: /^(.+|\[\s*'?.+'?\s*(,\s*'?.+'?\s*)*\])$/,
        message: "Invalid room format. Must be a room name or array list."
    },
    8: {
        required: false,
        pattern: /^((MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?(,\s*(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?)*)$/,
        message: "Fixed period must match format like MON_9-MON_10 or MON_1, TUE_2"
    }
};

export const TEACHER_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: true, pattern: /^[A-Z]\d{3}$/, message: "Teacher ID must be a letter followed by 3 digits (e.g., T001)" },
    1: { required: true, pattern: /^.+$/, message: "Teacher name is required" },
    2: { required: false, pattern: /^((MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?(,\s*(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?)*)$/, message: "Available slots must match format like MON_2-MON_10" },
    3: { required: false, pattern: /^((MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?(,\s*(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+(-(MON|TUE|WED|THU|FRI|SAT|SUN)_\d+)?)*)$/, message: "Unavailable slots must match format like MON_6-MON_8" },
    4: { required: false }
};

export const STUDENT_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: true, pattern: /^[1-6]\/\d+$/, message: "Class ID must be in format like 1/1" },
    1: { required: true, pattern: /^ม\.[1-6]$/, message: "Grade must be in format like ม.1" },
    2: { required: true, pattern: /^\d+$/, message: "Section must be a number" },
    3: { required: false, pattern: /^(.+)$/, message: "Default room must be a valid Room ID" },
    4: { required: false }
};

export const ROOM_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: true, pattern: /^.+$/, message: "Room ID is required" },
    1: { required: false },
    2: { required: false }
};

export const PERIOD_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: true, pattern: /^([\w\sก-ฮ]+)$/, message: "Period label is required" },
    // Allow optional spaces around hyphen: "08.05-08.55" or "08.05 - 08.55"
    1: { required: true, pattern: /^(\d{2}\.\d{2}\s*-\s*\d{2}\.\d{2}|\d+)$/, message: "Time must be range (08.05-08.55) or duration (10)" }
};

export const ELECTIVE_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: false, pattern: /^([ก-ฮa-zA-Z0-9]+|nan)$/, message: "Subject ID must be a Thai letter followed by digits or alphanumeric" },
    1: { required: false },
    2: { required: false, pattern: /^[A-Z]\d{3}$/, message: "Teacher ID must be a letter followed by 3 digits" },
    3: { required: false }
};

export const SCOUT_VALIDATION_RULES: Record<number, ColumnRule> = {
    0: { required: false, pattern: /^[A-Z]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" },
    1: { required: false, pattern: /^[A-Z]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" },
    2: { required: false, pattern: /^[A-Z]\d{3}$/, message: "Must be a valid Teacher ID (e.g., T001)" }
};

export const CONSTRAINT_VALIDATION_RULES: Record<number, ColumnRule> = {
    1: { required: true, pattern: /^([A-Za-z]+_\d+(-[A-Za-z]+_\d+)?)$/, message: "Period must match format like Everyday_1 or MON_10" },
    2: { required: true, pattern: /^(All|ม\.\d(,\s*ม\.\d)*)$/, message: "Apply to must be 'All' or list of grades (e.g., ม.1, ม.2)" }
};

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export const validateFile = (
    file: File,
    rules: Record<number, ColumnRule>,
    catchAllRule?: ColumnRule,
    shouldSkipRow: (row: string[]) => boolean = (row) => /^ม\.\d/.test(String(row[0] || '').trim())
): Promise<ValidationResult> => {
    return new Promise((resolve) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const errors: string[] = [];

        const validateRows = (rows: string[][]) => {
            const ruleIndices = Object.keys(rules).map(Number);
            const maxRuleIndex = ruleIndices.length > 0 ? Math.max(...ruleIndices) : -1;

            for (let r = 1; r < rows.length; r++) { // Start from 1 to skip header row
                if (errors.length >= 10) break; // Fast-fail threshold

                const row = rows[r];

                if (shouldSkipRow(row)) continue;

                // Skip completely empty rows (common at the end of CSVs)
                const isRowEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
                if (isRowEmpty) continue;

                // Determine max columns to validate for this specific row
                const maxCols = Math.max(row.length, maxRuleIndex + 1);

                // Validate each column in the row up to maxCols
                for (let c = 0; c < maxCols; c++) {
                    const rule = rules[c] || (c < row.length ? catchAllRule : undefined);
                    if (!rule) continue;

                    const cellVal = row[c];
                    const val = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';

                    if (rule.required && val === '') {
                        errors.push(`Row ${r + 1}, Col ${c + 1}: Required field missing.`);
                        continue;
                    }

                    if (val === '') {
                        // If empty, check if it's required. If not, we still run custom validate() 
                        // because it might be required based on ANOTHER column's value.
                        if (rule.validate) {
                            const customError = rule.validate(val, row);
                            if (customError) {
                                errors.push(`Row ${r + 1}, Col ${c + 1} (${val}): ${customError}`);
                            }
                        }
                        continue;
                    }

                    if (rule.pattern && !rule.pattern.test(val)) {
                        errors.push(`Row ${r + 1}, Col ${c + 1} (${val}): ${rule.message || 'Invalid format.'}`);
                    }

                    if (rule.validate) {
                        const customError = rule.validate(val, row);
                        if (customError) {
                            errors.push(`Row ${r + 1}, Col ${c + 1} (${val}): ${customError}`);
                        }
                    }
                }
            }

            resolve({
                isValid: errors.length === 0,
                errors: errors // Already capped at 10 via the loop break
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
                        resolve({ isValid: true, errors: [] });
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
