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

    # Carry-forward state for merged-cell propagation
    prev_subject_id = ''
    prev_subject_name = ''
    prev_constraint = ''
    prev_raw_room = ''
    prev_fixed_period = ''
    group_id_counter = 0
    grade_marker_count = 0

    def _is_empty(val) -> bool:
        return pd.isna(val) or str(val).strip() in ('', 'nan', 'None')

    for _, row in df_curriculum.iterrows():
        row_dict = row.to_dict()
        first_col_value = str(row_dict[df_curriculum.columns[0]]).strip()

        # Check for Grade Marker — skip, don't update carry-forward state
        if grade_marker_pattern.match(first_col_value):
            grade_marker_count += 1
            # if grade_marker_count > 3:
            #     print(f"  [Cleaner] Stopping at grade marker #{grade_marker_count} ({first_col_value}) — test limit reached.")
            #     break
            current_grade = first_col_value
            current_grade_sections = grade_section_counts.get(current_grade, [])
            continue

        # --- Process Data Rows (Non-marker rows) ---
        # A. Classify row type and propagate subject / group fields
        current_subject_id   = str(row_dict.get('subject_id',   '')).strip()
        current_subject_name = str(row_dict.get('subject_name', '')).strip()

        subject_id_missing   = _is_empty(row_dict.get('subject_id'))
        subject_name_missing = _is_empty(row_dict.get('subject_name'))

        # A true continuation row: merged cell — BOTH subject_id and subject_name are blank
        # An activity row      : subject_id blank but subject_name present (e.g. กิจกรรมแนะแนว, EFF)
        # An anchor row        : subject_id is present
        is_true_continuation = subject_id_missing and subject_name_missing
        is_activity          = subject_id_missing and not subject_name_missing
        # is_anchor            = not subject_id_missing

        if is_true_continuation:
            # Inherit subject identity from anchor
            row_dict['subject_id']   = prev_subject_id
            row_dict['subject_name'] = prev_subject_name
            row_dict['group_id']     = group_id_counter

            # Propagate constraint / room / fixed_period only when current value is missing
            if _is_empty(row_dict.get('constraint')):
                row_dict['constraint']    = prev_constraint
            if _is_empty(row_dict.get('room')):
                row_dict['room']          = prev_raw_room       # raw string, resolved later
            if _is_empty(row_dict.get('fixed_period')):
                row_dict['fixed_period']  = prev_fixed_period

        elif is_activity:
            # No subject_id — use subject_name as the identifier so these rows
            # don't get merged under the previous subject's ID
            row_dict['subject_id'] = str(row_dict.get('subject_name', '')).strip()
            group_id_counter += 1
            row_dict['group_id']   = group_id_counter

        else:
            # Anchor row — check if it's a sibling (same subject_id + subject_name
            # as the previous anchor, e.g. ว31283 split across 5 class rows).
            # Siblings share the same group_id so constraint groups span all sections.
            current_fp = '' if _is_empty(row_dict.get('fixed_period')) else str(row_dict.get('fixed_period')).strip()
            # Rows with different non-empty fixed_period values belong to different groups
            # (e.g. same subject but one group at TUE_8-10 and another at THU_8-10)
            fp_conflict = bool(current_fp and prev_fixed_period and current_fp != prev_fixed_period)
            is_sibling = (
                prev_subject_id != '' and
                current_subject_id == prev_subject_id and
                current_subject_name == prev_subject_name and
                not fp_conflict
            )

            if is_sibling:
                # Reuse the existing group_id so all sections share one constraint group
                row_dict['group_id'] = group_id_counter
                # Propagate constraint / room / fixed_period when this row has none
                if _is_empty(row_dict.get('constraint')):
                    row_dict['constraint']   = prev_constraint
                if _is_empty(row_dict.get('room')):
                    row_dict['room']         = prev_raw_room
                if _is_empty(row_dict.get('fixed_period')):
                    row_dict['fixed_period'] = prev_fixed_period
            else:
                # Truly new subject — start a new group and reset carry-forward
                group_id_counter += 1
                row_dict['group_id'] = group_id_counter
                prev_constraint   = str(row_dict.get('constraint',   '')).strip()
                prev_raw_room     = str(row_dict.get('room',         '')).strip()
                prev_fixed_period = str(row_dict.get('fixed_period', '')).strip()

            row_dict['subject_id'] = current_subject_id
            prev_subject_id   = current_subject_id
            prev_subject_name = current_subject_name

        # subject_name: propagate independently (same rule as before)
        if _is_empty(row_dict.get('subject_name')):
            row_dict['subject_name'] = prev_subject_name
        else:
            prev_subject_name = str(row_dict.get('subject_name', '')).strip()

        # B. Clean 'teacher' column
        raw_teacher_name = row_dict.get('teacher')
        row_dict['teacher'] = resolve_teacher_names_to_ids(raw_teacher_name, teacher_lookup)

        # C. Clean 'student_class' column
        raw_section_str = row_dict.get('student_class')
        if pd.isna(raw_section_str) or raw_section_str == '':
            cleaned_sections = current_grade_sections
        else:
            cleaned_sections = parse_student_class_string(raw_section_str)
            valid_sections = [s for s in cleaned_sections if s in current_grade_sections]
            cleaned_sections = valid_sections

        grade_num = current_grade.replace('ม.', '') if current_grade else ''
        row_dict['student_class'] = [f"{grade_num}/{section}" for section in cleaned_sections]

        # D. Clean 'room' column (resolve after propagation so raw value is propagated above)
        row_dict['room'] = resolve_room_to_ids(row_dict.get('room'), room_lookup)

        # E. Clean 'block_pattern' column
        block_pattern = row_dict.get('block_pattern')
        if pd.isna(block_pattern) or str(block_pattern).strip() in ('', 'nan'):
            periods_per_week = row_dict.get('periods_per_week')
            if pd.notna(periods_per_week):
                row_dict['block_pattern'] = str(int(float(periods_per_week)))
            else:
                row_dict['block_pattern'] = '1'
        else:
            row_dict['block_pattern'] = str(block_pattern).strip()

        processed_rows.append(row_dict)

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

    # Drop section marker rows (e.g. "เสรีม.ต้น", "เสรีม.ปลาย") — they have no subject_name
    before = len(df_elective)
    df_elective = df_elective[
        df_elective['subject_name'].apply(
            lambda x: not (pd.isna(x) or str(x).strip() in ('', 'nan', 'None'))
        )
    ].copy()
    dropped = before - len(df_elective)
    if dropped:
        print(f"  - Dropped {dropped} marker row(s) (no subject_name).")

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
    
    # Simply ensure grade is string format (assume CSV already has "ม.1" format).
    # fillna('') first because some pandas versions leave NaN as float in astype(str).
    df_student['grade'] = df_student['grade'].fillna('').astype(str).str.strip()
    
    # Ensure section is numeric
    df_student['section'] = pd.to_numeric(df_student['section'], errors='coerce').fillna(-1).astype(int)
    
    # Validate results
    print(f"✅ Student data cleaned")
    print(f"   Unique grades: {sorted(df_student['grade'].unique())}")
    print(f"   Total students: {len(df_student)}")
    print("--- Student Data Cleaning Complete ---")
    return df_student