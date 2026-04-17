import { ValidationResult, LookupTables } from '../types';

/**
 * Scout has no referential checks — matches Apps Script which always passes scout.
 */
export function validateScoutRefs(
  scoutResult: ValidationResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _lookups: LookupTables
): ValidationResult {
  return scoutResult;
}
