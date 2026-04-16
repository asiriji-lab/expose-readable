export type JobStatus = 'created' | 'loading_data' | 'running_ga' | 'exporting' | 'completed' | 'failed';

export interface JobDetail {
  job_id: string;
  job_name: string | null;
  status: JobStatus;
  progress: number;
  progress_details: {
    generation: number;
    max_generations: number;
    best_fitness: number;
    violations: Record<string, number>;
  } | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleResult {
  data_stats: { curriculum_rows: number; rooms_rows: number };
  feasibility: { is_feasible: boolean; error_count: number; warning_count: number };
  ga_result: { final_fitness: number; generations_run: number; solution_found: boolean; stopped_early: boolean };
}

export interface SubmitJobResponse {
  success: boolean;
  job_id: string;
  job_name: string;
  message: string;
  status_url: string;
  result_url: string;
  download_url: string;
}
