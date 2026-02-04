import pandas as pd
import re
from src.data_cleaning.mapping import create_room_lookup, create_teacher_lookup,resolve_teacher_names_to_ids, parse_student_class_string, resolve_room_to_ids, get_grade_sections

# data cleaning for curriculum sheet (teacher, studetn_class, room)
def clean_curriculum(
    df_curriculum: pd.DataFrame, 
    df_teacher: pd.DataFrame, 
    df_room: pd.DataFrame,
    df_student: pd.DataFrame,
) -> pd.DataFrame:
    if df_curriculum.empty:
        return df_curriculum
    
    print("\n--- Starting Curriculum Data Cleaning ---")
    
    # Process lookups
    teacher_lookup = create_teacher_lookup(df_teacher)
    room_lookup = create_room_lookup(df_room)
    grade_section_counts = get_grade_sections(df_student)
    
    # --- Main Iteration and Logic ---
    processed_rows = []
    current_grade_sections = [] 
    current_grade = None
    grade_marker_pattern = re.compile(r'ม\.\d+') 


    for _, row in df_curriculum.iterrows():
        # Get a dictionary representation of the current row (important for manipulation)
        row_dict = row.to_dict()
        first_col_value = str(row_dict[df_curriculum.columns[0]]).strip() 

        # Check for Grade Marker
        if grade_marker_pattern.match(first_col_value):
            current_grade = first_col_value
            current_grade_sections = grade_section_counts.get(current_grade, [])
            # print(f"Detected Grade Marker: {current_grade}. Sections: {current_grade_sections}")

            # Skip grade marker rows (they are not needed in the final output)
            # processed_rows.append(row_dict) 
            continue 
            
        # --- Process Data Rows (Non-marker rows) ---
        # A. Clean 'subject_id' and 'subject_name' column
        current_subject_id = str(row_dict.get('subject_id', '')).strip()
        current_subject_name = str(row_dict.get('subject_name', '')).strip()
        
        # Check if current subject_id is NaN/empty
        if pd.isna(row_dict.get('subject_id')) or current_subject_id == '' or current_subject_id == 'nan':
            # Use previous row's subject_id if available
            if 'prev_subject_id' in locals() and prev_subject_id:
                row_dict['subject_id'] = prev_subject_id
            else:
                row_dict['subject_id'] = ''
        else:
            row_dict['subject_id'] = current_subject_id
            prev_subject_id = current_subject_id  # Store for next iteration
        
        # Check if current subject_name is NaN/empty
        if pd.isna(row_dict.get('subject_name')) or current_subject_name == '' or current_subject_name == 'nan':
            # Use previous row's subject_name if available
            if 'prev_subject_name' in locals() and prev_subject_name:
                row_dict['subject_name'] = prev_subject_name
            else:
                row_dict['subject_name'] = ''
        else:
            row_dict['subject_name'] = current_subject_name
            prev_subject_name = current_subject_name  # Store for next iteration


        # B. Clean 'teacher' column
        raw_teacher_name = row_dict.get('teacher')
        row_dict['teacher'] = resolve_teacher_names_to_ids(raw_teacher_name, teacher_lookup)
        
        
        # C. Clean 'student_class' column
        raw_section_str = row_dict.get('student_class')
        
        if pd.isna(raw_section_str) or raw_section_str == '':
            # Rule 1: NaN/Null means all sections for the current grade
            cleaned_sections = current_grade_sections
        else:
            # Rules 2, 3, 4: Specific/Range/Mixed (uses previously defined parse_student_class_string)
            cleaned_sections = parse_student_class_string(raw_section_str)
            
            # Validation: Filter sections to only those valid for the current grade
            valid_sections = [s for s in cleaned_sections if s in current_grade_sections]
            cleaned_sections = valid_sections

        # Convert to room_id
        for section in cleaned_sections:
            section = f"{current_grade}/{section}"
            
        row_dict['student_class'] = cleaned_sections
        

        # D. Clean 'room' column
        raw_room_str = row_dict.get('room')
        row_dict['room'] = resolve_room_to_ids(raw_room_str, room_lookup)
        
        
        # E. Clean 'block_pattern' column
        # If NaN or empty, use periods_per_week value
        block_pattern = row_dict.get('block_pattern')
        if pd.isna(block_pattern) or str(block_pattern).strip() == '' or str(block_pattern).strip() == 'nan':
            # Use periods_per_week as default block pattern
            periods_per_week = row_dict.get('periods_per_week')
            if pd.notna(periods_per_week):
                row_dict['block_pattern'] = str(int(float(periods_per_week)))
            else:
                row_dict['block_pattern'] = '1'  # Default to 1 if both are missing
        else:
            row_dict['block_pattern'] = str(block_pattern).strip()
        
        # Append the fully cleaned data row
        processed_rows.append(row_dict)
        
    # Reconstruct the final DataFrame
    df_cleaned = pd.DataFrame(processed_rows)
    print("✅ Curriculum data cleaning complete.")
    print("--- Curriculum Data Cleaning Complete ---")
    return df_cleaned

# data cleaning for elective sheet (teacher, room)
def clean_elective(
    df_elective: pd.DataFrame, 
    df_teacher: pd.DataFrame, 
    df_room: pd.DataFrame
) -> pd.DataFrame:
    if df_elective.empty:
        print("⚠️ Elective DataFrame is empty. Skipping cleaning.")
        return df_elective
        
    print("\n--- Starting Elective Data Cleaning and Resolution ---")

    # Pre-process Lookups
    teacher_lookup = create_teacher_lookup(df_teacher)
    room_lookup = create_room_lookup(df_room) 
    
    # Apply Resolution to Columns
    # A. Resolve 'teacher' column (Name -> ID List)
    print("  - Resolving teacher names to IDs...")
    df_elective['teacher'] = df_elective['teacher'].apply(
        lambda x: resolve_teacher_names_to_ids(x, teacher_lookup)
    )

    # B. Resolve 'room' column (Tag/ID -> Room ID/List)
    print("  - Resolving room requirements...")
    df_elective['room'] = df_elective['room'].apply(
        lambda x: resolve_room_to_ids(x, room_lookup)
    )
    
    # Ensure subject ID and name are strings
    df_elective['subject_id'] = df_elective['subject_id'].astype(str).str.strip()
    df_elective['subject_name'] = df_elective['subject_name'].astype(str).str.strip()
            
    print("✅ Elective data cleaning complete.")
    print("--- Elective Data Cleaning Complete ---")
    return df_elective

# data cleaning for scout sheet (teacher)
def clean_scout(
    df_scout: pd.DataFrame, 
    df_teacher: pd.DataFrame
) -> pd.DataFrame:
    if df_scout.empty:
        print("⚠️ Scout DataFrame is empty. Skipping cleaning.")
        return df_scout
        
    print("\n--- Starting Scout Data Cleaning ---")

    # Create Teacher Name -> ID Lookup
    teacher_lookup = create_teacher_lookup(df_teacher)
    
    for col in df_scout.columns:
        print(f"  - Resolving teacher names to IDs for column {col}")
        df_scout[col] = df_scout[col].apply(
            lambda x: resolve_teacher_names_to_ids(x, teacher_lookup)
        )

    print("✅ Scout data cleaning complete.")
    print("--- Scout Data Cleaning Complete ---")
    return df_scout

# data cleaning for teacher sheet (marker rows)
def clean_teacher(df_teacher: pd.DataFrame) -> pd.DataFrame:
    if df_teacher.empty:
        print("⚠️ Teacher DataFrame is empty. Skipping cleaning.")
        return df_teacher
        
    print("\n--- Starting Teacher Data Cleaning---")

    marker_values = ['ครูในโรงเรียน', 'อาจารย์นอก']
    
    # 1. Identify rows to keep (where the first column does NOT contain the marker values)
    df_cleaned = df_teacher[
        ~df_teacher['teacher_id'].astype(str).str.strip().isin(marker_values)
    ].copy()
    
    # clean empty missing or invalid (marker) rows
    df_cleaned.dropna(subset=['teacher_id'], inplace=True)
    
    print(f"✅ Teacher marker and invalid rows removed.")
    print("--- Teacher Data Cleaning Complete ---")
    return df_cleaned

# data cleaning for student sheet (ensure grade is string)
def clean_student(df_student: pd.DataFrame) -> pd.DataFrame:
    if df_student.empty:
        print("⚠️ Student DataFrame is empty. Skipping cleaning.")
        return df_student
        
    print("\n--- Starting Student Data Cleaning ---")
    
    # Simply ensure grade is string format (assume CSV already has "ม.1" format)
    df_student['grade'] = df_student['grade'].astype(str).str.strip()
    
    # Ensure section is numeric
    df_student['section'] = pd.to_numeric(df_student['section'], errors='coerce').fillna(-1).astype(int)
    
    # Validate results
    print(f"✅ Student data cleaned")
    print(f"   Unique grades: {sorted(df_student['grade'].unique())}")
    print(f"   Total students: {len(df_student)}")
    print("--- Student Data Cleaning Complete ---")
    return df_student