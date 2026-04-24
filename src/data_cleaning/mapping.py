import pandas as pd
from typing import Dict, List, Union, Any
import re
from src.data_cleaning.columns import csv_column_mapping

# helper funciton to create map for room_name / tags -> 'room_id'
def create_room_lookup(df_room: pd.DataFrame) -> Dict[str, List[str]]:
    if 'room_id' not in df_room.columns:
        print("🚨 ERROR: Room DataFrame missing 'room_id' column. Skipping lookup creation.")
        return {}

    tag_to_rooms = {}

    df_room = df_room.copy()
    df_room['room_id'] = df_room['room_id'].astype(str).str.strip()
    df_room['room_name'] = df_room['room_name'].fillna('').astype(str).str.strip() if 'room_name' in df_room.columns else ''
    df_room['tags'] = df_room['tags'].fillna('').astype(str).str.strip() if 'tags' in df_room.columns else ''

    _SKIP = {'', 'nan', 'none'}

    for _, row in df_room.iterrows():
        room_id = row['room_id']
        raw_name = str(row.get('room_name', '')).strip()
        raw_tags = str(row.get('tags', '')).strip()

        if not room_id or room_id.lower() in _SKIP:
            continue

        all_keys = set()

        if raw_name and raw_name.lower() not in _SKIP:
            all_keys.add(raw_name)

        tag_keys = [t.strip() for t in raw_tags.split(',') if t.strip() and t.strip().lower() not in _SKIP]
        all_keys.update(tag_keys)

        if room_id not in tag_to_rooms:
            tag_to_rooms[room_id] = []
        if room_id not in tag_to_rooms[room_id]:
            tag_to_rooms[room_id].append(room_id)

        for key in all_keys:
            if key not in tag_to_rooms:
                tag_to_rooms[key] = []
            if room_id not in tag_to_rooms[key]:
                tag_to_rooms[key].append(room_id)

    print(f"✅ Room requirement lookup generated (room_name and tags). Total unique lookup keys: {len(tag_to_rooms)}")
    return tag_to_rooms

# helper funciton to create map for teacher_name -> 'teacher_id'
def create_teacher_lookup(df_teacher: pd.DataFrame) -> dict[str, str]:
    return df_teacher.set_index('teacher_name')['teacher_id'].to_dict()

# create map for elective slots from 'name' -> 'periods'
def get_elective_dynamic_mapping(input_data: Dict[str, pd.DataFrame]) -> Dict[str, str]:
    """
    Processes the 'preplace' sheet to generate a dynamic mapping for elective slot columns.
    """
    if 'preplace' not in input_data:
        print("🚨 ERROR: 'preplace' DataFrame not found for dynamic elective mapping.")
        return {}

    # Map the preplace columns (using the mapping from csv_column_mapping['preplace'])
    preplace_map = csv_column_mapping.get('preplace', {})
    df_preplace = input_data['preplace'].copy().rename(columns=preplace_map)
    df_preplace.dropna(subset=['slot_name', 'periods'], inplace=True)

    # Create the lookup dictionary: {'เสรีม.ต้น1': 'FRI_2-FRI_3', ...}
    slot_lookup = df_preplace.set_index('slot_name')['periods'].to_dict()
    # print(f"✅ Preplace sheet processed. Found {len(slot_lookup)} dynamic slots for electives.")
    return slot_lookup

# helper function to map teacher_name -> teahcer_id
def resolve_teacher_names_to_ids(raw_teacher_name: Any, teacher_lookup: Dict[str, str]) -> Union[List[str], str, None]:
    if pd.isna(raw_teacher_name) or str(raw_teacher_name).strip() == '':
        return None
    
    valid_ids = []
    unmapped_names = []
    names = [n.strip() for n in str(raw_teacher_name).split(',') if n.strip()]

    for name in names:
        teacher_id = teacher_lookup.get(name, None)
        if teacher_id is not None:
            valid_ids.append(teacher_id)
        else:
            unmapped_names.append(name)
    
    num_valid_ids = len(valid_ids)
    
    if unmapped_names:
        print(f"⚠️ Warning: Teacher name(s) not found in lookup and could not be mapped: {', '.join(unmapped_names)}")
    
    if num_valid_ids == 0:
        print
        return None
    elif num_valid_ids == 1:
        return valid_ids[0]
    else:
        return valid_ids

# helper function map room requirements -> room_ids
def resolve_room_to_ids(raw_room_value: Any, room_lookup: Dict[str, List[str]]) -> Union[str, List[str], None]:
    # Case 1: If null/NaN, return None (no room required)
    if pd.isna(raw_room_value) or str(raw_room_value).strip() == '':
        return None

    req = str(raw_room_value).strip()
    
    # Handle multiple requirements (e.g., 'COM, R201')
    requirements = [r.strip() for r in req.split(',') if r.strip()]
    
    resolved_rooms = set()
    
    for single_req in requirements:
        # Check if the requirement (Tag or ID) is in the lookup keys
        if single_req in room_lookup:
            resolved_rooms.update(room_lookup[single_req])
        else:
            # Issue a warning if the requirement cannot be resolved
            print(f"⚠️ Warning: Unresolved room requirement: '{single_req}'. This requirement will be ignored.")

    if len(resolved_rooms) == 1:
        return resolved_rooms.pop()
    elif len(resolved_rooms) > 1:
        return sorted(str(r) for r in resolved_rooms)
    else:
        return None

# helper functiont to get lists of student section for each grade key 
def get_grade_sections(df_student: pd.DataFrame) -> Dict[str, List[int]]:
    """
    Extract grade-to-sections mapping from student data.
    Now works with standardized 'ม.X' format without modifying the original DataFrame.
    """
    section_map = {}
    
    # Work with a COPY to avoid modifying the original DataFrame
    df_copy = df_student.copy()
    
    # Extract numeric grade from standardized format "ม.X" -> X
    def extract_grade_num(grade_val):
        """Extract numeric part from 'ม.1' -> 1"""
        if pd.isna(grade_val):
            return -1
        grade_str = str(grade_val)
        match = re.search(r'(\d+)', grade_str)
        if match:
            return int(match.group(1))
        return -1
    
    df_copy['grade_num'] = df_copy['grade'].apply(extract_grade_num)
    
    # Ensure section is numeric
    df_copy['section'] = pd.to_numeric(df_copy['section'], errors='coerce').fillna(-1).astype(int)
    
    # Group by grade_num and find unique sections
    valid_students = df_copy[(df_copy['grade_num'] > 0) & (df_copy['section'] > 0)]
    grouped = valid_students.groupby('grade_num')['section'].unique()
    
    for grade_num, sections in grouped.items():
        formatted_grade = f"ม.{grade_num}"
        # Convert NumPy array of sections to a sorted list of integers
        section_map[formatted_grade] = sorted(int(s) for s in sections)
        
    print(f"✅ Generated Grade Section Map: {section_map}")
    return section_map

# helper function to parse specific format of 'student_class' in curriculum sheet
def parse_student_class_string(section_str: str) -> List[int]:
    """
    Parses a string like "/1, /3-5" into a list of section integers [1, 3, 4, 5].
    """
    if pd.isna(section_str) or not section_str:
        return []

    # Split by comma
    elements = [e.strip() for e in section_str.replace(' ', '').split(',') if e.strip()]
    
    final_sections = set()
    
    for element in elements:
        # Check for range pattern (Rule 3): /<start>-<end>
        range_match = re.match(r'^/(\d+)-(\d+)$', element)
        if range_match:
            start = int(range_match.group(1))
            end = int(range_match.group(2))
            # Add all sections in the range [start, end]
            final_sections.update(range(start, end + 1))
            continue
            
        # Check for specific section pattern (Rule 2): /<section>
        specific_match = re.match(r'^/(\d+)$', element)
        if specific_match:
            final_sections.add(int(specific_match.group(1)))
            continue
            
        # Optional: Log elements that don't match expected formats
        print(f"Warning: Unrecognized section format: {element}")
        
    return sorted(list(final_sections))
# list of all expected files name
expected_file = [
    "curriculum.csv", "elective.csv", "teacher.csv", 
    "period.csv", "preplace.csv", "room.csv", 
    "student.csv", "scout.csv"
]