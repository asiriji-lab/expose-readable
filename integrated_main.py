"""
Integrated main execution script for ScheDool.
Flow: Input Data -> Data Cleaning -> Preschedule Processing -> GA Optimization
"""

import pandas as pd
import json
import os
from typing import Dict

from src.preschedule.scheduleManager import ScheduleManager
from src.preschedule.prescheduleProcessor import PrescheduleProcessor
from src.data_cleaning.data_cleaning import clean_input_data
from src.ga.integrated_genetic_algorithm import GeneticAlgorithm
from src.ga.models import Lesson
from src.types import PeriodItemData


def create_output_directories():
    """Create output directories if they don't exist."""
    directories = ['cleaned_input', 'output', 'output/ga_results']
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ Ensured directory exists: {directory}/")


def load_csv_files(file_paths: Dict[str, str]) -> Dict[str, pd.DataFrame]:
    """Load CSV files into pandas DataFrames."""
    print("\n" + "="*80)
    print("LOADING INPUT FILES")
    print("="*80 + "\n")
    
    loaded_data = {}
    
    for sheet_name, filepath in file_paths.items():
        try:
            df = pd.read_csv(filepath, encoding='utf-8')
            loaded_data[sheet_name] = df
            print(f"✅ Loaded {sheet_name}: {len(df)} rows, {len(df.columns)} columns")
        except Exception as e:
            print(f"❌ Failed to load {sheet_name}: {str(e)}")
    
    return loaded_data


def export_cleaned_data(cleaned_data: Dict[str, pd.DataFrame], output_dir: str = "cleaned_input"):
    """Export cleaned DataFrames to CSV files."""
    print(f"\n📤 Exporting cleaned data to {output_dir}/...")
    
    for sheet_name, df in cleaned_data.items():
        output_path = os.path.join(output_dir, f"{sheet_name}_cleaned.csv")
        try:
            df.to_csv(output_path, index=False, encoding='utf-8')
            print(f"  ✅ {sheet_name}_cleaned.csv ({len(df)} rows)")
        except Exception as e:
            print(f"  ❌ Failed to export {sheet_name}: {str(e)}")
    
    print(f"✅ All cleaned data exported to {output_dir}/")


def export_preschedule_results(schedule_manager: ScheduleManager, output_dir: str = "output"):
    """Export preschedule results to CSV and Excel."""
    print(f"\n📤 Exporting preschedule results...")
    
    # Create subdirectories
    student_dir = os.path.join(output_dir, "preschedule", "students")
    teacher_dir = os.path.join(output_dir, "preschedule", "teachers")
    room_dir = os.path.join(output_dir, "preschedule", "rooms")
    
    for directory in [student_dir, teacher_dir, room_dir]:
        os.makedirs(directory, exist_ok=True)
    
    # Export student schedules
    for class_id, schedule_df in schedule_manager.student_grids.items():
        safe_filename = class_id.replace('/', '_')
        output_path = os.path.join(student_dir, f"student_{safe_filename}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.student_grids)} student preschedules")
    
    # Export teacher schedules
    for teacher_id, schedule_df in schedule_manager.teacher_grids.items():
        output_path = os.path.join(teacher_dir, f"teacher_{teacher_id}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.teacher_grids)} teacher preschedules")
    
    # Export room schedules
    for room_id, schedule_df in schedule_manager.room_grids.items():
        safe_filename = room_id.replace('/', '_')
        output_path = os.path.join(room_dir, f"room_{safe_filename}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.room_grids)} room preschedules")
    
    # Export conflicts
    if schedule_manager.conflicts:
        conflicts_df = pd.DataFrame(schedule_manager.conflicts)
        conflicts_path = os.path.join(output_dir, "preschedule_conflicts.csv")
        conflicts_df.to_csv(conflicts_path, index=False, encoding='utf-8')
        print(f"  ✅ Exported {len(schedule_manager.conflicts)} preschedule conflicts")
    
    print(f"✅ Preschedule results exported to {output_dir}/preschedule/")


def export_final_schedules(schedule_manager, ga_instance=None, output_dir: str = "output"):
    """Export final GA-optimized schedules to CSV files."""
    print(f"\n📤 Exporting final GA-optimized schedules...")
    
    if ga_instance and ga_instance.best_chromosome:
        from src.ga.exporter import ScheduleExporter
        exporter = ScheduleExporter(
            schedule_manager=schedule_manager,
            chromosome=ga_instance.best_chromosome,
            output_dir=os.path.join(output_dir, "final")
        )
        # We need to pass the lessons list to export_all as per our refactor
        stats = exporter.export_all(ga_instance.lessons)
        print(f"  ✅ Exported formatted schedules: {stats}")
    else:
        # Fallback to raw dump if no GA instance provided
        print("  ⚠️  No GA instance provided, performing raw dump of ScheduleManager grids...")
        
    # Create subdirectories
    student_dir = os.path.join(output_dir, "final", "students")
    teacher_dir = os.path.join(output_dir, "final", "teachers")
    room_dir = os.path.join(output_dir, "final", "rooms")
    
    for directory in [student_dir, teacher_dir, room_dir]:
        os.makedirs(directory, exist_ok=True)
    
    # Export student schedules
    for class_id, schedule_df in schedule_manager.student_grids.items():
        safe_filename = class_id.replace('/', '_')
        output_path = os.path.join(student_dir, f"student_{safe_filename}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.student_grids)} student schedules")
    
    # Export teacher schedules
    for teacher_id, schedule_df in schedule_manager.teacher_grids.items():
        output_path = os.path.join(teacher_dir, f"teacher_{teacher_id}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.teacher_grids)} teacher schedules")
    
    # Export room schedules
    for room_id, schedule_df in schedule_manager.room_grids.items():
        safe_filename = room_id.replace('/', '_')
        output_path = os.path.join(room_dir, f"room_{safe_filename}.csv")
        schedule_df.to_csv(output_path, encoding='utf-8')
    print(f"  ✅ Exported {len(schedule_manager.room_grids)} room schedules")
    
    print(f"✅ Final schedules exported to {output_dir}/final/")


def main():
    """Main integrated execution function."""
    # Create output directories
    create_output_directories()
    
    # =========================================================================
    # STEP 1: LOAD RAW DATA
    # =========================================================================
    file_paths = {
        'curriculum': 'input_dataset/curriculum.csv',
        'elective': 'input_dataset/elective.csv',
        'teacher': 'input_dataset/teacher.csv',
        'period': 'input_dataset/period.csv',
        'preplace': 'input_dataset/preplace.csv',
        'room': 'input_dataset/room.csv',
        'student': 'input_dataset/student.csv',
        'scout': 'input_dataset/scout.csv'
    }
    
    raw_data = load_csv_files(file_paths)
    
    if not raw_data:
        print("❌ No data loaded. Please check file paths.")
        return
    
    # =========================================================================
    # STEP 2: DATA CLEANING
    # =========================================================================
    print("\n" + "="*80)
    print("CLEANING AND PREPROCESSING DATA")
    print("="*80 + "\n")
    
    cleaned_data = clean_input_data(raw_data)
    export_cleaned_data(cleaned_data, output_dir="cleaned_input")
    
    # =========================================================================
    # STEP 3: PRESCHEDULE PROCESSING
    # =========================================================================
    print("\n" + "="*80)
    print("PRESCHEDULE PROCESSING")
    print("="*80 + "\n")
    
    schedule_manager = ScheduleManager()
    processor = PrescheduleProcessor(schedule_manager)
    preschedule_results = processor.run_all_tasks(cleaned_data)
    
    # Export preschedule results
    export_preschedule_results(schedule_manager, "output")
    
    print("\n📊 Preschedule Summary:")
    for task_name, task_result in preschedule_results.items():
        if task_name != 'summary':
            print(f"\n{task_name.upper()}:")
            if isinstance(task_result, dict):
                for key, value in task_result.items():
                    print(f"  - {key}: {value}")
    
    # =========================================================================
    # STEP 4: GA OPTIMIZATION
    # =========================================================================
    print("\n" + "="*80)
    print("GENETIC ALGORITHM OPTIMIZATION")
    print("="*80 + "\n")
    
    # Create lessons from curriculum for GA
    # curriculum_df = cleaned_data.get('curriculum')
    # if curriculum_df is None:
    #     print("❌ Curriculum data not found!")
    #     return
    
    print("🧬 Initializing Genetic Algorithm with ScheduleManager state...")
    
    # GA parameters
    ga_params = {
        'population_size': 150,
        'max_generations': 500,
        'mutation_rate': 0.20,
        'crossover_rate': 0.80,
        'elite_size': 10,
        'tournament_size': 7
    }
    
    # Progress callback
    def ga_progress(generation, max_gen, stats):
        if generation % 50 == 0:
            print(f"  Generation {generation}/{max_gen}: "
                  f"Best Fitness = {stats['best_fitness']:.2f}, "
                  f"Violations = {stats['violations']}")
    
    # Initialize and run GA with ScheduleManager
    ga = GeneticAlgorithm(
        schedule_manager=schedule_manager,
        population_size=ga_params['population_size'],
        max_generations=ga_params['max_generations'],
        mutation_rate=ga_params['mutation_rate'],
        crossover_rate=ga_params['crossover_rate'],
        elite_size=ga_params['elite_size'],
        tournament_size=ga_params['tournament_size'],
        progress_callback=ga_progress
    )
    
    print("🚀 Starting GA evolution...")
    best_solution = ga.evolve()
    ga_result = ga.get_result_summary()
    
    print("\n✅ GA Optimization Complete!")
    print(f"\n📊 GA Results:")
    print(f"  - Final Fitness: {ga_result['final_fitness']:.2f}")
    print(f"  - Generations Run: {ga_result['generations_run']}")
    print(f"  - Solution Found: {ga_result['solution_found']}")
    print(f"  - Final Violations: {ga_result['final_violations']}")
    
    # =========================================================================
    # STEP 5: APPLY GA SOLUTION TO SCHEDULE MANAGER & EXPORT
    # =========================================================================
    print("\n" + "="*80)
    print("APPLYING GA SOLUTION TO SCHEDULES")
    print("="*80 + "\n")
    
    # The GA has already updated the ScheduleManager with the best solution
    # Now export the final schedules
    export_final_schedules(schedule_manager, "output")
    
    # Save GA statistics
    ga_stats_path = "output/ga_results/ga_statistics.json"
    with open(ga_stats_path, 'w', encoding='utf-8') as f:
        json.dump({
            'result_summary': ga_result,
            'generation_stats': ga.generation_stats
        }, f, indent=2, ensure_ascii=False)
    print(f"✅ GA statistics saved to {ga_stats_path}")
    
    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    print("\n" + "="*80)
    print("EXECUTION COMPLETE")
    print("="*80 + "\n")
    
    print("✅ All processing complete!")
    print(f"\n📁 Output files:")
    print(f"  Cleaned Input:")
    print(f"    - cleaned_input/*.csv (8 cleaned data files)")
    print(f"  Preschedule Results:")
    print(f"    - output/preschedule/students/*.csv ({len(schedule_manager.student_grids)} files)")
    print(f"    - output/preschedule/teachers/*.csv ({len(schedule_manager.teacher_grids)} files)")
    print(f"    - output/preschedule/rooms/*.csv ({len(schedule_manager.room_grids)} files)")
    if schedule_manager.conflicts:
        print(f"    - output/preschedule_conflicts.csv")
    print(f"  Final GA-Optimized Schedules:")
    print(f"    - output/final/students/*.csv ({len(schedule_manager.student_grids)} files)")
    print(f"    - output/final/teachers/*.csv ({len(schedule_manager.teacher_grids)} files)")
    print(f"    - output/final/rooms/*.csv ({len(schedule_manager.room_grids)} files)")
    print(f"  GA Statistics:")
    print(f"    - output/ga_results/ga_statistics.json")


if __name__ == "__main__":
    main()
