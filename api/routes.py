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
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename

from core.scheduler import run_scheduler_job
from core.job_manager import JobManager
from utils.validators import validate_curriculum, validate_rooms, validate_timetable
from utils.file_helpers import allowed_file, get_job_folder, create_zip_archive


api_bp = Blueprint('api', __name__, url_prefix='/api/v1')


# =============================================================================
# JOB MANAGEMENT ENDPOINTS
# =============================================================================

@api_bp.route('/jobs', methods=['GET'])
def list_jobs():
    """List all scheduling jobs."""
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
    Create a new scheduling job.
    
    Request JSON:
    {
        "job_name": "optional job name",
        "ga_params": {
            "population_size": 150,
            "max_generations": 500,
            "mutation_rate": 0.20,
            "crossover_rate": 0.80,
            "elite_size": 10,
            "tournament_size": 7
        }
    }
    
    Returns:
    {
        "success": true,
        "job_id": "uuid",
        "message": "Job created successfully"
    }
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
    """Get the status of a scheduling job."""
    job_manager = JobManager(current_app.config['JOBS_FOLDER'])
    job = job_manager.get_job(job_id)
    
    if not job:
        return jsonify({
            "success": False,
            "error": "Job not found"
        }), 404
    
    return jsonify({
        "success": True,
        "job": job
    })


@api_bp.route('/schedule/<job_id>/start', methods=['POST'])
def start_job(job_id):
    """Start the scheduling job."""
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
            job_manager=job_manager
        )
        
        return jsonify({
            "success": True,
            "message": "Scheduling completed",
            "result": result
        })
        
    except Exception as e:
        job_manager.update_job_status(job_id, 'failed', error=str(e))
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@api_bp.route('/schedule/<job_id>/download', methods=['GET'])
def download_results(job_id):
    """Download completed schedules as a ZIP file."""
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
    """Delete a scheduling job and its files."""
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
    Upload curriculum CSV file.
    
    Form data:
    - job_id: The job ID to associate with this file
    - file: The curriculum CSV file
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
    Upload rooms CSV file.
    
    Form data:
    - job_id: The job ID to associate with this file
    - file: The rooms CSV file
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
    Upload existing timetable CSV files (student, teacher, or room timetables).
    
    Accepts multiple files under a single key. The endpoint checks for files
    under any of these keys: 'files', 'file', 'timetables', or 'timetable'.
    
    Form data:
    - job_id: The job ID to associate with these files
    - files (or file/timetables/timetable): Multiple timetable CSV files
    - type: 'student', 'teacher', or 'room' (optional, auto-detected from filename)
    
    Example curl:
        curl -X POST http://localhost:5000/api/v1/timetables/upload \
            -F "job_id=<job_id>" \
            -F "files=@student_1_1.csv" \
            -F "files=@student_1_2.csv" \
            -F "files=@teacher_T001.csv"
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


# =============================================================================
# UTILITY ENDPOINTS
# =============================================================================

@api_bp.route('/docs', methods=['GET'])
def api_docs():
    """Return API documentation."""
    return jsonify({
        "name": "GA Scheduler API",
        "version": "1.0.0",
        "description": "Genetic Algorithm School Timetable Completion System",
        "base_url": "/api/v1",
        "endpoints": [
            {
                "method": "GET",
                "path": "/jobs",
                "description": "List all scheduling jobs",
                "parameters": None,
                "response": {"jobs": "array of job objects"}
            },
            {
                "method": "POST",
                "path": "/schedule/create",
                "description": "Create a new scheduling job",
                "parameters": {
                    "job_name": "string (optional)",
                    "ga_params": {
                        "population_size": "int (default: 150)",
                        "max_generations": "int (default: 500)",
                        "mutation_rate": "float (default: 0.20)",
                        "crossover_rate": "float (default: 0.80)",
                        "elite_size": "int (default: 10)",
                        "tournament_size": "int (default: 7)"
                    }
                },
                "response": {"job_id": "string", "message": "string"}
            },
            {
                "method": "GET",
                "path": "/schedule/<job_id>",
                "description": "Get job status and details",
                "parameters": None,
                "response": {"job": "job object"}
            },
            {
                "method": "POST",
                "path": "/schedule/<job_id>/start",
                "description": "Start the scheduling algorithm",
                "parameters": None,
                "response": {"result": "scheduling result"}
            },
            {
                "method": "GET",
                "path": "/schedule/<job_id>/download",
                "description": "Download completed schedules as ZIP",
                "parameters": None,
                "response": "ZIP file"
            },
            {
                "method": "DELETE",
                "path": "/schedule/<job_id>",
                "description": "Delete a job and its files",
                "parameters": None,
                "response": {"message": "string"}
            },
            {
                "method": "POST",
                "path": "/curriculum/upload",
                "description": "Upload curriculum CSV file",
                "parameters": {
                    "job_id": "string (form field)",
                    "file": "CSV file"
                },
                "response": {"lessons_count": "int", "grades": "array"}
            },
            {
                "method": "POST",
                "path": "/rooms/upload",
                "description": "Upload rooms CSV file",
                "parameters": {
                    "job_id": "string (form field)",
                    "file": "CSV file"
                },
                "response": {"rooms_count": "int"}
            },
            {
                "method": "POST",
                "path": "/timetables/upload",
                "description": "Upload existing timetable CSV files (multiple files under one key)",
                "parameters": {
                    "job_id": "string (form field, required)",
                    "files": "multiple CSV files (also accepts keys: 'file', 'timetables', 'timetable')",
                    "type": "string (student/teacher/room, optional - auto-detected from filename)"
                },
                "example": "curl -F 'job_id=xxx' -F 'files=@student_1_1.csv' -F 'files=@teacher_T001.csv' URL",
                "response": {
                    "uploaded": "array of {filename, type, entity_id}",
                    "uploaded_count": "int",
                    "errors": "array of error strings or null",
                    "error_count": "int"
                }
            }
        ],
        "file_formats": {
            "curriculum": {
                "columns": ["subject_id", "subject_name", "periods_per_week", 
                           "teacher", "block_pattern", "student_class", 
                           "constraint", "room", "fixed_period"],
                "example": "See curriculum_cleaned.csv"
            },
            "rooms": {
                "columns": ["room_id", "note", "tag"],
                "example": "See room_cleaned.csv"
            },
            "timetables": {
                "format": "CSV with days as rows, periods as columns",
                "naming": "student_<class>.csv, teacher_<id>.csv, room_<id>.csv"
            }
        }
    })