export interface ScheduleFormData {
  scheduleName: string;
  year: string;
  semester: string;
  curriculumFile: File | null;
  teacherFile: File | null;
  electiveFile: File | null;
  scoutFile: File | null;
  periodFile: File | null;
  studentFile: File | null;
  roomFile: File | null;
  constraintFile: File | null;
  relatedFile: File | null;
}
