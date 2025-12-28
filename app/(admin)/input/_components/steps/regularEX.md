This is the regular expression for Input CSV file


*Curriculum CSV*

Column,Final Corrected Regex,Logic
subject_id,/^([ก-ฮ]\d{5}|ม\.\d)$/,Matches ท21102 OR ม.1
periods_per_week,/^\d+(\.\d+)?$/,"Matches 3.0, 2, 0.5"
teacher,"/^([TE]\d{3}|\[\s*'([TE]\d{3})'\s*(,\s*'([TE]\d{3})'\s*)*\])$/","Matches T033 OR ['T001', 'T002']"
block_pattern,/^\d(-\d)?$/,"Matches 2, 1-2, 2-1"
student_class,"/^\[\d+(\s*,\s*\d+)*\]$/","Matches [1, 2, 3, 4]"
fixed_period,/^[A-Z]{3}_\d+-[A-Z]{3}_\d+$/,Matches MON_9-MON_10