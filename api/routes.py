"""
================================================================================
GA SCHEDULER FLASK API - Routes
================================================================================

API endpoints for the scheduling system.
"""

import os
import uuid
import json
import shutil
import threading
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename

from src.ga.scheduler import run_scheduler_job
from src.ga.job_manager import JobManager
from src.utils.validators import validate_curriculum, validate_rooms, validate_timetable
from src.utils.file_helpers import allowed_file, get_job_folder, create_zip_archive


api_bp = Blueprint('api', __name__, url_prefix='/api/v1')


# =============================================================================
# BACKGROUND JOB RUNNER
# =============================================================================

def _run_job_background(app, job_id, job_folder, params, academic_year, semester):
    """Run a scheduling job inside a background thread with its own app context."""
    with app.app_context():
        job_manager = JobManager(app.config['JOBS_FOLDER'])
        try:
            run_scheduler_job(
                job_id=job_id,
                job_folder=job_folder,
                params=params,
                job_manager=job_manager,
                academic_year=academic_year,
                semester=semester,
            )
        except Exception as e:
            job_manager.update_job_status(job_id, 'failed', error=str(e))


# =============================================================================
# SINGLE SUBMIT ENDPOINT
# =============================================================================

@api_bp.route('/schedule', methods=['POST'])
def submit_schedule():
    """
    Submit a complete scheduling job in one request.
    ---
    tags:
      - Scheduling
    summary: Submit a scheduling job (preferred entry point)
    description: >
      Upload all input files and optional parameters in a single multipart
      request. The job runs in the background — poll GET /api/v1/schedule/{job_id}
      for status. The pipeline mirrors main.py exactly.
      curriculum.csv and room.csv are required; the other six are strongly
      recommended for correct results.
    consumes:
      - multipart/form-data
    parameters:
      - name: curriculum
        in: formData
        type: file
        required: true
        description: "Curriculum CSV (Thai headers: รหัสวิชา, คาบ/สัปดาห์, ครู, ห้อง (นักเรียน) ที่สอน, ...)"
      - name: room
        in: formData
        type: file
        required: true
        description: "Room list CSV (Thai header: ห้องทั้งหมด)"
      - name: elective
        in: formData
        type: file
        required: false
        description: Elective course CSV
      - name: teacher
        in: formData
        type: file
        required: false
        description: Teacher availability CSV
      - name: period
        in: formData
        type: file
        required: false
        description: Period definition CSV
      - name: preplace
        in: formData
        type: file
        required: false
        description: Pre-placed slot CSV
      - name: student
        in: formData
        type: file
        required: false
        description: Student class list CSV
      - name: scout
        in: formData
        type: file
        required: false
        description: Scout session CSV
      - name: job_name
        in: formData
        type: string
        required: false
        description: Human-readable label for this job
      - name: academic_year
        in: formData
        type: string
        required: false
        description: Academic year written into the JSON output e.g. 2026
      - name: semester
        in: formData
        type: integer
        required: false
        default: 1
        description: Semester number written into the JSON output
      - name: ga_params
        in: formData
        type: string
        required: false
        description: >
          Optional JSON string overriding Island GA defaults.
          Keys: n_islands, island_population_size, max_generations,
          migration_interval, migration_rate, topology, mutation_rate,
          crossover_rate, tournament_size, elite_size, stagnation_limit,
          catastrophic_after. Set n_islands=1 to use the standard GA instead.
    responses:
      202:
        description: Job accepted and running in background
        schema:
          type: object
          properties:
            success:      {type: boolean, example: true}
            job_id:       {type: string}
            job_name:     {type: string}
            message:      {type: string}
            status_url:   {type: string}
            result_url:   {type: string}
            download_url: {type: string}
      400:
        description: Missing required file or unreadable CSV
    """
    # ── Required files ────────────────────────────────────────────────────────
    _REQUIRED = ['curriculum', 'room']
    for name in _REQUIRED:
        if name not in request.files or request.files[name].filename == '':
            return jsonify({"success": False, "error": f"'{name}.csv' is required"}), 400

    # ── Parse form parameters ─────────────────────────────────────────────────
    job_name      = request.form.get('job_name', '').strip()
    academic_year = request.form.get('academic_year', '')
    try:
        semester = int(request.form.get('semester', 1))
    except (ValueError, TypeError):
        semester = 1
    try:
        ga_params = json.loads(request.form.get('ga_params', '{}'))
    except (json.JSONDecodeError, TypeError):
        ga_params = {}

    # ── Create job ────────────────────────────────────────────────────────────
    job_id = str(uuid.uuid4())
    if not job_name:
        job_name = f'Schedule Job {job_id[:8]}'

    # Pass all ga_params through; scheduler merges with Island GA defaults
    params = {**ga_params, 'academic_year': academic_year, 'semester': semester}

    job_folder     = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    uploads_folder = os.path.join(job_folder, 'uploads')
    os.makedirs(uploads_folder, exist_ok=True)
    os.makedirs(os.path.join(job_folder, 'outputs'), exist_ok=True)

    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job_manager.create_job(job_id, job_name, params)

    # ── Save all uploaded files with canonical names ───────────────────────────
    # The canonical names match input_dataset/ so the cleaning pipeline can find them.
    _FILE_KEYS = ['curriculum', 'elective', 'teacher', 'period',
                  'preplace', 'room', 'student', 'scout']
    for key in _FILE_KEYS:
        fobj = request.files.get(key)
        if not fobj or fobj.filename == '':
            continue
        if not allowed_file(fobj.filename, current_app.config['ALLOWED_EXTENSIONS']):
            shutil.rmtree(job_folder, ignore_errors=True)
            job_manager.delete_job(job_id)
            return jsonify({"success": False,
                            "error": f"'{key}' must be a CSV file"}), 400
        dest = os.path.join(uploads_folder, f'{key}.csv')
        fobj.save(dest)
        # Basic readability check
        try:
            import pandas as _pd
            _pd.read_csv(dest, nrows=1)
        except Exception as exc:
            shutil.rmtree(job_folder, ignore_errors=True)
            job_manager.delete_job(job_id)
            return jsonify({"success": False,
                            "error": f"Could not read '{key}.csv': {exc}"}), 400
        job_manager.add_file_to_job(job_id, key, dest)

    # ── Launch background thread ──────────────────────────────────────────────
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_run_job_background,
        args=(app, job_id, job_folder, params, academic_year, semester),
        daemon=True,
    )
    thread.start()

    return jsonify({
        "success":      True,
        "job_id":       job_id,
        "job_name":     job_name,
        "message":      "Job queued and running. Poll the status endpoint for updates.",
        "status_url":   f"/api/v1/schedule/{job_id}",
        "result_url":   f"/api/v1/schedule/{job_id}/result",
        "download_url": f"/api/v1/schedule/{job_id}/download",
    }), 202


# =============================================================================
# JOB MANAGEMENT ENDPOINTS
# =============================================================================

@api_bp.route('/jobs', methods=['GET'])
def list_jobs():
    """
    List all scheduling jobs.
    ---
    tags:
      - Scheduling
    responses:
      200:
        description: Array of job objects
        schema:
          type: object
          properties:
            success: {type: boolean}
            count:   {type: integer}
            jobs:    {type: array, items: {type: object}}
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    jobs = job_manager.list_jobs()
    
    return jsonify({
        "success": True,
        "count": len(jobs),
        "jobs": jobs
    })


@api_bp.route('/schedule/create', methods=['POST'])
def create_schedule():
    """
    (Legacy) Create a scheduling job without files.
    ---
    tags:
      - Scheduling
    summary: "(Legacy) Create job — then upload files and call /start separately"
    description: >
      Prefer **POST /api/v1/schedule** for a single-request workflow.
      This endpoint only creates the job record; you must separately upload
      files and call POST /api/v1/schedule/{job_id}/start.
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            job_name:      {type: string,  example: "My Schedule"}
            academic_year: {type: string,  example: "2026"}
            semester:      {type: integer, example: 1}
            ga_params:
              type: object
              properties:
                population_size: {type: integer, example: 150}
                max_generations: {type: integer, example: 500}
                mutation_rate:   {type: number,  example: 0.20}
                crossover_rate:  {type: number,  example: 0.80}
                elite_size:      {type: integer, example: 10}
                tournament_size: {type: integer, example: 7}
    responses:
      201:
        description: Job created
        schema:
          type: object
          properties:
            success:  {type: boolean}
            job_id:   {type: string}
            job_name: {type: string}
            message:  {type: string}
    """
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Get job parameters from request
    data = request.get_json() or {}
    job_name = data.get('job_name', f'Schedule Job {job_id[:8]}')
    
    # GA parameters (use defaults if not provided)
    ga_params = data.get('ga_params', {})
    params = {
        'population_size': ga_params.get('population_size', current_app.config['GA_POPULATION_SIZE']),
        'max_generations': ga_params.get('max_generations', current_app.config['GA_MAX_GENERATIONS']),
        'mutation_rate': ga_params.get('mutation_rate', current_app.config['GA_MUTATION_RATE']),
        'crossover_rate': ga_params.get('crossover_rate', current_app.config['GA_CROSSOVER_RATE']),
        'elite_size': ga_params.get('elite_size', current_app.config['GA_ELITE_SIZE']),
        'tournament_size': ga_params.get('tournament_size', current_app.config['GA_TOURNAMENT_SIZE']),
        'academic_year': str(data.get('academic_year', '')),
        'semester': int(data.get('semester', 1)),
    }
    
    # Create job folder
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    os.makedirs(job_folder, exist_ok=True)
    os.makedirs(os.path.join(job_folder, 'uploads'), exist_ok=True)
    os.makedirs(os.path.join(job_folder, 'outputs'), exist_ok=True)
    
    # Initialize job manager and create job record
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job_manager.create_job(job_id, job_name, params)
    
    return jsonify({
        "success": True,
        "job_id": job_id,
        "job_name": job_name,
        "message": "Job created successfully. Upload files and then start the job.",
        "next_steps": {
            "1": "POST /api/v1/curriculum/upload with curriculum CSV",
            "2": "POST /api/v1/rooms/upload with rooms CSV",
            "3": "POST /api/v1/timetables/upload with existing timetable CSVs (optional)",
            "4": "POST /api/v1/schedule/<job_id>/start to begin scheduling"
        }
    }), 201


@api_bp.route('/schedule/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """
    Get the status and progress of a scheduling job.
    ---
    tags:
      - Scheduling
    parameters:
      - name: job_id
        in: path
        type: string
        required: true
        description: Job UUID returned by POST /api/v1/schedule
    responses:
      200:
        description: Job status and progress (no result payload — use GET /api/v1/schedule/{job_id}/result for that)
        schema:
          type: object
          properties:
            success: {type: boolean}
            job_id:           {type: string}
            job_name:         {type: string}
            status:           {type: string, enum: [created, loading_data, running_ga, exporting, completed, failed]}
            progress:         {type: number, description: "0–100"}
            progress_details: {type: object}
            error:            {type: string}
            created_at:       {type: string}
            updated_at:       {type: string}
      404:
        description: Job not found
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)

    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404

    return jsonify({
        "success":          True,
        "job_id":           job['job_id'],
        "job_name":         job['job_name'],
        "status":           job['status'],
        "progress":         job['progress'],
        "progress_details": job['progress_details'],
        "error":            job.get('error'),
        "created_at":       job['created_at'],
        "updated_at":       job['updated_at'],
    })


@api_bp.route('/schedule/<job_id>/result', methods=['GET'])
def get_job_result(job_id):
    """
    Get the result JSON of a completed scheduling job.
    ---
    tags:
      - Scheduling
    parameters:
      - name: job_id
        in: path
        type: string
        required: true
        description: Job UUID returned by POST /api/v1/schedule
    responses:
      200:
        description: Full schedule result JSON
        schema:
          type: object
          properties:
            success: {type: boolean}
            job_id:  {type: string}
            result:  {type: object}
      400:
        description: Job not yet completed
      404:
        description: Job not found
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)

    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404

    if job['status'] != 'completed':
        return jsonify({
            "success": False,
            "error": f"Result not available. Current status: {job['status']}"
        }), 400

    return jsonify({
        "success": True,
        "job_id":  job['job_id'],
        "result":  job.get('result'),
    })


@api_bp.route('/schedule/<job_id>/start', methods=['POST'])
def start_job(job_id):
    """
    (Legacy) Start a previously created job synchronously.
    ---
    tags:
      - Scheduling
    summary: "(Legacy) Start job — blocks until scheduling completes"
    description: >
      Prefer **POST /api/v1/schedule** which runs asynchronously.
      This endpoint blocks the HTTP connection for the full duration of the GA.
    parameters:
      - name: job_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Scheduling completed; full schedule JSON returned in response
        schema:
          type: object
          properties:
            success:  {type: boolean}
            message:  {type: string}
            result:   {type: object}
            schedule: {type: object, description: "Full schedule JSON"}
      400:
        description: Missing files or invalid job state
      404:
        description: Job not found
      500:
        description: Scheduling failed
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)
    
    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    if job['status'] not in ['created', 'failed']:
        return jsonify({
            "success": False,
            "error": f"Job cannot be started. Current status: {job['status']}"
        }), 400
    
    # Check required files
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    uploads_folder = os.path.join(job_folder, 'uploads')
    
    curriculum_file = os.path.join(uploads_folder, 'curriculum.csv')
    rooms_file = os.path.join(uploads_folder, 'rooms.csv')
    
    if not os.path.exists(curriculum_file):
        return jsonify({
            "success": False,
            "error": "Curriculum file not uploaded. POST to /api/v1/curriculum/upload first."
        }), 400
    
    if not os.path.exists(rooms_file):
        return jsonify({
            "success": False,
            "error": "Rooms file not uploaded. POST to /api/v1/rooms/upload first."
        }), 400
    
    # Update job status
    job_manager.update_job_status(job_id, 'running')
    
    # Run scheduler (in a real production app, this would be async/background task)
    try:
        result = run_scheduler_job(
            job_id=job_id,
            job_folder=job_folder,
            params=job['params'],
            job_manager=job_manager,
            academic_year=job['params'].get('academic_year', ''),
            semester=job['params'].get('semester', 1),
        )

        response = {
            "success": True,
            "message": "Scheduling completed",
            "result": {
                "job_id":        result.get('job_id'),
                "data_stats":    result.get('data_stats'),
                "ga_result":     result.get('ga_result'),
                "export_result": result.get('export_result'),
            },
            "schedule": result.get('schedule_json'),
        }
        return jsonify(response)
        
    except Exception as e:
        job_manager.update_job_status(job_id, 'failed', error=str(e))
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_bp.route('/schedule/<job_id>/download', methods=['GET'])
def download_results(job_id):
    """
    Download completed schedules as a ZIP archive.
    ---
    tags:
      - Scheduling
    parameters:
      - name: job_id
        in: path
        type: string
        required: true
    produces:
      - application/zip
    responses:
      200:
        description: ZIP file containing teacher/student/room CSVs and schedule.json
      400:
        description: Job not yet completed
      404:
        description: Job not found
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)
    
    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    if job['status'] != 'completed':
        return jsonify({
            "success": False,
            "error": f"Job not completed. Current status: {job['status']}"
        }), 400
    
    # Create ZIP archive
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    outputs_folder = os.path.join(job_folder, 'outputs')
    zip_path = os.path.join(job_folder, f'schedules_{job_id}.zip')
    
    create_zip_archive(outputs_folder, zip_path)
    
    return send_file(
        zip_path,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'schedules_{job_id}.zip'
    )


@api_bp.route('/schedule/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    """
    Delete a scheduling job and all its files.
    ---
    tags:
      - Scheduling
    parameters:
      - name: job_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Job deleted
        schema:
          type: object
          properties:
            success: {type: boolean}
            message: {type: string}
      404:
        description: Job not found
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)
    
    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    # Delete job folder
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    if os.path.exists(job_folder):
        shutil.rmtree(job_folder)
    
    # Delete job record
    job_manager.delete_job(job_id)
    
    return jsonify({
        "success": True,
        "message": f"Job {job_id} deleted successfully"
    })


# =============================================================================
# FILE UPLOAD ENDPOINTS
# =============================================================================

@api_bp.route('/curriculum/upload', methods=['POST'])
def upload_curriculum():
    """
    (Legacy) Upload curriculum CSV to an existing job.
    ---
    tags:
      - Files
    summary: "(Legacy) Upload curriculum CSV"
    consumes:
      - multipart/form-data
    parameters:
      - name: job_id
        in: formData
        type: string
        required: true
        description: Job UUID from POST /api/v1/schedule/create
      - name: file
        in: formData
        type: file
        required: true
        description: "Curriculum CSV (required cols: subject_id, periods_per_week, teacher, student_class)"
    responses:
      200:
        description: File uploaded and validated
        schema:
          type: object
          properties:
            success:       {type: boolean}
            lessons_count: {type: integer}
            grades:        {type: array, items: {type: string}}
      400:
        description: Validation error or missing fields
      404:
        description: Job not found
    """
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "No file provided"
        }), 400
    
    file = request.files['file']
    job_id = request.form.get('job_id')
    
    if not job_id:
        return jsonify({
            "success": False,
            "error": "job_id is required"
        }), 400
    
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400
    
    if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
        return jsonify({
            "success": False,
            "error": "Invalid file type. Only CSV files are allowed."
        }), 400
    
    # Validate job exists
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    if not job_manager.get_job(job_id):
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    # Save file
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    uploads_folder = os.path.join(job_folder, 'uploads')
    filepath = os.path.join(uploads_folder, 'curriculum.csv')
    file.save(filepath)
    
    # Validate curriculum format
    validation = validate_curriculum(filepath)
    if not validation['valid']:
        os.remove(filepath)
        return jsonify({
            "success": False,
            "error": validation['error']
        }), 400
    
    # Update job record
    job_manager.add_file_to_job(job_id, 'curriculum', filepath)
    
    return jsonify({
        "success": True,
        "message": "Curriculum file uploaded successfully",
        "lessons_count": validation['lessons_count'],
        "grades": validation['grades']
    })


@api_bp.route('/rooms/upload', methods=['POST'])
def upload_rooms():
    """
    (Legacy) Upload rooms CSV to an existing job.
    ---
    tags:
      - Files
    summary: "(Legacy) Upload rooms CSV"
    consumes:
      - multipart/form-data
    parameters:
      - name: job_id
        in: formData
        type: string
        required: true
      - name: file
        in: formData
        type: file
        required: true
        description: "Rooms CSV (required column: room_id)"
    responses:
      200:
        description: File uploaded and validated
        schema:
          type: object
          properties:
            success:     {type: boolean}
            rooms_count: {type: integer}
      400:
        description: Validation error or missing fields
      404:
        description: Job not found
    """
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "No file provided"
        }), 400
    
    file = request.files['file']
    job_id = request.form.get('job_id')
    
    if not job_id:
        return jsonify({
            "success": False,
            "error": "job_id is required"
        }), 400
    
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "No file selected"
        }), 400
    
    if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
        return jsonify({
            "success": False,
            "error": "Invalid file type. Only CSV files are allowed."
        }), 400
    
    # Validate job exists
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    if not job_manager.get_job(job_id):
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    # Save file
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    uploads_folder = os.path.join(job_folder, 'uploads')
    filepath = os.path.join(uploads_folder, 'rooms.csv')
    file.save(filepath)
    
    # Validate rooms format
    validation = validate_rooms(filepath)
    if not validation['valid']:
        os.remove(filepath)
        return jsonify({
            "success": False,
            "error": validation['error']
        }), 400
    
    # Update job record
    job_manager.add_file_to_job(job_id, 'rooms', filepath)
    
    return jsonify({
        "success": True,
        "message": "Rooms file uploaded successfully",
        "rooms_count": validation['rooms_count']
    })


@api_bp.route('/timetables/upload', methods=['POST'])
def upload_timetables():
    """
    (Legacy) Upload existing timetable CSVs to an existing job.
    ---
    tags:
      - Files
    summary: "(Legacy) Upload existing timetable CSVs"
    description: >
      Accepts multiple files under any of these keys: files, file, timetables, timetable.
      Type (student/teacher/room) is auto-detected from the filename
      (e.g. student_1_1.csv, teacher_T001.csv, room_A101.csv).
    consumes:
      - multipart/form-data
    parameters:
      - name: job_id
        in: formData
        type: string
        required: true
      - name: files
        in: formData
        type: file
        required: true
        description: One or more timetable CSV files (repeatable)
    responses:
      200:
        description: Upload summary
        schema:
          type: object
          properties:
            success:        {type: boolean}
            uploaded_count: {type: integer}
            error_count:    {type: integer}
            uploaded:
              type: array
              items:
                type: object
                properties:
                  filename:  {type: string}
                  type:      {type: string}
                  entity_id: {type: string}
            errors: {type: array, items: {type: string}}
      400:
        description: No files provided or missing job_id
      404:
        description: Job not found
    """
    # Accept files under multiple possible key names
    files = []
    for key in ['files', 'file', 'timetables', 'timetable']:
        if key in request.files:
            # getlist returns all files uploaded under this key
            files.extend(request.files.getlist(key))
    
    if not files:
        return jsonify({
            "success": False,
            "error": "No files provided. Upload files using key: 'files', 'file', 'timetables', or 'timetable'"
        }), 400
    
    job_id = request.form.get('job_id')
    timetable_type = request.form.get('type', 'auto')  # auto-detect from filename
    
    if not job_id:
        return jsonify({
            "success": False,
            "error": "job_id is required"
        }), 400
    
    # Validate job exists
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    if not job_manager.get_job(job_id):
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    job_folder = get_job_folder(current_app.config['JOBS_FOLDER'], job_id)
    uploads_folder = os.path.join(job_folder, 'uploads')
    
    uploaded_files = []
    errors = []
    
    for file in files:
        # Skip empty file entries
        if not file or file.filename == '':
            continue
            
        if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
            errors.append(f"{file.filename}: Invalid file type. Only CSV files are allowed.")
            continue
        
        filename = secure_filename(file.filename)
        filepath = os.path.join(uploads_folder, filename)
        file.save(filepath)
        
        # Validate timetable format
        validation = validate_timetable(filepath)
        if not validation['valid']:
            os.remove(filepath)
            errors.append(f"{filename}: {validation['error']}")
            continue
        
        uploaded_files.append({
            "filename": filename,
            "type": validation['type'],
            "entity_id": validation['entity_id']
        })
        
        # Update job record
        job_manager.add_file_to_job(job_id, f"timetable_{validation['type']}", filepath)
    
    # Determine overall success
    total_attempted = len([f for f in files if f and f.filename])
    all_successful = len(errors) == 0 and len(uploaded_files) > 0
    
    return jsonify({
        "success": all_successful,
        "uploaded": uploaded_files,
        "uploaded_count": len(uploaded_files),
        "errors": errors if errors else None,
        "error_count": len(errors),
        "message": f"Uploaded {len(uploaded_files)} of {total_attempted} timetable(s)"
    })


