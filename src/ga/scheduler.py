"""
================================================================================
GA SCHEDULER - Scheduler Runner
================================================================================

Main scheduler orchestration — mirrors the pipeline in main.py:
  1. Load raw CSVs from uploads folder
  2. Data cleaning (rename Thai columns → English)
  3. Preschedule processing (all 5 tasks via run_all_tasks)
  4. Feasibility check
  5. GA optimisation (Island GA by default)
  6. Export — CSV + JSON
================================================================================
"""

import os
import sys
import json
import logging
import pandas as pd
from datetime import datetime
from typing import Dict, Optional, Callable

from src.logger import create_job_logger
from src.data_cleaning.data_cleaning import clean_input_data
from src.data_cleaning.entity_meta import compute_entity_meta
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from .island_ga import IslandGeneticAlgorithm
from .genetic_algorithm import GeneticAlgorithm
from .data_loader import build_ga_context
from .exporter import ScheduleExporter
from .json_exporter import ScheduleJsonExporter
from .job_manager import JobManager
from .feasibility_checker import FeasibilityChecker
from .job_queue import JobCancelledError


# Canonical filenames expected in the uploads folder (matching input_dataset/)
_INPUT_FILES = {
    'curriculum': 'curriculum.csv',
    'elective':   'elective.csv',
    'teacher':    'teacher.csv',
    'period':     'period.csv',
    'preplace':   'preplace.csv',
    'room':       'room.csv',
    'student':    'student.csv',
    'scout':      'scout.csv',
}

# Island GA defaults matching main.py
_ISLAND_GA_DEFAULTS = dict(
    n_islands=4,
    island_population_size=125,
    migration_interval=50,
    migration_rate=0.1,
    topology='ring',
    mutation_rate=0.03,       # raised from 0.015 — 0.015 was too conservative for high-conflict starts
    crossover_rate=0.9,
    tournament_size=5,        # lowered from 9 — reduces selection pressure, preserves diversity
    max_generations=5000,
    elite_size=10,
    stagnation_limit=150,     # raised from 50 — was == migration_interval, caused restart every epoch
    catastrophic_after=3,
    block_crossover_rate=0.5,
    min_improvement=500,
    window_size=1000,
)


def _load_raw_data(uploads_folder: str) -> Dict[str, pd.DataFrame]:
    """Load all present CSV files from uploads_folder into a DataFrame dict."""
    raw_data: Dict[str, pd.DataFrame] = {}
    for key, filename in _INPUT_FILES.items():
        path = os.path.join(uploads_folder, filename)
        if os.path.exists(path):
            raw_data[key] = pd.read_csv(path, encoding='utf-8-sig')
    return raw_data


class _Tee:
    """Write to both a file and the original stdout simultaneously."""

    def __init__(self, file, original):
        self._file = file
        self._original = original

    def write(self, data):
        self._file.write(data)
        self._original.write(data)

    def flush(self):
        self._file.flush()
        self._original.flush()

    def __getattr__(self, name):
        return getattr(self._original, name)


def run_scheduler_job(job_id: str,
                      job_folder: str,
                      params: Dict,
                      job_manager: Optional[JobManager] = None,
                      progress_callback: Optional[Callable] = None,
                      academic_year: str = "",
                      semester: int = 1,
                      cancel_event=None) -> Dict:
    """
    Run a complete scheduling job, mirroring the main.py pipeline.

    Args:
        job_id:            Unique job identifier
        job_folder:        Path containing uploads/ and outputs/ subdirs
        params:            GA parameters (merged over defaults)
        job_manager:       Optional JobManager for status/progress updates
        progress_callback: Optional external progress callback
        academic_year:     Written into the JSON output config
        semester:          Written into the JSON output config

    Returns:
        Dict with job results and schedule_json key for the API response.
    """
    uploads_folder = os.path.join(job_folder, 'uploads')
    outputs_folder = os.path.join(job_folder, 'outputs')
    os.makedirs(outputs_folder, exist_ok=True)

    # ── Job logger (structured) ────────────────────────────────────────────
    # Writes to data/jobs/<job_id>/outputs/logs/ga_YYYY-MM-DD_HH-MM-SS.log
    job_logger, log_path = create_job_logger(job_id, outputs_folder)

    # ── stdout Tee: raw GA print() output captured alongside logger ────────
    # The Tee file lives in the same logs/ subdirectory.
    tee_path = log_path  # share the same file so all output is in one place
    _tee_file = open(tee_path, 'a', encoding='utf-8')
    _original_stdout = sys.stdout
    sys.stdout = _Tee(_tee_file, _original_stdout)

    job_logger.info("=" * 72)
    job_logger.info("JOB START  job_id=%s", job_id)
    job_logger.info("  academic_year=%s  semester=%s", academic_year, semester)
    job_logger.info("  params=%s", json.dumps(params, default=str))
    job_logger.info("=" * 72)

    try:
        result = _run_scheduler_job_inner(
            job_id=job_id,
            uploads_folder=uploads_folder,
            outputs_folder=outputs_folder,
            log_path=log_path,
            params=params,
            job_manager=job_manager,
            progress_callback=progress_callback,
            academic_year=academic_year,
            semester=semester,
            job_logger=job_logger,
            cancel_event=cancel_event,
        )
    except Exception as exc:
        job_logger.exception("Unhandled exception during job execution: %s", exc)
        raise
    finally:
        sys.stdout = _original_stdout
        _tee_file.close()

    job_logger.info("JOB END  job_id=%s  success=%s", job_id, result.get('success'))

    if job_manager:
        job_manager.add_file_to_job(job_id, 'output_log', log_path)

    return result


def _run_scheduler_job_inner(job_id, uploads_folder, outputs_folder, log_path,
                              params, job_manager, progress_callback,
                              academic_year, semester, job_logger=None,
                              cancel_event=None):
    log = job_logger or logging.getLogger(__name__)

    # ── Step 1: Load raw CSVs ─────────────────────────────────────────────────
    log.info("[STEP 1/5] Loading raw CSV files from uploads folder …")
    if job_manager:
        job_manager.update_job_status(job_id, 'loading_data')

    try:
        raw_data = _load_raw_data(uploads_folder)
        if not raw_data:
            raise ValueError("No input files found in uploads folder")
        log.info("  Loaded %d input file(s): %s", len(raw_data), list(raw_data.keys()))

        cleaned_data = clean_input_data(raw_data)
        entity_meta = compute_entity_meta(cleaned_data)

        curriculum_df = cleaned_data.get('curriculum')
        room_df       = cleaned_data.get('room')
        data_stats = {
            'curriculum_rows': len(curriculum_df) if curriculum_df is not None else 0,
            'rooms_rows':      len(room_df)       if room_df       is not None else 0,
        }
        log.info("  curriculum_rows=%d  rooms_rows=%d",
                 data_stats['curriculum_rows'], data_stats['rooms_rows'])
    except Exception as e:
        log.error("  Failed during data loading: %s", e)
        if job_manager:
            job_manager.update_job_status(job_id, 'failed', result={'error': str(e)})
        return {'success': False, 'error': str(e)}

    # ── Step 2: Preschedule (all 5 tasks) ────────────────────────────────────
    log.info("[STEP 2/5] Running preschedule processor (5 tasks) …")
    schedule_manager = ScheduleManager()
    processor = PrescheduleProcessor(schedule_manager)
    processor.run_all_tasks(cleaned_data)
    log.info("  Preschedule tasks complete.")

    # ── Step 3: Feasibility check ─────────────────────────────────────────────
    log.info("[STEP 3/5] Running feasibility check …")
    ga_context = build_ga_context(schedule_manager)
    checker = FeasibilityChecker(schedule_manager, context=ga_context)
    feasibility_report = checker.check()
    log.info("  Feasibility: is_feasible=%s", feasibility_report.is_feasible)

    if not feasibility_report.is_feasible:
        stored_result = {
            'job_id':      job_id,
            'success':     False,
            'error':       'Input data failed feasibility check — correct the errors above before running the scheduler.',
            'feasibility': feasibility_report.to_dict(),
        }
        if job_manager:
            job_manager.update_job_status(job_id, 'failed', result=stored_result)
        return stored_result

    # ── Step 4: GA ────────────────────────────────────────────────────────────
    log.info("[STEP 4/5] Starting Genetic Algorithm …")
    if job_manager:
        job_manager.update_job_progress(job_id, 'running_ga', 0, data_stats)

    def ga_progress(generation, max_gen, stats):
        if cancel_event and cancel_event.is_set():
            raise JobCancelledError(f"Job {job_id} cancelled at generation {generation}")
        progress = (generation / max_gen) * 100
        if job_manager:
            job_manager.update_job_progress(job_id, 'running_ga', progress, {
                'generation':    generation,
                'max_generations': max_gen,
                'best_fitness':  stats['best_fitness'],
                'violations':    stats['violations'],
            })
        if progress_callback:
            progress_callback(generation, max_gen, stats)

    # Use Island GA by default (n_islands ≥ 2), matching main.py
    n_islands = params.get('n_islands', _ISLAND_GA_DEFAULTS['n_islands'])
    if n_islands > 1:
        ga_kwargs = {**_ISLAND_GA_DEFAULTS, **params, 'n_islands': n_islands}
        ga = IslandGeneticAlgorithm(
            schedule_manager=schedule_manager,
            n_islands=ga_kwargs['n_islands'],
            island_population_size=ga_kwargs['island_population_size'],
            max_generations=ga_kwargs['max_generations'],
            migration_interval=ga_kwargs['migration_interval'],
            migration_rate=ga_kwargs['migration_rate'],
            topology=ga_kwargs['topology'],
            mutation_rate=ga_kwargs['mutation_rate'],
            crossover_rate=ga_kwargs['crossover_rate'],
            tournament_size=ga_kwargs['tournament_size'],
            elite_size=ga_kwargs['elite_size'],
            stagnation_limit=ga_kwargs['stagnation_limit'],
            catastrophic_after=ga_kwargs['catastrophic_after'],
            block_crossover_rate=ga_kwargs['block_crossover_rate'],
            min_improvement=ga_kwargs['min_improvement'],
            window_size=ga_kwargs['window_size'],
            progress_callback=ga_progress,
            context=ga_context,
        )
    else:
        ga = GeneticAlgorithm(
            schedule_manager=schedule_manager,
            population_size=params.get('population_size', 150),
            max_generations=params.get('max_generations', 500),
            mutation_rate=params.get('mutation_rate', 0.20),
            crossover_rate=params.get('crossover_rate', 0.80),
            elite_size=params.get('elite_size', 10),
            tournament_size=params.get('tournament_size', 7),
            stagnation_limit=params.get('stagnation_limit', 150),
            block_crossover_rate=params.get('block_crossover_rate', 0.5),
            min_improvement=params.get('min_improvement', 500),
            window_size=params.get('window_size', 1000),
            progress_callback=ga_progress,
            context=ga_context,
        )

    try:
        best_solution = ga.evolve()
        ga_result     = ga.get_result_summary()
    finally:
        if hasattr(ga, 'close'):
            ga.close()
    log.info("  GA complete — best_fitness=%s  violations=%s",
             ga_result.get('best_fitness'), ga_result.get('violations'))

    # ── Step 5: Export ────────────────────────────────────────────────────────
    log.info("[STEP 5/5] Exporting schedule …")
    if job_manager:
        job_manager.update_job_status(job_id, 'exporting')

    schedule_json = None
    json_path     = None

    if best_solution:
        # CSV export
        exporter = ScheduleExporter(
            schedule_manager=schedule_manager,
            chromosome=best_solution,
            output_dir=outputs_folder,
        )
        export_result = exporter.export_all(ga.lessons)

        if job_manager:
            job_manager.add_file_to_job(job_id, 'output_csv_dir', outputs_folder)

        # JSON export
        json_exporter = ScheduleJsonExporter(
            schedule_manager=schedule_manager,
            chromosome=best_solution,
            academic_year=academic_year,
            semester=semester,
        )
        schedule_json = json_exporter.export(ga.lessons)

        json_path = os.path.join(outputs_folder, 'schedule.json')
        with open(json_path, 'w', encoding='utf-8') as _f:
            json.dump(schedule_json, _f, ensure_ascii=False, indent=2)

        if job_manager:
            job_manager.add_file_to_job(job_id, 'output_json', json_path)
    else:
        log.warning("  No solution found — GA returned None.")
        export_result = {'error': 'No solution found'}

    # Slim result stored in jobs.json — no schedule content, just metadata + paths
    stored_result = {
        'job_id':         job_id,
        'data_stats':     data_stats,
        'feasibility':    feasibility_report.to_dict(),
        'ga_result':      ga_result,
        'export_result':  export_result,
        'outputs_folder': outputs_folder,
        'json_path':      json_path,
        'log_path':       log_path,
        'success':        True,
        'entity_meta':    entity_meta,
    }

    # NOTE: job_manager status is updated here (inside scheduler) for progress
    # tracking only.  The authoritative DB write happens in _run_job_background
    # AFTER this function returns, so the DB is always written before the
    # job_manager signals 'completed' to pollers.
    # We intentionally do NOT set 'completed' here — that is done in
    # _run_job_background after models.complete_schedule() succeeds.
    log.info("  Export complete — outputs saved to %s", outputs_folder)

    return {**stored_result, 'schedule_json': schedule_json}
