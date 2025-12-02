"""
================================================================================
GA SCHEDULER - Scheduler Runner
================================================================================

Main scheduler orchestration - ties together data loading, GA, and export.
"""

import os
import glob
from typing import Dict, Optional, Callable

from .data_loader import DataLoader
from .genetic_algorithm import GeneticAlgorithm
from .exporter import ScheduleExporter
from .job_manager import JobManager


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
    
    # Find input files
    curriculum_file = os.path.join(uploads_folder, 'curriculum.csv')
    rooms_file = os.path.join(uploads_folder, 'rooms.csv')
    
    student_files = glob.glob(os.path.join(uploads_folder, 'student_*.csv'))
    teacher_files = glob.glob(os.path.join(uploads_folder, 'teacher_*.csv'))
    room_timetable_files = [f for f in glob.glob(os.path.join(uploads_folder, 'room_*.csv'))
                           if 'rooms.csv' not in f]
    
    # Update status
    if job_manager:
        job_manager.update_job_status(job_id, 'loading_data')
    
    # Load data
    data_loader = DataLoader(uploads_folder)
    data_loader.load_all(
        curriculum_file=curriculum_file,
        room_file=rooms_file,
        student_files=student_files,
        teacher_files=teacher_files,
        room_timetable_files=room_timetable_files
    )
    
    data_stats = data_loader.get_stats()
    
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
        data_loader=data_loader,
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
    exporter = ScheduleExporter(data_loader, best_solution, outputs_folder)
    export_result = exporter.export_all()
    
    # Compile final result
    result = {
        'job_id': job_id,
        'data_stats': data_stats,
        'ga_result': ga_result,
        'export_result': export_result,
        'success': True
    }
    
    # Update final status
    if job_manager:
        job_manager.update_job_status(job_id, 'completed', result=result)
    
    return result