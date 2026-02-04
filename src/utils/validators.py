"""
================================================================================
GA SCHEDULER - Validators
================================================================================

Validation functions for uploaded files.
"""

import os
import re
import pandas as pd
from typing import Dict


def validate_curriculum(filepath: str) -> Dict:
    """
    Validate curriculum CSV file format.
    
    Expected columns:
    - subject_id, subject_name, periods_per_week, teacher, 
    - block_pattern, student_class, constraint, room, fixed_period
    
    Returns:
        Dict with 'valid', 'error', 'lessons_count', 'grades'
    """
    try:
        df = pd.read_csv(filepath)
        
        # Check required columns
        required_columns = ['subject_id', 'periods_per_week', 'teacher', 'student_class']
        missing = [col for col in required_columns if col not in df.columns]
        
        if missing:
            return {
                'valid': False,
                'error': f"Missing required columns: {', '.join(missing)}"
            }
        
        # Count lessons and grades
        lessons_count = 0
        grades = set()
        
        for _, row in df.iterrows():
            subject_id = str(row.get('subject_id', '')).strip()
            
            # Check for grade markers
            if subject_id.startswith('ม.'):
                grades.add(subject_id)
                continue
            
            # Count valid lessons
            if pd.notna(row.get('periods_per_week')) and pd.notna(row.get('teacher')):
                lessons_count += 1
        
        return {
            'valid': True,
            'lessons_count': lessons_count,
            'grades': list(grades)
        }
        
    except Exception as e:
        return {
            'valid': False,
            'error': f"Error reading file: {str(e)}"
        }


def validate_rooms(filepath: str) -> Dict:
    """
    Validate rooms CSV file format.
    
    Expected columns:
    - room_id (required)
    - note, tag (optional)
    
    Returns:
        Dict with 'valid', 'error', 'rooms_count'
    """
    try:
        df = pd.read_csv(filepath)
        
        if 'room_id' not in df.columns:
            return {
                'valid': False,
                'error': "Missing required column: room_id"
            }
        
        # Count valid rooms
        rooms_count = len(df[df['room_id'].notna()])
        
        if rooms_count == 0:
            return {
                'valid': False,
                'error': "No valid rooms found in file"
            }
        
        return {
            'valid': True,
            'rooms_count': rooms_count
        }
        
    except Exception as e:
        return {
            'valid': False,
            'error': f"Error reading file: {str(e)}"
        }


def validate_timetable(filepath: str) -> Dict:
    """
    Validate timetable CSV file format.
    
    Timetables should have:
    - Days as row index (Monday-Friday)
    - Periods as columns (1-10, breaks)
    
    Auto-detects type from filename:
    - student_X_X.csv
    - teacher_TXXX.csv
    - room_XXX.csv
    
    Returns:
        Dict with 'valid', 'error', 'type', 'entity_id'
    """
    try:
        filename = os.path.basename(filepath)
        
        # Detect type from filename
        timetable_type = None
        entity_id = None
        
        student_match = re.search(r'student_(\d+_\d+)', filename)
        teacher_match = re.search(r'teacher_([A-Za-z]\d+)', filename)
        room_match = re.search(r'room_(.+)\.csv', filename)
        
        if student_match:
            timetable_type = 'student'
            entity_id = student_match.group(1)
        elif teacher_match:
            timetable_type = 'teacher'
            entity_id = teacher_match.group(1)
        elif room_match:
            timetable_type = 'room'
            entity_id = room_match.group(1)
        else:
            return {
                'valid': False,
                'error': "Could not determine timetable type from filename. Use format: student_X_X.csv, teacher_TXXX.csv, or room_XXX.csv"
            }
        
        # Load and validate structure
        df = pd.read_csv(filepath, index_col=0)
        
        # Check for expected days
        expected_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        
        # Allow for time row at the top
        if len(df) > 0 and df.index[0] not in expected_days:
            df = df.iloc[1:]
        
        found_days = [d for d in expected_days if d in df.index]
        
        if len(found_days) < 3:
            return {
                'valid': False,
                'error': f"Timetable should have days (Monday-Friday) as rows. Found: {list(df.index)}"
            }
        
        return {
            'valid': True,
            'type': timetable_type,
            'entity_id': entity_id
        }
        
    except Exception as e:
        return {
            'valid': False,
            'error': f"Error reading file: {str(e)}"
        }