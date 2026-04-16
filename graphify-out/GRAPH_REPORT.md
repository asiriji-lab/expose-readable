# Graph Report - .  (2026-04-16)

## Corpus Check
- Large corpus: 205 files · ~108,905 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 724 nodes · 1400 edges · 35 communities detected
- Extraction: 57% EXTRACTED · 43% INFERRED · 0% AMBIGUOUS · INFERRED: 597 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `ScheduleManager` - 80 edges
2. `Chromosome` - 59 edges
3. `Lesson` - 57 edges
4. `JobManager` - 44 edges
5. `GeneticAlgorithm` - 42 edges
6. `ScheduleJsonExporter` - 34 edges
7. `TimeSlot` - 34 edges
8. `PrescheduleProcessor` - 30 edges
9. `IslandGeneticAlgorithm` - 26 edges
10. `FeasibilityChecker` - 24 edges

## Surprising Connections (you probably didn't know these)
- `================================================================================` --uses--> `Config`  [INFERRED]
  temp_backend_for_example\backend\app.py → temp_backend_for_example\backend\config.py
- `Application factory for creating Flask app instances.` --uses--> `Config`  [INFERRED]
  temp_backend_for_example\backend\app.py → temp_backend_for_example\backend\config.py
- `================================================================================` --uses--> `ScheduleJsonExporter`  [INFERRED]
  temp_backend_for_example\backend\main.py → temp_backend_for_example\backend\src\ga\json_exporter.py
- `Load each CSV file path into a DataFrame dict. Missing files are skipped.` --uses--> `ScheduleJsonExporter`  [INFERRED]
  temp_backend_for_example\backend\main.py → temp_backend_for_example\backend\src\ga\json_exporter.py
- `Write each cleaned DataFrame to CSV.` --uses--> `ScheduleJsonExporter`  [INFERRED]
  temp_backend_for_example\backend\main.py → temp_backend_for_example\backend\src\ga\json_exporter.py

## Communities

### Community 0 - "BandHoverTooltip.tsx & BandHov"
Cohesion: 0.03
Nodes (22): generateFullScheduleDataset(), getClassSchedule(), getFullDataset(), getRoomSchedule(), getTeacherSchedule(), FilterChip(), getEntityDisplayName(), computeBandStatus() (+14 more)

### Community 1 - "data_loader.py & build_blocked"
Cohesion: 0.06
Nodes (64): build_blocked_keywords(), build_free_slots_per_entity(), build_lessons_from_manager(), _cell_is_blocked(), get_occupied_slots(), get_teaching_period_cols(), _parse_block_pattern(), _parse_constraint_type() (+56 more)

### Community 2 - "ScheduleExporter & ._create_em"
Cohesion: 0.05
Nodes (49): ScheduleExporter, FeasibilityChecker, Pre-flight feasibility checker for the GA scheduler.      Reuses the same data, IslandGeneticAlgorithm, Island (Distributed) Genetic Algorithm for school timetable scheduling.      S, Delegate to the best island's GeneticAlgorithm.apply_solution()., export_cleaned_data(), export_grids() (+41 more)

### Community 3 - "database.py & close_all()"
Cohesion: 0.05
Nodes (65): close_all(), init_db(), is_available(), ================================================================================, Bind the SQLAlchemy extension to *app*, then create all tables that do not, Return True if the ORM was successfully initialised., No-op — Flask-SQLAlchemy manages the underlying connection pool     automatical, APIError (+57 more)

### Community 4 - "badge.tsx & Badge()"
Cohesion: 0.04
Nodes (2): fuzzyMatch(), levenshtein()

### Community 5 - "JobManager & .add_file_to_job("
Cohesion: 0.05
Nodes (54): JobManager, Add file reference to job., Remove jobs older than specified days., Manages scheduling jobs., Create a new job record., auth_login(), auth_logout(), auth_me() (+46 more)

### Community 6 - "actions.ts & detectRoleAction("
Cohesion: 0.08
Nodes (7): detectRoleAction(), loginWithUsernameOrEmail(), normalizeRole(), normalizeRole(), proxy(), handleSubmit(), verifyOtpCode()

### Community 7 - "csvHelpers.ts & extractSheetId"
Cohesion: 0.12
Nodes (13): fetchPublicSheetTab(), parseCSVText(), addWorkloadEntry(), expandClassCodes(), parseClassSections(), parseCSVLine(), parseCurriculumCSV(), parseCurriculumRows() (+5 more)

### Community 8 - ".check() & ._check_block_struc"
Cohesion: 0.16
Nodes (7): FeasibilityIssue, FeasibilityReport, Sums required periods per teacher / student class / room and compares         a, Checks that the intersection of teacher + student class free slots         has, For each multi-period block (size >= 2), verifies that at least one         day, _assign_blocks places each block on a different day. So a lesson with         N, Run all checks and return a FeasibilityReport.

### Community 9 - "ScheduleJsonExporter & ._build"
Cohesion: 0.26
Nodes (1): ScheduleJsonExporter

### Community 10 - "scheduleLogic.ts & autoEjectCo"
Cohesion: 0.25
Nodes (11): autoEjectConflicts(), cloneEntityMap(), deleteSlot(), findConflictsAtSlot(), hasConflict(), isSameLesson(), moveItem(), placeItemInDataset() (+3 more)

### Community 11 - "app.py & create_app()"
Cohesion: 0.18
Nodes (12): create_app(), ================================================================================, Application factory for creating Flask app instances., Config, DevelopmentConfig, ProductionConfig, ================================================================================, Base configuration class. (+4 more)

### Community 12 - "file_helpers.py & allowed_file"
Cohesion: 0.14
Nodes (13): allowed_file(), create_zip_archive(), ensure_directory(), get_file_size(), get_job_folder(), list_csv_files(), ================================================================================, Check if file extension is allowed. (+5 more)

### Community 13 - "logger.py & create_job_logger("
Cohesion: 0.24
Nodes (7): create_job_logger(), _DailyFileHandler, init_api_logger(), ================================================================================, Create a fresh structured logger for a single scheduling job.      The log fil, Writes to <logs_dir>/api_YYYY-MM-DD.log.      On every emit, checks whether th, Initialise (or return the existing) API request logger.      Writes to  <logs_

### Community 14 - "mapping.py & create_room_looku"
Cohesion: 0.18
Nodes (6): get_elective_dynamic_mapping(), get_grade_sections(), parse_student_class_string(), Extract grade-to-sections mapping from student data.     Now works with standar, Parses a string like "/1, /3-5" into a list of section integers [1, 3, 4, 5]., Processes the 'preplace' sheet to generate a dynamic mapping for elective slot c

### Community 15 - "select.tsx & SelectContent()"
Cohesion: 0.22
Nodes (0): 

### Community 16 - "api.ts & scheduleApi.ts"
Cohesion: 0.28
Nodes (0): 

### Community 17 - "validators.py & =============="
Cohesion: 0.25
Nodes (7): ================================================================================, Validate timetable CSV file format.          Timetables should have:     - Da, Validate curriculum CSV file format.          Expected columns:     - subject, Validate rooms CSV file format.          Expected columns:     - room_id (req, validate_curriculum(), validate_rooms(), validate_timetable()

### Community 18 - "CsvEditor.tsx & getSheetData()"
Cohesion: 0.47
Nodes (3): getSheetData(), handleDownload(), handleSave()

### Community 19 - "csv_cleaner.py & clean_curricu"
Cohesion: 0.33
Nodes (0): 

### Community 20 - "data_cleaning.py & clean_input"
Cohesion: 1.0
Nodes (2): clean_input_data(), rename_csv_columns()

### Community 21 - "Genetic Algorithm Engine & RES"
Cohesion: 0.67
Nodes (3): Genetic Algorithm Engine, REST API, Schedool Backend System

### Community 22 - "error.tsx & Error()"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "validation.ts & validateEmail("
Cohesion: 1.0
Nodes (0): 

### Community 24 - "get_otp.ts & testSignup()"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Schedool Code Review Report & "
Cohesion: 1.0
Nodes (2): Schedool Code Review Report, Schedool Remediation Execution Tracker

### Community 26 - "View All Mode - Master Grid wi"
Cohesion: 1.0
Nodes (2): View All Mode - Master Grid with 3 Bands, Schedule Page Redesign - 3-Band Availability View

### Community 27 - "Next.js Logo & Book Open Icon "
Cohesion: 1.0
Nodes (2): Next.js Logo, Book Open Icon Active State

### Community 28 - "next-env.d.ts"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "next.config.ts"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "EmptyScheduleState.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "ScheduleListSkeleton.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "chunks_processor.py"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "columns.py"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "File Document Icon"
Cohesion: 1.0
Nodes (1): File Document Icon

## Knowledge Gaps
- **52 isolated node(s):** `================================================================================`, `Base configuration class.`, `Development configuration.`, `Production configuration.`, `Testing configuration.` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `error.tsx & Error()`** (2 nodes): `error.tsx`, `Error()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `validation.ts & validateEmail(`** (2 nodes): `validation.ts`, `validateEmail()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `get_otp.ts & testSignup()`** (2 nodes): `get_otp.ts`, `testSignup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Schedool Code Review Report & `** (2 nodes): `Schedool Code Review Report`, `Schedool Remediation Execution Tracker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `View All Mode - Master Grid wi`** (2 nodes): `View All Mode - Master Grid with 3 Bands`, `Schedule Page Redesign - 3-Band Availability View`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Logo & Book Open Icon `** (2 nodes): `Next.js Logo`, `Book Open Icon Active State`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `next-env.d.ts`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `next.config.ts`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `EmptyScheduleState.tsx`** (1 nodes): `EmptyScheduleState.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ScheduleListSkeleton.tsx`** (1 nodes): `ScheduleListSkeleton.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `chunks_processor.py`** (1 nodes): `chunks_processor.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `columns.py`** (1 nodes): `columns.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Document Icon`** (1 nodes): `File Document Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PeriodItemData` connect `ScheduleExporter & ._create_em` to `badge.tsx & Badge()`?**
  _High betweenness centrality (0.396) - this node is a cross-community bridge._
- **Why does `ScheduleManager` connect `ScheduleExporter & ._create_em` to `.check() & ._check_block_struc`, `data_loader.py & build_blocked`, `database.py & close_all()`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Why does `JobManager` connect `JobManager & .add_file_to_job(` to `data_loader.py & build_blocked`, `ScheduleExporter & ._create_em`, `database.py & close_all()`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 72 inferred relationships involving `ScheduleManager` (e.g. with `================================================================================` and `Load each CSV file path into a DataFrame dict. Missing files are skipped.`) actually correct?**
  _`ScheduleManager` has 72 INFERRED edges - model-reasoned connections that need verification._
- **Are the 57 inferred relationships involving `Chromosome` (e.g. with `.copy()` and `Quick test script to verify the integration works. This checks if all imports a`) actually correct?**
  _`Chromosome` has 57 INFERRED edges - model-reasoned connections that need verification._
- **Are the 56 inferred relationships involving `Lesson` (e.g. with `Quick test script to verify the integration works. This checks if all imports a` and `================================================================================`) actually correct?**
  _`Lesson` has 56 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `JobManager` (e.g. with `================================================================================` and `Run a scheduling job inside a background thread with its own app context.`) actually correct?**
  _`JobManager` has 31 INFERRED edges - model-reasoned connections that need verification._