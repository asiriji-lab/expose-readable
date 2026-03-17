import type { FullDataset } from '../_types/schedule.types';
import type { WorkloadEntry } from './dummyData';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export interface WorkloadStatus extends WorkloadEntry {
    /** How many periods of this subject are already placed in the dataset */
    placed: number;
    /** totalPeriods - placed */
    remaining: number;
}

/**
 * For each WorkloadEntry, count how many lessons are already placed for
 * that teacher+subject in the live dataset, then compute remaining.
 */
export function computeWorkloadStatus(
    teacherCode: string,
    workload: WorkloadEntry[],
    dataset: FullDataset | null,
): WorkloadStatus[] {
    if (!dataset) {
        return workload.map(entry => ({
            ...entry,
            placed: 0,
            remaining: entry.totalPeriods,
        }));
    }

    const teacherSchedule = dataset.teachers[teacherCode];

    return workload.map(entry => {
        let placed = 0;
        if (teacherSchedule) {
            for (const day of DAYS) {
                const daySlots = teacherSchedule[day];
                if (!daySlots) continue;
                for (const item of Object.values(daySlots)) {
                    if (item.subjectCode === entry.subjectCode) placed++;
                }
            }
        }
        return {
            ...entry,
            placed,
            remaining: entry.totalPeriods - placed,
        };
    });
}
