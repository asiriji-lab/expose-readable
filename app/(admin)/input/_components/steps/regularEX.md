# CSV Validation Regex Patterns

This document contains the Regular Expression patterns derived from the example CSV files in `public/example_csv`. Use these patterns to validate user uploads.

## 1. Curriculum Data (`example_curriculum.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `subject_id` | `^([ก-ฮ]\d{5}|ม\.\d)$` | Thai letter + 5 digits (e.g., ท21102) OR Grade Header (e.g., ม.1) |
| 1 | `subject_name` | `^.+$` | Any non-empty string |
| 2 | `periods_per_week` | `^\d+(\.\d+)?$` | Number (integer or float, e.g., 3.0) |
| 3 | `teacher` | `^([TE]\d{3}|\[\s*'([TE]\d{3})'\s*(,\s*'([TE]\d{3})'\s*)*\])$` | Teacher ID (T/E + 3 digits) or List of IDs |
| 4 | `block_pattern` | `^\d(-\d)?$` | Single digit or range (e.g., 1, 2-1) |
| 5 | `student_class` | `^\[\d+(\s*,\s*\d+)*\]$` | List of numbers in brackets (e.g., [1, 2]) |
| 7 | `room` | `^([A-Z0-9-]+|\[\s*'[^']+'\s*(,\s*'[^']+'\s*)*\]|[^,]+)$` | Room ID, List of Rooms, or Text |
| 8 | `fixed_period` | `^([A-Z]{3}_\d+(-[A-Z]{3}_\d+)?(,\s*)?)*$` | Period format (e.g., MON_1-MON_2) |

## 2. Teacher Data (`teacher_cleaned.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `teacher_id` | `^[TE]\d{3}$` | T or E followed by 3 digits (e.g., T001) |
| 1 | `teacher_name` | `^.+$` | Any non-empty string |
| 3 | `unavailable_slots` | `^([A-Z]{3}_\d+(-[A-Z]{3}_\d+)?(,\s*)?)*$` | Slot format (e.g., MON_6-MON_8) |

## 3. Student Data (`student_cleaned.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `class_id` | `^\d/\d$` | Class format (e.g., 1/1) |
| 1 | `grade` | `^ม\.\d$` | Grade format (e.g., ม.1) |
| 2 | `section` | `^\d+$` | Section number |
| 3 | `default_room` | `^[A-Z0-9-]+$` | Room ID |

## 4. Room Data (`room_cleaned.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `room_id` | `^.+$` | Room ID or Name |

## 5. Period Data (`period_cleaned.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `period_label` | `^(\d+|.+)$` | Digit or Text Label |
| 1 | `period_time` | `^(\d{2}\.\d{2}-\d{2}\.\d{2}|\d+)$` | Time range (08.05-08.55) or Duration (10) |

## 6. Elective Data (`elective_cleaned.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 0 | `subject_id` | `^[ก-ฮ]\d{5}$` | Thai letter + 5 digits |
| 2 | `teacher` | `^[TE]\d{3}$` | Teacher ID |
| 4+ | `SLOTS` | `^(1\.0)?$` | 1.0 or empty |

## 7. Constraint Data (`example_constraint.csv`)

| Column | Header | Pattern | Description |
| :--- | :--- | :--- | :--- |
| 1 | `periods` | `^([A-Za-z]+_\d+(-[A-Za-z]+_\d+)?)$` | Period format (e.g., Everyday_1, MON_10) |
| 2 | `apply_to` | `^(All|ม\.\d(,\s*ม\.\d)*)$` | 'All' or list of grades |