curriculum_column = {
    'รหัสวิชา': 'subject_id',
    'ชื่อวิชา': 'subject_name',
    'คาบ/สัปดาห์': 'periods_per_week',
    'ครู': 'teacher',
    'การแบ่งคาบสอน': 'block_pattern',
    'ห้อง (นักเรียน) ที่สอน': 'student_class',
    'หมายเหตุ': 'constraint',
    'ห้องเรียน': 'room',
    'คาบเรียน': 'fixed_period'
}

elective_static_column = {
    'รหัสวิชา': 'subject_id',
    'ชื่อวิชา (เสรี)': 'subject_name',
    'ครูผู้สอน': 'teacher',
    'ห้องเรียน': 'room'
}

teacher_column = {
    'teacher_id': 'teacher_id',
    'ชื่อ': 'teacher_name',
    'available_slots': 'available_slots',
    'unavailable_slots': 'unavailable_slots',
    'หมายเหตุ': 'constraint'
}

period_column = {
    'คาบ': 'period_label',
    'เวลา': 'period_time'
}

prepalce_column = {
    'ชื่อ': 'slot_name',
    'คาบ': 'periods',
    'apply_to': 'apply_to'
}

room_column = {
    'ห้องทั้งหมด': 'room_id',
    'room_id': 'room_id',       # already-English header in some datasets
    'หมายเหตุ': 'note',
    'ประเภท': 'tag'
}

student_column = {
    'นักเรียน': 'class_id',
    'ชั้น': 'grade',
    'ห้อง': 'section',
    'ห้องประจำ': 'default_room',
    'หลักสูตร': 'curriculum'
}

# Consolidate all file definitions and their mappings for the pre-processing function
csv_column_mapping = {
    'curriculum': curriculum_column,
    'elective': elective_static_column,
    'teacher': teacher_column,
    'period': period_column,
    'preplace': prepalce_column,
    'room': room_column,
    'student': student_column
}