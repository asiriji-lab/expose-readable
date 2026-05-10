"""
Quick test script to verify the integration works.
This checks if all imports are correct and modules can be initialized.
"""

import sys
import os

print("="*80)
print("INTEGRATION TEST")
print("="*80)

try:
    print("\n1. Testing imports...")
    
    # Test data_cleaning imports
    print("   ✓ Importing data_cleaning module...")
    from src.data_cleaning.data_cleaning import clean_input_data
    
    # Test preschedule imports
    print("   ✓ Importing preschedule modules...")
    from src.preschedule.scheduleManager import ScheduleManager
    from src.preschedule.prescheduleProcessor import PrescheduleProcessor
    
    # Test GA imports
    print("   ✓ Importing integrated GA...")
    from src.ga.genetic_algorithm import GeneticAlgorithm
    from src.ga.models import Lesson, TimeSlot, Chromosome
    
    # Test types
    print("   ✓ Importing types...")
    from src.types import PeriodItemData
    
    print("   ✅ All imports successful!")
    
    print("\n2. Testing ScheduleManager initialization...")
    manager = ScheduleManager()
    print(f"   ✓ Created ScheduleManager")
    print(f"   ✓ student_grids: {type(manager.student_grids)}")
    print(f"   ✓ teacher_grids: {type(manager.teacher_grids)}")
    print(f"   ✓ room_grids: {type(manager.room_grids)}")
    print(f"   ✓ periods: {type(manager.periods)}")
    print(f"   ✓ conflicts: {type(manager.conflicts)}")
    print("   ✅ ScheduleManager initialized successfully!")
    
    print("\n3. Testing PrescheduleProcessor initialization...")
    processor = PrescheduleProcessor(manager)
    print(f"   ✓ Created PrescheduleProcessor with ScheduleManager")
    print("   ✅ PrescheduleProcessor initialized successfully!")
    
    print("\n4. Testing data structures...")
    # Test Period
    period = PeriodItemData(label="1", time="08:00-08:50")
    print(f"   ✓ PeriodItemData: {period}")
    
    # Test TimeSlot
    slot = TimeSlot(day="MON", period="1")
    print(f"   ✓ TimeSlot: {slot}")
    
    # Test Chromosome
    chromosome = Chromosome()
    print(f"   ✓ Chromosome: {type(chromosome)}")
    print("   ✅ Data structures created successfully!")
    
    print("\n5. Checking file paths...")
    input_dir = "input_dataset"
    if os.path.exists(input_dir):
        print(f"   ✓ Input directory exists: {input_dir}/")
        files = os.listdir(input_dir)
        print(f"   ✓ Files found: {len(files)}")
        for f in files:
            if f.endswith('.csv'):
                print(f"      - {f}")
    else:
        print(f"   ⚠ Input directory not found: {input_dir}/")
        print(f"      You'll need to create this directory with your CSV files")
    
    print("\n6. Checking output directories...")
    output_dirs = ['cleaned_input', 'output', 'output/ga_results']
    for d in output_dirs:
        if os.path.exists(d):
            print(f"   ✓ {d}/ exists")
        else:
            print(f"   - {d}/ will be created on first run")
    
    print("\n" + "="*80)
    print("✅ INTEGRATION TEST PASSED!")
    print("="*80)
    print("\nThe integration is working correctly. You can now run:")
    print("  python integrated_main.py")
    print("\nMake sure you have your input CSV files in the input_dataset/ directory.")
    
except ImportError as e:
    print(f"\n❌ Import Error: {e}")
    print("\nMake sure all required packages are installed:")
    print("  pip install -r requirements.txt")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
