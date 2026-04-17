import Papa from 'papaparse';
import { TabName, SheetData } from '../../../validators/types';

export const ALL_TAB_NAMES: TabName[] = [
  'period', 'room', 'teacher', 'student', 'preplace', 'scout', 'elective', 'curriculum',
];

/** Maps Google Sheets tab titles (Thai or English) to our internal TabName keys */
export const TAB_KEY_MAP: Record<string, TabName> = {
  // English — lowercase
  period: 'period',
  room: 'room',
  teacher: 'teacher',
  student: 'student',
  preplace: 'preplace',
  scout: 'scout',
  elective: 'elective',
  curriculum: 'curriculum',
  // English — Title case (Google Sheets sometimes capitalises tab names)
  Period: 'period',
  Room: 'room',
  Teacher: 'teacher',
  Student: 'student',
  Preplace: 'preplace',
  Scout: 'scout',
  Elective: 'elective',
  Curriculum: 'curriculum',
  // Thai aliases
  คาบ: 'period',
  ห้อง: 'room',
  ครู: 'teacher',
  นักเรียน: 'student',
  ตรึงคาบ: 'preplace',
  ลูกเสือ: 'scout',
  วิชาเสรี: 'elective',
  หลักสูตร: 'curriculum',
};

/**
 * Extracts the spreadsheet ID from a full Google Sheets URL.
 * Returns the value as-is if it looks like a bare ID already.
 */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (match) return match[1];
  if (/^[\w-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Attempts to map a CSV filename to a TabName.
 * Handles patterns like:
 *   "period.csv" → "period"
 *   "example_period.csv" → "period"
 *   "dataset SWS - teacher.csv" → "teacher"
 */
export function filenameToTabName(filename: string): TabName | null {
  const lower = filename.toLowerCase().replace(/\.csv$/, '');
  // Direct match or TAB_KEY_MAP lookup
  for (const tab of ALL_TAB_NAMES) {
    if (lower === tab || lower.endsWith(`_${tab}`) || lower.endsWith(`-${tab}`) || lower.endsWith(` ${tab}`)) {
      return tab;
    }
  }
  // Fallback: check if any tab name appears anywhere in the filename
  for (const tab of ALL_TAB_NAMES) {
    if (lower.includes(tab)) return tab;
  }
  return null;
}

/**
 * All alias names to try (in order) when fetching a tab from a public Google Sheet.
 * Tries English first, then Thai, then capitalised.
 */
export const TAB_ALIASES: Record<TabName, string[]> = {
  period:     ['period',     'คาบ',       'Period'],
  room:       ['room',       'ห้อง',       'Room'],
  teacher:    ['teacher',    'ครู',       'Teacher'],
  student:    ['student',    'นักเรียน',   'Student'],
  preplace:   ['preplace',   'ตรึงคาบ',   'Preplace'],
  scout:      ['scout',      'ลูกเสือ',   'Scout'],
  elective:   ['elective',   'วิชาเสรี',  'Elective'],
  curriculum: ['curriculum', 'หลักสูตร', 'Curriculum'],
};

/** Parse a raw CSV string into a 2-D string array using papaparse. */
export function parseCSVText(text: string): string[][] {
  // Strip UTF-8 BOM (\uFEFF) that Google Sheets CSV export prepends — it corrupts the first header
  const cleaned = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const result = Papa.parse<string[]>(cleaned, { skipEmptyLines: true });
  return result.data as string[][];
}

/**
 * Fetches a single tab from a **publicly shared** Google Sheet using the
 * gviz CSV export endpoint (no API key or service account required).
 *
 * Tries each alias in `TAB_ALIASES[tabName]` in order and returns the rows
 * from the first one that responds with valid CSV data.
 *
 * Returns `null` when:
 * - None of the aliases matched a real tab (Google returns an HTML error page)
 * - The network request failed
 *
 * Requirements: the spreadsheet must be set to “Anyone with the link can view”.
 */
export async function fetchPublicSheetTab(
  sheetId: string,
  tabName: TabName,
): Promise<string[][] | null> {
  const aliases = TAB_ALIASES[tabName];

  for (const alias of aliases) {
    try {
      const url =
        `https://docs.google.com/spreadsheets/d/${sheetId}` +
        `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(alias)}`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const text = await res.text();

      // Google returns an HTML error page when the tab name doesn’t exist
      if (text.trim().startsWith('<')) continue;

      const rows = parseCSVText(text);
      if (rows.length > 0) return rows;
    } catch {
      // network error for this alias — try the next one
    }
  }

  return null;
}

/**
 * Fetches all 8 required tabs from a Google Sheet via the backend API route.
 * Uses the service account server-side — no CORS issues, no public sharing required
 * (sheet must be accessible to the service account or set to "Anyone with the link").
 */
export async function fetchAllSheetTabs(
  sheetId: string,
): Promise<{ data: SheetData; missingTabs: TabName[] }> {
  const res = await fetch(`/api/sheets?id=${encodeURIComponent(sheetId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'ดึงข้อมูลชีทไม่สำเร็จ');
  }

  const { tabs } = await res.json() as { tabs: Record<string, string[][]> };

  const data: SheetData = {};
  for (const [title, rows] of Object.entries(tabs)) {
    // Normalize: strip invisible/zero-width chars and leading/trailing whitespace,
    // then try NFC (handles Thai NFC vs NFD encoding differences) and lowercase fallback.
    const clean = title
      .replace(/[\u00A0\u200B\u200C\u200D\u2060\uFEFF]/g, '')
      .trim();
    const tabName =
      TAB_KEY_MAP[clean] ??
      TAB_KEY_MAP[clean.normalize('NFC')] ??
      TAB_KEY_MAP[clean.toLowerCase()];
    if (tabName && rows.length > 0) {
      data[tabName] = rows;
    }
  }

  const missingTabs = ALL_TAB_NAMES.filter((t) => !data[t]);
  return { data, missingTabs };
}
