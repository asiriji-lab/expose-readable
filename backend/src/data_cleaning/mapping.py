import pandas as pd
from typing import Dict, List, Union, Any, Optional, Set, Tuple
import re
from src.data_cleaning.columns import csv_column_mapping

# helper funciton to create map for room_name / tags -> 'room_id'
def create_room_lookup(df_room: pd.DataFrame):
    """
    Returns (tag_to_rooms, pure_tag_keys).

    tag_to_rooms   : room_id/room_name/tag -> [room_id, ...]
    pure_tag_keys  : lowercase tag strings that came from the 'tags' column only
                     (NOT room IDs or room names).  Callers use this to decide
                     whether a curriculum room reference is a soft tag preference
                     vs. a hard room-ID/name requirement.
    """
    if 'room_id' not in df_room.columns:
        print("🚨 ERROR: Room DataFrame missing 'room_id' column. Skipping lookup creation.")
        return {}, set()

    tag_to_rooms: Dict[str, List[str]] = {}
    pure_tag_keys: set = set()   # only tag-column values (lowercased)
    hard_keys: set = set()       # room IDs and room names (hard constraints)

    df_room = df_room.copy()
    df_room['room_id'] = df_room['room_id'].astype(str).str.strip()
    df_room['room_name'] = df_room['room_name'].fillna('').astype(str).str.strip() if 'room_name' in df_room.columns else ''
    df_room['tags'] = df_room['tags'].fillna('').astype(str).str.strip() if 'tags' in df_room.columns else ''

    _SKIP = {'', 'nan', 'none'}
    _SOFT_EXCLUDE = {'exclude', 'homeroom'}  # tags that are role markers, not subject-type preferences

    for _, row in df_room.iterrows():
        room_id = row['room_id']
        raw_name = str(row.get('room_name', '')).strip()
        raw_tags = str(row.get('tags', '')).strip()

        if not room_id or room_id.lower() in _SKIP:
            continue

        # Room ID is always a hard key
        hard_keys.add(room_id)
        if room_id not in tag_to_rooms:
            tag_to_rooms[room_id] = []
        if room_id not in tag_to_rooms[room_id]:
            tag_to_rooms[room_id].append(room_id)

        # Room name is a hard key (it's an alias for a specific room)
        if raw_name and raw_name.lower() not in _SKIP:
            hard_keys.add(raw_name)
            hard_keys.add(raw_name.lower())
            if raw_name not in tag_to_rooms:
                tag_to_rooms[raw_name] = []
            if room_id not in tag_to_rooms[raw_name]:
                tag_to_rooms[raw_name].append(room_id)

        # Tags are soft keys (subject-type preferences)
        tag_list = [t.strip() for t in raw_tags.split(',') if t.strip() and t.strip().lower() not in _SKIP]
        for t in tag_list:
            t_lower = t.lower()
            if t_lower not in _SOFT_EXCLUDE:
                pure_tag_keys.add(t_lower)
            if t not in tag_to_rooms:
                tag_to_rooms[t] = []
            if room_id not in tag_to_rooms[t]:
                tag_to_rooms[t].append(room_id)

    print(f"✅ Room requirement lookup generated (room_name and tags). Total unique lookup keys: {len(tag_to_rooms)}")
    return tag_to_rooms, pure_tag_keys

# helper funciton to create map for teacher_name -> 'teacher_id'
def create_teacher_lookup(df_teacher: pd.DataFrame) -> dict[str, str]:
    df = df_teacher.copy()
    df['teacher_name'] = df['teacher_name'].astype(str).str.strip()
    df['teacher_id']   = df['teacher_id'].astype(str).str.strip()
    return df.set_index('teacher_name')['teacher_id'].to_dict()

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
    df_preplace = input_data['preplace'].copy()
    df_preplace.columns = df_preplace.columns.astype(str).str.strip()
    df_preplace = df_preplace.rename(columns=preplace_map)
    df_preplace.dropna(subset=['slot_name', 'periods'], inplace=True)
    df_preplace['slot_name'] = df_preplace['slot_name'].astype(str).str.strip()
    df_preplace['periods']   = df_preplace['periods'].astype(str).str.strip()

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
def resolve_room_to_ids(
    raw_room_value: Any,
    room_lookup: Dict[str, List[str]],
    pure_tag_keys: Optional[set] = None,
) -> Union[str, List[str], None]:
    """
    Resolves a curriculum room reference to room ID(s) or preserves tag names.

    When pure_tag_keys is provided:
      - refs that match a pure tag key are returned as-is (lowercased tag name)
        so data_loader can classify them as preferred_tags (soft preference).
      - refs that match a room ID or room name are resolved to room IDs (hard constraint).
    When pure_tag_keys is None, behaviour is unchanged (all resolved to room IDs).
    """
    # Case 1: null, NaN float, empty string, or string 'nan' — no room required
    if pd.isna(raw_room_value) or str(raw_room_value).strip().lower() in ('', 'nan'):
        return None

    req = str(raw_room_value).strip()

    # Split on ',' or '/' (e.g. 'COM, R201' or 'D203 / D204')
    requirements = [
        r.strip() for r in re.split(r'[,/]', req)
        if r.strip() and r.strip().lower() != 'nan'
    ]

    resolved_rooms: List[str] = []

    for single_req in requirements:
        r_lower = single_req.lower()
        # Soft tag: return tag name unchanged so data_loader keeps it as preferred_tags
        if pure_tag_keys is not None and r_lower in pure_tag_keys:
            if r_lower not in resolved_rooms:
                resolved_rooms.append(r_lower)
            continue
        # Hard: room ID or room name → resolve to room ID(s)
        if single_req in room_lookup:
            for rid in room_lookup[single_req]:
                if rid not in resolved_rooms:
                    resolved_rooms.append(rid)
        elif r_lower in room_lookup:
            for rid in room_lookup[r_lower]:
                if rid not in resolved_rooms:
                    resolved_rooms.append(rid)
        else:
            print(f"⚠️ Warning: Unresolved room requirement: '{single_req}'. This requirement will be ignored.")

    if len(resolved_rooms) == 1:
        return resolved_rooms[0]
    elif len(resolved_rooms) > 1:
        return sorted(resolved_rooms)
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