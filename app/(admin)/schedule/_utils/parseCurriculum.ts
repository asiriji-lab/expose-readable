/**
 * Parses curriculum CSV → WorkloadEntry[] per teacher.
 *
 * CSV columns:
 *   0: รหัสวิชา          (subject code, e.g. "ว21103")
 *   1: ชื่อวิชา          (subject name)
 *   2: คาบ/สัปดาห์       (periods per week)
 *   3: จำนวนห้อง         (number of class sections)
 *   4: รวมคาบ            (total periods — derived, not used)
 *   5: ครู               (teacher name(s), comma-separated)
 *   6: การแบ่งคาบสอน      (period split pattern, e.g. "2-1")
 *   7: ห้อง (นักเรียน) ที่สอน  (specific class sections, e.g. "/1, /2")
 *   8: หมายเหตุ          (notes — TEAM, pinned slots, etc.)
 *   9: ห้องเรียน         (classroom override)
 *  10: คาบเรียน          (pinned slots)
 */

import type { WorkloadEntry } from '../_types/schedule.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CurriculumRow {
    subjectCode: string;
    subjectName: string;
    periodsPerWeek: number;
    numSections: number;
    teachers: string[];
    periodSplit: number[];
    classSections: string[];     // e.g. ["/1", "/2"] or [] for all
    notes: string;
    classroom: string;
    pinnedSlots: string;
    gradeLevel: number;          // 1–6
    isTeam: boolean;
    isSubGroup: boolean;
    isMultiClassTeam: boolean;
}

export interface ParseResult {
    /** teacher name → WorkloadEntry[] */
    workload: Record<string, WorkloadEntry[]>;
    /** All parsed rows with resolved metadata */
    rows: CurriculumRow[];
    /** Warnings for rows that couldn't be fully parsed */
    warnings: string[];
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

/** Parse a CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current.trim());
    return fields;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "ม.1" → 1, "ม.4" → 4 */
function parseGradeHeader(cell: string): number | null {
    const m = cell.match(/^ม\.(\d)$/);
    return m ? parseInt(m[1], 10) : null;
}

/** "2-1" → [2, 1], "2-2" → [2, 2], "2" → [2], "1" → [1] */
function parsePeriodSplit(raw: string): number[] {
    if (!raw) return [];
    return raw.split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
}

/** "/1, /2" → ["/1", "/2"];  "/3" → ["/3"];  "" → [] */
function parseClassSections(raw: string): string[] {
    if (!raw) return [];
    return raw.split(',')
        .map(s => s.trim())
        .filter(s => s.startsWith('/'));
}

/** Parse teacher field — handles "ครู1, ครู2" and leading/trailing spaces */
function parseTeachers(raw: string): string[] {
    if (!raw) return [];
    return raw.split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

/** Check for special type flags in notes */
function parseNotes(raw: string): { isTeam: boolean; isSubGroup: boolean; isMultiClassTeam: boolean } {
    const lower = raw.toLowerCase();
    return {
        isTeam: lower.includes('type=team'),
        isSubGroup: lower.includes('type=sub_group'),
        isMultiClassTeam: lower.includes('type=multi_class_team'),
    };
}

/**
 * Expand class sections for a grade level.
 * - sections = ["/1", "/2"] + grade 1 → ["1/1", "1/2"]
 * - sections = [] + grade 2 + numSections 4 → ["2/1", "2/2", "2/3", "2/4"]
 */
function expandClassCodes(
    gradeLevel: number,
    sections: string[],
    numSections: number,
): string[] {
    if (sections.length > 0) {
        return sections.map(s => {
            const num = s.replace('/', '');
            return `${gradeLevel}/${num}`;
        });
    }
    // All sections
    return Array.from({ length: numSections }, (_, i) => `${gradeLevel}/${i + 1}`);
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseCurriculumCSV(csvText: string): ParseResult {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    const warnings: string[] = [];
    const rows: CurriculumRow[] = [];
    const workload: Record<string, WorkloadEntry[]> = {};

    let currentGrade = 0;
    let lastSubjectCode = '';
    let lastSubjectName = '';
    let lastPeriodsPerWeek = 0;
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);

        // Check for grade header row (e.g. "ม.1,,,,...")
        const grade = parseGradeHeader(fields[0]);
        if (grade !== null) {
            currentGrade = grade;
            lastSubjectCode = '';
            lastSubjectName = '';
            continue;
        }

        if (currentGrade === 0) {
            warnings.push(`Line ${i + 1}: no grade context yet, skipping`);
            continue;
        }

        // Determine subject:
        // - col[0] has value → new subject with a code
        // - col[0] empty, col[1] has value → new subject WITHOUT a code (e.g. "กิจกรรมแนะแนว", "EFF2")
        // - col[0] empty, col[1] empty → continuation row (same subject, different teacher/sections)
        const isContinuation = !fields[0] && !fields[1];
        const subjectCode = fields[0] || (isContinuation ? lastSubjectCode : fields[1] || '');
        const subjectName = fields[1] || (isContinuation ? lastSubjectName : '');

        if ((!subjectCode && !subjectName) || fields.every(f => !f.trim())) {
            // Truly empty row
            continue;
        }

        // Track for continuation rows
        if (!isContinuation) {
            lastSubjectCode = subjectCode;
            lastSubjectName = subjectName;
        }

        const rawPeriods = fields[2];
        const periodsPerWeek = rawPeriods ? parseInt(rawPeriods, 10) : lastPeriodsPerWeek;
        if (rawPeriods) lastPeriodsPerWeek = periodsPerWeek;

        const numSections = parseInt(fields[3], 10) || 0;
        const teachers = parseTeachers(fields[5]);
        const periodSplitRaw = fields[6] || '';
        const periodSplit = parsePeriodSplit(periodSplitRaw);

        const classSections = parseClassSections(fields[7]);
        const notesRaw = fields[8] || '';
        const noteFlags = parseNotes(notesRaw);
        const classroom = fields[9] || '';
        const pinnedSlots = fields[10] || '';

        if (teachers.length === 0) {
            warnings.push(`Line ${i + 1}: no teacher for ${subjectCode} ${subjectName}`);
            continue;
        }

        if (isNaN(periodsPerWeek) || periodsPerWeek <= 0) {
            warnings.push(`Line ${i + 1}: invalid periods for ${subjectCode}`);
            continue;
        }

        const classCodes = expandClassCodes(currentGrade, classSections, numSections);

        if (classCodes.length === 0) {
            warnings.push(`Line ${i + 1}: no class sections resolved for ${subjectCode}`);
            continue;
        }

        const row: CurriculumRow = {
            subjectCode,
            subjectName,
            periodsPerWeek,
            numSections,
            teachers,
            periodSplit,
            classSections,
            notes: notesRaw,
            classroom,
            pinnedSlots,
            gradeLevel: currentGrade,
            ...noteFlags,
        };
        rows.push(row);

        // Build workload entries
        // For TEAM teaching: all teachers share ALL class codes in this row
        // For normal: each teacher gets their assigned class codes
        if (noteFlags.isTeam) {
            // Team teaching — each teacher is assigned to all listed classes
            for (const teacher of teachers) {
                addWorkloadEntry(workload, teacher, subjectCode, subjectName, classCodes, periodsPerWeek);
            }
        } else if (teachers.length === 1) {
            // Single teacher — gets all expanded class codes
            addWorkloadEntry(workload, teachers[0], subjectCode, subjectName, classCodes, periodsPerWeek);
        } else {
            // Multiple teachers listed on same row (e.g. "ภฤศรินทร์, Coulter")
            // This is a special split — all teachers teach all listed classes
            // The notes usually explain the split (e.g. ครูภฤศรินทร์สอน 2 คาบก่อนแล้วครู Coulter สอน 1 คาบทุกห้อง)
            for (const teacher of teachers) {
                addWorkloadEntry(workload, teacher, subjectCode, subjectName, classCodes, periodsPerWeek);
            }
        }
    }

    return { workload, rows, warnings };
}

function addWorkloadEntry(
    workload: Record<string, WorkloadEntry[]>,
    teacher: string,
    subjectCode: string,
    subjectName: string,
    classCodes: string[],
    periodsPerWeek: number,
) {
    if (!workload[teacher]) workload[teacher] = [];

    // Check if this teacher already has an entry for this subject
    let entry = workload[teacher].find(e => e.subjectCode === subjectCode);
    if (!entry) {
        entry = {
            subjectCode,
            subject: subjectName,
            variant: resolveVariant(subjectCode),
            assignments: [],
            totalPeriods: 0,
        };
        workload[teacher].push(entry);
    }

    for (const classCode of classCodes) {
        // Avoid duplicates
        if (entry.assignments.some(a => a.classCode === classCode)) continue;

        entry.assignments.push({
            classCode,
            room: '',  // resolved later by SUBJECT_ROOM_MAP / CLASS_META
            periodsPerWeek,
        });
        entry.totalPeriods += periodsPerWeek;
    }
}

/** Derive variant from subject code prefix — core subjects are 'red', electives 'green' */
function resolveVariant(subjectCode: string): 'green' | 'red' {
    // Subject codes with X?1XXX pattern → core (red), X?2XXX → elective (green)
    // Also: no-code subjects (แนะแนว, EFF) → green
    if (!subjectCode) return 'green';
    const digitAfterPrefix = subjectCode.match(/\d{2}(\d)/);
    if (digitAfterPrefix) {
        return digitAfterPrefix[1] === '2' ? 'green' : 'red';
    }
    return 'green';
}

// ─── Adapter: string[][] → ParseResult ────────────────────────────────────────

/**
 * Adapter for DevTestPanel: converts papaparse string[][] back to CSV text
 * and delegates to parseCurriculumCSV.
 */
export function parseCurriculumRows(rows: any[][]): ParseResult {
    const csvText = rows.map(row =>
        row.map(cell => {
            const strCell = String(cell ?? '');
            return strCell.includes(',') || strCell.includes('"')
                ? `"${strCell.replace(/"/g, '""')}"`
                : strCell;
        }).join(',')
    ).join('\n');
    return parseCurriculumCSV(csvText);
}

// ─── Convenience: resolve teacher name → code ─────────────────────────────────

/**
 * Build a reverse lookup: teacher firstName → teacher code.
 * Pass in TEACHER_META from dummyData.
 */
export function buildTeacherNameToCodeMap(
    teacherMeta: Record<string, { firstName: string }>,
): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [code, meta] of Object.entries(teacherMeta)) {
        map[meta.firstName] = code;
    }
    return map;
}

/**
 * Convert name-keyed workload to code-keyed workload.
 */
export function resolveWorkloadToTeacherCodes(
    nameWorkload: Record<string, WorkloadEntry[]>,
    nameToCode: Record<string, string>,
): { resolved: Record<string, WorkloadEntry[]>; unmapped: string[] } {
    const resolved: Record<string, WorkloadEntry[]> = {};
    const unmapped: string[] = [];

    for (const [name, entries] of Object.entries(nameWorkload)) {
        const code = nameToCode[name];
        if (code) {
            resolved[code] = entries;
        } else {
            unmapped.push(name);
        }
    }

    return { resolved, unmapped };
}
