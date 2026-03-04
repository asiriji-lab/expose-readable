"""
================================================================================
GA SCHEDULER - Scheduler Runner
================================================================================

Main scheduler orchestration - ties together data loading, GA, and export.
"""

import os
import glob
from typing import Dict, Optional, Callable

from src.data_cleaning.data_cleaning import clean_input_data
from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from .genetic_algorithm import GeneticAlgorithm
from .exporter import ScheduleExporter
from .job_manager import JobManager
from .feasibility_checker import FeasibilityChecker


def run_scheduler_job(job_id: str,
                      job_folder: str,
                      params: Dict,
                      job_manager: Optional[JobManager] = None,
                      progress_callback: Optional[Callable] = None) -> Dict:
    """
    Run a complete scheduling job.
    
    Args:
        job_id: Unique job identifier
        job_folder: Path to job folder containing uploads/outputs
        params: GA parameters
        job_manager: Optional JobManager for status updates
        progress_callback: Optional callback for progress updates
        
    Returns:
        Dictionary with job results
    """
    uploads_folder = os.path.join(job_folder, 'uploads')
    outputs_folder = os.path.join(job_folder, 'outputs')
    
    # Ensure output folder exists
    os.makedirs(outputs_folder, exist_ok=True)
    
    # Update status
    if job_manager:
        job_manager.update_job_status(job_id, 'loading_data')
    
    # 1. Clean Data (replaces DataLoader)
    try:
        cleaned_data = clean_input_data(uploads_folder)
        data_stats = {
            'curriculum_rows': len(cleaned_data.get('curriculum', [])),
            'rooms_rows': len(cleaned_data.get('rooms', [])),
        }
    except Exception as e:
        if job_manager:
             job_manager.update_job_status(job_id, 'failed', result={'error': str(e)})
        return {'success': False, 'error': str(e)}
        
    # 2. Initialize ScheduleManager
    schedule_manager = ScheduleManager()
    
    # 3. Preschedule Processing (Tasks 1-5)
    # We need to run the prescheduler pipeline to populate initial state
    processor = PrescheduleProcessor(schedule_manager)
    
    # Task 1: Setup
    processor.task1_process_data_and_setup(cleaned_data)
    
    # Task 2: Allocations (if any logic exists here)
    processor.task2_preplace_allocation()
    
    # Task 3: Availability
    processor.task3_mark_unavailable()
    
    # Task 4 & 5: Electives & Scout
    processor.task4_schedule_electives()
    processor.task5_assign_scout()
    
    # Feasibility check before running the GA
    checker = FeasibilityChecker(schedule_manager)
    feasibility_report = checker.check()

    # Update status
    if job_manager:
        job_manager.update_job_progress(job_id, 'running_ga', 0, data_stats)

    # Define progress callback for GA
    def ga_progress(generation, max_gen, stats):
        progress = (generation / max_gen) * 100
        if job_manager:
            job_manager.update_job_progress(job_id, 'running_ga', progress, {
                'generation': generation,
                'max_generations': max_gen,
                'best_fitness': stats['best_fitness'],
                'violations': stats['violations']
            })
        if progress_callback:
            progress_callback(generation, max_gen, stats)
    
    # Run GA
    ga = GeneticAlgorithm(
        schedule_manager=schedule_manager, # Replaces data_loader
        population_size=params.get('population_size', 150),
        max_generations=params.get('max_generations', 500),
        mutation_rate=params.get('mutation_rate', 0.20),
        crossover_rate=params.get('crossover_rate', 0.80),
        elite_size=params.get('elite_size', 10),
        tournament_size=params.get('tournament_size', 7),
        progress_callback=ga_progress
    )
    
    best_solution = ga.evolve()
    ga_result = ga.get_result_summary()
    
    # Update status
    if job_manager:
        job_manager.update_job_status(job_id, 'exporting')
    
    # Export results
    # Use the refactored Exporter which takes Manager and Chromosome
    if best_solution:
        exporter = ScheduleExporter(
            schedule_manager=schedule_manager, 
            chromosome=best_solution, 
            output_dir=outputs_folder
        )
        # Note: We pass ga.lessons here as per our previous fix
        export_result = exporter.export_all(ga.lessons)
    else:
         export_result = {'error': 'No solution found'}
    
    # Compile final result
    result = {
        'job_id': job_id,
        'data_stats': data_stats,
        'feasibility': feasibility_report.to_dict(),
        'ga_result': ga_result,
        'export_result': export_result,
        'success': True
    }
    
    # Update final status
    if job_manager:
        job_manager.update_job_status(job_id, 'completed', result=result)
    
    return result