import pandas as pd
from src.data_cleaning.columns import csv_column_mapping
from typing import Dict
from src.data_cleaning.csv_cleaner import clean_curriculum, clean_elective, clean_teacher, clean_scout, clean_student
from src.data_cleaning.mapping import get_elective_dynamic_mapping
# Renaming columns function
def rename_csv_columns(input_data: Dict[str, pd.DataFrame], csv_column_mapping: Dict[str, Dict[str, str]]) -> Dict[str, pd.DataFrame]:
    # Initialize processed_data by copying ALL input DataFrames
    processed_data = input_data.copy()
    print("\n--- Starting Column Renaming and Pre-processing ---")

    # Pre-calculate the dynamic lookup for electives if required
    elective_slot_lookup = {}
    if 'elective' in csv_column_mapping and 'preplace' in csv_column_mapping:
        # Assuming _get_elective_dynamic_mapping is defined elsewhere and works
        elective_slot_lookup = get_elective_dynamic_mapping(input_data)
        
    # Iterate ONLY over the files we have defined mappings for
    for key, static_mapping in csv_column_mapping.items():
        
        # Check if the file exists in the raw input data
        if key not in input_data:
            # We already started with a copy of input_data, so no action needed 
            # here unless the file is critical and missing (covered in load step).
            print(f"⚠️ Skipping '{key}': Mapping defined but raw DataFrame not available.")
            continue
            
        # Get the DataFrame from the already-copied processed_data dictionary
        # We work on a copy to ensure all original data is preserved
        df_raw = processed_data[key].copy()
        all_raw_cols = df_raw.columns.tolist()
        
        # Determine the FINAL mapping for the current file
        final_mapping = static_mapping.copy()

        # 2. Handle Dynamic Elective Mapping
        if key == 'elective' and elective_slot_lookup:
            static_thai_cols = set(static_mapping.keys())
            
            # Dynamically find the elective slot columns: 
            dynamic_thai_slot_cols = [col for col in all_raw_cols if col not in static_thai_cols]
            
            slots_used_for_mapping = 0 # Counter for debug output
            
            for thai_slot_col in dynamic_thai_slot_cols:
                if thai_slot_col in elective_slot_lookup:
                    final_mapping[thai_slot_col] = elective_slot_lookup[thai_slot_col]
                    slots_used_for_mapping += 1
                else:
                    print(f"  ⚠️ Warning: Elective column '{thai_slot_col}' not found in preplace lookup. Will be removed.")

            print(f"  Elective dynamic mapping completed: {slots_used_for_mapping} slot name(s) were successfully mapped to periods.")

        # 3. Apply Mapping and Filter Columns
        valid_mapping = {
            thai_col: eng_col 
            for thai_col, eng_col in final_mapping.items() 
            if thai_col in all_raw_cols
        }
        # Identify columns to remove
        unmapped_cols = [col for col in all_raw_cols if col not in valid_mapping.keys()]

        try:
            # Select the columns that exist and rename them
            df_processed = df_raw[list(valid_mapping.keys())].rename(columns=valid_mapping)
            
            # 4. Overwrite the entry in processed_data with the cleaned DataFrame
            processed_data[key] = df_processed
            
            print(f"✅ '{key}' processed: {len(df_processed.columns)} columns kept/renamed. {len(unmapped_cols)} removed.")

        except Exception as e:
            print(f"❌ FAILED to process columns for '{key}': {e}")
            
    print("--- Column Renaming Complete ---\n")
    return processed_data

# Minimal empty DataFrames used as stubs when optional files are absent.
# Keys are the English column names (post-rename) so the cleaner functions
# can check .empty and return early without KeyErrors.
_EMPTY_STUBS: dict[str, pd.DataFrame] = {
    'student':    pd.DataFrame(columns=['class_id', 'grade', 'section', 'curriculum']),
    'teacher':    pd.DataFrame(columns=['teacher_id', 'teacher_name', 'available_slots', 'unavailable_slots', 'constraint']),
    'room':       pd.DataFrame(columns=['room_id', 'room_name', 'class_id', 'tags']),
    'elective':   pd.DataFrame(columns=['subject_id', 'subject_name', 'teacher', 'room']),
    'scout':      pd.DataFrame(columns=[]),
}


# main entry for data cleaning
def clean_input_data(input_data: dict[str, pd.DataFrame]):
    processed_output = rename_csv_columns(input_data, csv_column_mapping)

    # Fill in stubs for any optional file that was not supplied so that the
    # individual cleaning functions can call .empty and return early safely.
    for key, stub in _EMPTY_STUBS.items():
        if key not in processed_output:
            processed_output[key] = stub.copy()

    processed_output['student'] = clean_student(processed_output['student'])
    processed_output['teacher'] = clean_teacher(processed_output['teacher'])
    processed_output['curriculum'] = clean_curriculum(processed_output['curriculum'], processed_output['teacher'], processed_output['room'], processed_output['student'])
    processed_output['elective'] = clean_elective(processed_output['elective'], processed_output['teacher'], processed_output['room'])
    processed_output['scout'] = clean_scout(processed_output['scout'], processed_output['teacher'])

    return processed_output