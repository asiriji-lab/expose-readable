// ─── Time / Period Parsers ────────────────────────────────────────────────────

/**
 * Valid time formats:
 *  - "HH.MM-HH.MM"  e.g. "08.05-08.55"
 *  - Plain integer string (duration in minutes) e.g. "10"
 */
export function isValidTimeFormat(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return true; // plain duration number
  return /^\d{2}\.\d{2}-\d{2}\.\d{2}$/.test(trimmed);
}

// ─── Slot Parsers ─────────────────────────────────────────────────────────────

/**
 * Slot token format: "DAY_PERIOD"  e.g. "MON_1", "TUE_Morning Break"
 * Days: MON | TUE | WED | THU | FRI
 */
export function isValidSlotToken(token: string): boolean {
  return /^(MON|TUE|WED|THU|FRI)_.+$/.test(token.trim());
}

/**
 * Parses a comma-separated list of slot tokens.
 * Returns invalid tokens (or empty array if all valid).
 */
export function getInvalidSlotTokens(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !isValidSlotToken(t));
}

// ─── ID / Code Parsers ────────────────────────────────────────────────────────

/**
 * Teacher IDs: T### or E###  (3 digits minimum)
 */
export function isValidTeacherId(value: string): boolean {
  return /^[TE]\d{3,}$/.test(value.trim());
}

/**
 * Class ID format raw: "{grade}/{section}"  e.g. "1/1", "6/3"
 * (No M. prefix — that is the actual raw CSV format)
 */
export function isValidClassId(value: string): boolean {
  return /^\d+\/\d+$/.test(value.trim());
}

// ─── Grade Range Parser ───────────────────────────────────────────────────────

/**
 * Grade notation appears in curriculum headers.
 * Formats: "/1"  "/3-5"  "/1,3,5"
 * Returns the array of grade numbers referenced.
 */
export function parseGradeNotation(value: string): number[] {
  const trimmed = value.trim().replace(/^\//, '');
  const grades: number[] = [];

  for (const part of trimmed.split(',')) {
    const rangeParts = part.trim().split('-');
    if (rangeParts.length === 2) {
      const start = parseInt(rangeParts[0]);
      const end = parseInt(rangeParts[1]);
      if (!isNaN(start) && !isNaN(end)) {
        for (let g = start; g <= end; g++) grades.push(g);
      }
    } else {
      const n = parseInt(part.trim());
      if (!isNaN(n)) grades.push(n);
    }
  }

  return grades;
}

/**
 * Detects whether a cell value is a curriculum grade-level header.
 * Actual format in raw CSV: "ม.1", "ม.2", ..., "ม.6"
 */
export function isGradeHeader(value: string): boolean {
  return /^ม\.([1-6])$/.test(value.trim());
}

// ─── Skip-row Markers ─────────────────────────────────────────────────────────

/**
 * Rows where teacher_id is one of these are section-header rows — skip them.
 * Actual markers from raw teacher.csv: 'ครูในโรงเรียน' and 'อาจารย์นอก'
 */
export const TEACHER_SKIP_MARKERS = new Set(['ครูในโรงเรียน', 'อาจารย์นอก', 'teacher_id', '']);

/**
 * Returns true if this row should be skipped during validation.
 */
export function isSkipRow(firstCellValue: string): boolean {
  return TEACHER_SKIP_MARKERS.has(firstCellValue.trim());
}

// ─── apply_to field parser ────────────────────────────────────────────────────

/**
 * apply_to field in preplace.csv (raw CSV format).
 * Valid formats: "All" | "ม.{1-6}" | comma-list of grades e.g. "ม.1, ม.2, ม.3"
 */
export function isValidApplyTo(value: string): boolean {
  const v = value.trim();
  if (v === 'All' || v === 'all') return true;
  // Single grade: ม.1 – ม.6
  if (/^ม\.[1-6]$/.test(v)) return true;
  // Comma-separated list of grades
  const parts = v.split(',').map((p) => p.trim());
  return parts.every((p) => /^ม\.[1-6]$/.test(p));
}

// ─── Preplace slot format parser ───────────────────────────────────────────────────────────────

/**
 * Validates a single preplace คาบ token.
 * Valid formats:
 *   DAY_N          e.g. MON_2
 *   DAY_N-DAY_M    e.g. MON_2-MON_10
 *   Everyday_N     e.g. Everyday_1
 * Days: MON | TUE | WED | THU | FRI
 */
const DAY = '(MON|TUE|WED|THU|FRI)';
export function isValidPreplaceSlotToken(token: string): boolean {
  const t = token.trim();
  if (/^Everyday_\d+$/.test(t)) return true;
  if (new RegExp(`^${DAY}_\\d+$`).test(t)) return true;
  if (new RegExp(`^${DAY}_\\d+-${DAY}_\\d+$`).test(t)) return true;
  return false;
}

/**
 * Returns invalid tokens from a comma-separated preplace คาบ string.
 */
export function getInvalidPreplaceSlotTokens(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !isValidPreplaceSlotToken(t));
}

// ─── Student class string parser (for curriculum CU-4) ────────────────────────────────────────

/**
 * Parses a ห้อง (นักเรียน) ที่สอน string like "/1, /3-5" into section numbers [1, 3, 4, 5].
 * Supports:
 *   /N       → single section
 *   /N-M     → range inclusive
 *   mixed    → comma-separated combination
 */
export function parseStudentClassString(value: string): number[] {
  if (!value.trim()) return [];
  const sections = new Set<number>();
  const elements = value.replace(/\s/g, '').split(',').filter(Boolean);
  for (const el of elements) {
    const rangeMatch = el.match(/^\/(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      for (let s = start; s <= end; s++) sections.add(s);
      continue;
    }
    const singleMatch = el.match(/^\/(\d+)$/);
    if (singleMatch) {
      sections.add(parseInt(singleMatch[1]));
    }
  }
  return [...sections].sort((a, b) => a - b);
}
