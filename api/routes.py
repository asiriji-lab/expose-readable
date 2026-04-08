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
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity,
)
from werkzeug.security import generate_password_hash, check_password_hash

from src.ga.scheduler import run_scheduler_job
from src.ga.job_manager import JobManager
from src.utils.file_helpers import allowed_file, get_job_folder, create_zip_archive
from src.db import database, models


api_bp = Blueprint('api', __name__, url_prefix='/api/v1')


# =============================================================================
# BACKGROUND JOB RUNNER
# =============================================================================

def _run_job_background(app, job_id, job_folder, params, academic_year, semester):
    """Run a scheduling job inside a background thread with its own app context."""
    with app.app_context():
        job_manager = JobManager(app.config['JOBS_FOLDER'])
        try:
            result = run_scheduler_job(
                job_id=job_id,
                job_folder=job_folder,
                params=params,
                job_manager=job_manager,
                academic_year=academic_year,
                semester=semester,
            )
            # Persist completed schedule to the database when available
            if database.is_available():
                schedule_json = result.get('schedule_json')
                if result.get('success') and schedule_json:
                    models.complete_schedule(job_id, schedule_json)
                else:
                    err = result.get('error', 'Unknown error')
                    models.fail_schedule(job_id, err)
        except Exception as e:
            job_manager.update_job_status(job_id, 'failed', error=str(e))
            if database.is_available():
                models.fail_schedule(job_id, str(e))


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
      - name: org_id
        in: formData
        type: string
        required: false
        description: Organization UUID to associate this schedule with (optional, DB only)
      - name: user_id
        in: formData
        type: string
        required: false
        description: User UUID of the submitter (optional, DB only)
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
    org_id        = request.form.get('org_id', '').strip() or None
    user_id       = request.form.get('user_id', '').strip() or None
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

    # ── Persist to database (if available) ───────────────────────────────────
    if database.is_available():
        models.create_schedule(
            schedule_id=job_id,
            job_name=job_name,
            academic_year=academic_year,
            semester=semester,
            ga_params=ga_params,
            org_id=org_id,
            user_id=user_id,
        )

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


@api_bp.route('/jobs/latest', methods=['GET'])
def get_latest_job():
    """
    Get the most recently completed scheduling job.
    ---
    tags:
      - Scheduling
    responses:
      200:
        description: Most recent completed job
        schema:
          type: object
          properties:
            success: {type: boolean}
            job:     {type: object}
      404:
        description: No completed jobs found
    """
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    jobs = job_manager.list_jobs()
    completed = [j for j in jobs if j.get('status') == 'completed']
    if not completed:
        return jsonify({"success": False, "error": "No completed jobs found"}), 404
    latest = max(completed, key=lambda j: j.get('updated_at', ''))
    return jsonify({"success": True, "job": latest})


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
            success:  {type: boolean}
            job_id:   {type: string}
            result:   {type: object, description: "Job metadata (stats, GA result, paths)"}
            schedule: {type: object, description: "Full schedule JSON (config, teachers, students, rooms, unfilled_slots)"}
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

    result = job.get('result') or {}
    schedule = None
    json_path = result.get('json_path')
    if json_path and os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            schedule = json.load(f)

    return jsonify({
        "success":  True,
        "job_id":   job['job_id'],
        "result":   result,
        "schedule": schedule,
    })


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
# ORGANIZATION ENDPOINTS
# =============================================================================

@api_bp.route('/organizations', methods=['POST'])
def create_organization():
    """
    Create a new organization.
    ---
    tags:
      - Organizations
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [name]
          properties:
            name: {type: string, example: "Springfield High School"}
    responses:
      201:
        description: Organization created
        schema:
          type: object
          properties:
            success: {type: boolean}
            organization: {type: object}
      400:
        description: Missing name or DB unavailable
      409:
        description: Organization name already exists
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"success": False, "error": "'name' is required"}), 400

    org = models.create_organization(name)
    if org is None:
        return jsonify({"success": False,
                        "error": "Could not create organization (name may already exist)"}), 409

    return jsonify({"success": True, "organization": org}), 201


@api_bp.route('/organizations', methods=['GET'])
def list_organizations():
    """
    List all organizations.
    ---
    tags:
      - Organizations
    responses:
      200:
        description: Array of organizations
      400:
        description: Database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    orgs = models.list_organizations() or []
    return jsonify({"success": True, "count": len(orgs), "organizations": orgs})


@api_bp.route('/organizations/<org_id>', methods=['GET'])
def get_organization(org_id):
    """
    Get a single organization by ID.
    ---
    tags:
      - Organizations
    parameters:
      - name: org_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Organization record
      404:
        description: Not found
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    org = models.get_organization(org_id)
    if not org:
        return jsonify({"success": False, "error": "Organization not found"}), 404

    return jsonify({"success": True, "organization": org})


# =============================================================================
# USER ENDPOINTS
# =============================================================================

@api_bp.route('/users/sync', methods=['POST'])
def sync_user():
    """
    Create-or-return a user by e-mail (upsert).

    Designed for the frontend to ensure a backend user exists for the currently
    authenticated Supabase user before associating scheduling jobs with them.
    ---
    tags:
      - Users
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email]
          properties:
            email: {type: string, example: "jane@example.com"}
            name:  {type: string, example: "Jane Smith"}
    responses:
      200:
        description: Existing user returned
        schema:
          type: object
          properties:
            success: {type: boolean}
            user:    {type: object}
            created: {type: boolean, example: false}
      201:
        description: New user created
        schema:
          type: object
          properties:
            success: {type: boolean}
            user:    {type: object}
            created: {type: boolean, example: true}
      400:
        description: Missing email or database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    data  = request.get_json() or {}
    email = (data.get('email') or '').strip()
    name  = (data.get('name')  or '').strip() or None

    if not email:
        return jsonify({"success": False, "error": "'email' is required"}), 400

    existing = models.get_user_by_email(email)
    if existing:
        return jsonify({"success": True, "user": existing, "created": False})

    user = models.create_user(email=email, name=name)
    if user is None:
        return jsonify({"success": False, "error": "Could not create user"}), 500

    return jsonify({"success": True, "user": user, "created": True}), 201


@api_bp.route('/users', methods=['POST'])
def create_user():
    """
    Create a new user.
    ---
    tags:
      - Users
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email]
          properties:
            email:  {type: string, example: "jane@example.com"}
            name:   {type: string, example: "Jane Smith"}
            org_id: {type: string, example: "<org UUID>"}
    responses:
      201:
        description: User created
        schema:
          type: object
          properties:
            success: {type: boolean}
            user: {type: object}
      400:
        description: Missing email or DB unavailable
      409:
        description: Email already registered
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    data   = request.get_json() or {}
    email  = (data.get('email') or '').strip()
    name   = (data.get('name') or '').strip() or None
    org_id = (data.get('org_id') or '').strip() or None

    if not email:
        return jsonify({"success": False, "error": "'email' is required"}), 400

    user = models.create_user(email=email, name=name, org_id=org_id)
    if user is None:
        return jsonify({"success": False,
                        "error": "Could not create user (email may already exist)"}), 409

    return jsonify({"success": True, "user": user}), 201


@api_bp.route('/users', methods=['GET'])
def list_users():
    """
    List all users (optionally filtered by org_id).
    ---
    tags:
      - Users
    parameters:
      - name: org_id
        in: query
        type: string
        required: false
    responses:
      200:
        description: Array of users
      400:
        description: Database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    org_id = request.args.get('org_id') or None
    users = models.list_users(org_id=org_id) or []
    return jsonify({"success": True, "count": len(users), "users": users})


@api_bp.route('/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """
    Get a single user by ID.
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: User record
      404:
        description: Not found
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    user = models.get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    return jsonify({"success": True, "user": user})


# =============================================================================
# SCHEDULE METADATA ENDPOINTS
# =============================================================================

@api_bp.route('/schedules', methods=['GET'])
def list_schedule_records():
    """
    List schedule records stored in the database.
    ---
    tags:
      - Schedules
    summary: List schedule records (with optional filters)
    parameters:
      - name: org_id
        in: query
        type: string
        required: false
        description: Filter by organization UUID
      - name: user_id
        in: query
        type: string
        required: false
        description: Filter by user UUID
      - name: status
        in: query
        type: string
        required: false
        enum: [created, loading_data, running_ga, exporting, completed, failed]
        description: Filter by job status
    responses:
      200:
        description: Array of schedule records (data column excluded for efficiency)
        schema:
          type: object
          properties:
            success: {type: boolean}
            count:   {type: integer}
            schedules: {type: array, items: {type: object}}
      400:
        description: Database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    org_id  = request.args.get('org_id')  or None
    user_id = request.args.get('user_id') or None
    status  = request.args.get('status')  or None

    schedules = models.list_schedules(org_id=org_id, user_id=user_id, status=status) or []
    return jsonify({"success": True, "count": len(schedules), "schedules": schedules})


@api_bp.route('/schedules/<schedule_id>', methods=['GET'])
def get_schedule_record(schedule_id):
    """
    Get a single schedule record by ID (includes full data column).
    ---
    tags:
      - Schedules
    parameters:
      - name: schedule_id
        in: path
        type: string
        required: true
        description: Schedule UUID (same as the API job_id)
    responses:
      200:
        description: Full schedule record including the data JSONB column
      404:
        description: Schedule not found
      400:
        description: Database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    sched = models.get_schedule(schedule_id)
    if not sched:
        return jsonify({"success": False, "error": "Schedule not found"}), 404

    return jsonify({"success": True, "schedule": sched})


# =============================================================================
# ORGANIZATION ↔ USER / SCHEDULE RELATIONSHIP ENDPOINTS
# =============================================================================

@api_bp.route('/organizations/<org_id>/users', methods=['GET'])
def list_org_users(org_id):
    """
    List all users belonging to a specific organization.
    ---
    tags:
      - Organizations
    parameters:
      - name: org_id
        in: path
        type: string
        required: true
        description: Organization UUID
    responses:
      200:
        description: Array of user records
        schema:
          type: object
          properties:
            success: {type: boolean}
            count:   {type: integer}
            users:   {type: array, items: {type: object}}
      400:
        description: Database not configured
      404:
        description: Organization not found
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    org = models.get_organization(org_id)
    if not org:
        return jsonify({"success": False, "error": "Organization not found"}), 404

    users = models.list_users(org_id=org_id) or []
    return jsonify({"success": True, "count": len(users), "users": users})


@api_bp.route('/organizations/<org_id>/schedules', methods=['GET'])
def list_org_schedules(org_id):
    """
    List all schedule records belonging to a specific organization.
    ---
    tags:
      - Organizations
    parameters:
      - name: org_id
        in: path
        type: string
        required: true
        description: Organization UUID
    responses:
      200:
        description: Array of schedule records (data column excluded)
        schema:
          type: object
          properties:
            success:   {type: boolean}
            count:     {type: integer}
            schedules: {type: array, items: {type: object}}
      400:
        description: Database not configured
      404:
        description: Organization not found
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    org = models.get_organization(org_id)
    if not org:
        return jsonify({"success": False, "error": "Organization not found"}), 404

    schedules = models.get_org_schedules(org_id) or []
    return jsonify({"success": True, "count": len(schedules), "schedules": schedules})


# =============================================================================
# USER ↔ SCHEDULE RELATIONSHIP ENDPOINTS
# =============================================================================

@api_bp.route('/users/<user_id>/schedules', methods=['GET'])
def list_user_schedules(user_id):
    """
    List all schedule records submitted by a specific user.
    ---
    tags:
      - Users
    parameters:
      - name: user_id
        in: path
        type: string
        required: true
        description: User UUID
    responses:
      200:
        description: Array of schedule records (data column excluded)
        schema:
          type: object
          properties:
            success:   {type: boolean}
            count:     {type: integer}
            schedules: {type: array, items: {type: object}}
      400:
        description: Database not configured
      404:
        description: User not found
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    user = models.get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    schedules = models.get_user_schedules(user_id) or []
    return jsonify({"success": True, "count": len(schedules), "schedules": schedules})


# =============================================================================
# AUTHENTICATION ENDPOINTS
# =============================================================================

@api_bp.route('/auth/register', methods=['POST'])
def auth_register():
    """
    Register a new user account.
    ---
    tags:
      - Auth
    summary: Register and receive a JWT access token
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password]
          properties:
            email:    {type: string, example: "jane@springfieldhs.edu"}
            password: {type: string, example: "s3cur3p@ss"}
            name:     {type: string, example: "Jane Smith"}
            org_id:   {type: string, example: "<org UUID>"}
    responses:
      201:
        description: Account created — JWT token returned
        schema:
          type: object
          properties:
            success:      {type: boolean}
            access_token: {type: string}
            user:         {type: object}
      400:
        description: Missing fields, invalid input, or DB unavailable
      409:
        description: Email already registered
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    data     = request.get_json() or {}
    email    = (data.get('email')    or '').strip()
    password = (data.get('password') or '').strip()
    name     = (data.get('name')     or '').strip() or None
    org_id   = (data.get('org_id')   or '').strip() or None

    if not email:
        return jsonify({"success": False, "error": "'email' is required"}), 400
    if not password:
        return jsonify({"success": False, "error": "'password' is required"}), 400
    if len(password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"}), 400

    # Check for existing account
    if models.get_user_by_email(email):
        return jsonify({"success": False, "error": "Email already registered"}), 409

    hashed = generate_password_hash(password)
    user = models.create_user(email=email, name=name, org_id=org_id, password_hash=hashed)
    if not user:
        return jsonify({"success": False, "error": "Could not create account"}), 500

    token = create_access_token(identity=user['user_id'])
    return jsonify({"success": True, "access_token": token, "user": user}), 201


@api_bp.route('/auth/login', methods=['POST'])
def auth_login():
    """
    Login with email and password — returns a JWT access token.
    ---
    tags:
      - Auth
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [email, password]
          properties:
            email:    {type: string, example: "jane@springfieldhs.edu"}
            password: {type: string, example: "s3cur3p@ss"}
    responses:
      200:
        description: Login successful
        schema:
          type: object
          properties:
            success:      {type: boolean}
            access_token: {type: string}
            user:         {type: object}
      400:
        description: Missing fields or DB unavailable
      401:
        description: Invalid credentials
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    data     = request.get_json() or {}
    email    = (data.get('email')    or '').strip()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({"success": False, "error": "'email' and 'password' are required"}), 400

    user_orm = models.get_user_orm(email)
    if not user_orm or not user_orm.password_hash:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401
    if not check_password_hash(user_orm.password_hash, password):
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(user_orm.user_id))
    return jsonify({"success": True, "access_token": token, "user": user_orm.to_dict()})


@api_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def auth_me():
    """
    Return the currently authenticated user's profile.
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Authenticated user record
        schema:
          type: object
          properties:
            success: {type: boolean}
            user:    {type: object}
      401:
        description: Missing or invalid JWT token
      400:
        description: Database not configured
    """
    if not database.is_available():
        return jsonify({"success": False, "error": "Database not configured"}), 400

    user_id = get_jwt_identity()
    user    = models.get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404

    return jsonify({"success": True, "user": user})


@api_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def auth_logout():
    """
    Logout the current user.
    ---
    tags:
      - Auth
    description: >
      JWT tokens are stateless — this endpoint signals a successful logout to
      the client. The client is responsible for discarding the token.
      For server-side revocation, implement a token blocklist (see docs/ORM.md).
    security:
      - Bearer: []
    responses:
      200:
        description: Logout acknowledged
        schema:
          type: object
          properties:
            success: {type: boolean}
            message: {type: string}
      401:
        description: Missing or invalid JWT token
    """
    return jsonify({"success": True, "message": "Logged out successfully. Discard your token."})
