// ─── Core Types ──────────────────────────────────────────────────────────────

export type TabName =
  | 'period'
  | 'room'
  | 'teacher'
  | 'student'
  | 'preplace'
  | 'scout'
  | 'elective'
  | 'curriculum';

/** Raw tab data: array of rows, each row is an array of cell strings */
export type TabData = string[][];

/** All 8 tabs fetched from Google Sheet */
export type SheetData = Partial<Record<TabName, TabData>>;

// ─── Validation Result Types ──────────────────────────────────────────────────

export type ErrorSeverity = 'error' | 'warning';

export interface ValidationError {
  row: number;       // 1-based (1 = header row, 2 = first data row)
  col: number;       // 1-based column index
  column: string;    // column name (English or Thai)
  value: string;     // the offending cell value
  message: string;   // human-readable error
  severity: ErrorSeverity;
  suggestion?: string; // optional "Did you mean X?"
}

export interface ValidationResult {
  tabName: TabName;
  valid: boolean;      // true if zero errors (warnings are ok)
  errors: ValidationError[];
  warnings: ValidationError[];
  rowCount: number;    // number of data rows (excluding header)
  /** Parsed data rows as header→value maps, for use in Phase 2 */
  parsedRows: Record<string, string>[];
}

// ─── Tab Status (UI State) ────────────────────────────────────────────────────

export type TabStatus =
  | 'pending'      // not yet validated
  | 'validating'   // currently running
  | 'passed'       // zero errors, zero warnings
  | 'warnings'     // zero errors, ≥1 warning
  | 'errors'       // ≥1 error
  | 'locked'       // waiting for Phase 1 to complete (Phase 2 tabs)
  | 'missing';     // tab not found in the sheet

export interface TabState {
  status: TabStatus;
  result: ValidationResult | null;
}

export type AllTabStates = Record<TabName, TabState>;

// ─── Lookup Tables (built from Phase 1 parsed data, used in Phase 2) ─────────

export interface LookupTables {
  // From room.csv
  roomIds: Set<string>;
  roomNotes: Set<string>;    // alias / note column values
  roomTypes: Set<string>;

  // From teacher.csv
  teacherIds: Set<string>;
  teacherNames: string[];    // array for fuzzy matching

  // From student.csv
  classIds: Set<string>;     // e.g. "1/1", "2/3"  (raw G/S format)
  /** grade ("ม.1") → set of section numbers for CU-4 range validation */
  gradeToSections: Map<string, Set<number>>;

  // From period.csv
  periodLabels: Set<string>; // e.g. "1","2","Morning Break"

  // From preplace.csv — slot names ("ชื่อ" column), used by EL-3
  preplaceSlots: Set<string>;
}
