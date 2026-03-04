/**
 * Shared validation types for CsvEditor column rules.
 */

export interface ColumnRule {
  /** Whether the cell value is required (non-empty). */
  required?: boolean;
  /** Regex the value must match. */
  pattern?: RegExp;
  /** Error message shown when pattern fails. */
  message?: string;
  /**
   * Custom cross-column validation function.
   * Receives the trimmed cell value and the full (stringified) row.
   * Returns an error string on failure, or null/undefined on success.
   */
  validate?: (value: string, row: string[]) => string | null | undefined;
}
