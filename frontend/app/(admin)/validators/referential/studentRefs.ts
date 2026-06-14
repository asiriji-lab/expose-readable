import { ValidationResult, LookupTables } from '../types';

// ห้องประจำ column removed from student sheet — homeroom ownership moved to room.ชั้นเรียนประจำ
export function validateStudentRefs(
  studentResult: ValidationResult,
  _lookups: LookupTables
): ValidationResult {
  return studentResult;
}
