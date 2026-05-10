"""
================================================================================
GA SCHEDULER FLASK API - Main Application Entry Point
================================================================================

This is the main entry point for the Genetic Algorithm School Timetable 
Completion System Flask API.

Usage:
    python app.py                    # Run in development mode
    gunicorn app:app -w 4 -b 0.0.0.0:5000  # Run in production

API Endpoints:
    GET  /                          - API documentation
    GET  /health                    - Health check
    POST /api/v1/schedule/create    - Create a new scheduling job
    GET  /api/v1/schedule/<job_id>  - Get job status and results
    GET  /api/v1/schedule/<job_id>/download - Download completed schedules
    POST /api/v1/curriculum/upload  - Upload curriculum file
    POST /api/v1/rooms/upload       - Upload rooms file
    POST /api/v1/timetables/upload  - Upload existing timetables
    GET  /api/v1/jobs               - List all jobs
    DELETE /api/v1/schedule/<job_id> - Cancel/delete a job

================================================================================
"""

import os
import time
from dotenv import load_dotenv
from flask import Flask, g, request

load_dotenv()  # Load environment variables from .env file
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flasgger import Swagger

from api.routes import api_bp
from api.errors import register_error_handlers
from config import Config
from src.logger import init_api_logger
from src.db import database


SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs",
}

SWAGGER_TEMPLATE = {
    "info": {
        "title": "GA Scheduler API",
        "description": (
            "Genetic Algorithm School Timetable Completion System. "
            "Submit a scheduling job via **POST /api/v1/schedule** and poll "
            "**GET /api/v1/schedule/{job_id}** for progress."
        ),
        "version": "1.0.0",
    },
    "basePath": "/",
    "schemes": ["http", "https"],
    "tags": [
        {"name": "Scheduling",    "description": "Submit and manage scheduling jobs"},
        {"name": "Schedules",     "description": "Query schedule metadata"},
        {"name": "Organizations", "description": "Manage organizations"},
        {"name": "Users",         "description": "Manage users"},
        {"name": "Auth",          "description": "Register, login, and token management"},
    ],
}


def create_app(config_class=Config):
    """Application factory for creating Flask app instances."""

    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS for API access
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Directories ───────────────────────────────────────────────────────────
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
    os.makedirs(app.config['JOBS_FOLDER'], exist_ok=True)
    os.makedirs(app.config['LOGS_DIR'], exist_ok=True)

    # ── API request logger ────────────────────────────────────────────────────
    api_logger = init_api_logger(app.config['LOGS_DIR'])

    @app.before_request
    def _before():
        g.req_start = time.perf_counter()

    @app.after_request
    def _after(response):
        duration = time.perf_counter() - getattr(g, 'req_start', time.perf_counter())
        job_id = request.view_args.get('job_id', '') if request.view_args else ''
        extra = f" job_id={job_id}" if job_id else ""
        api_logger.info(
            "%s %s → %d  %.3fs%s",
            request.method,
            request.path,
            response.status_code,
            duration,
            extra,
        )
        return response

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWTManager(app)

    # ── Database (optional) ───────────────────────────────────────────────────
    # Check for empty DB environment variables
    MANDATORY_DB_ENV_VARS = {'POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'}
    if missing_vars := MANDATORY_DB_ENV_VARS.difference(os.environ):
        raise EnvironmentError(f"The following variables were not set: {missing_vars}")
    else:
        database.init_db(app)

    # ── Blueprints & error handlers ───────────────────────────────────────────
    app.register_blueprint(api_bp)
    register_error_handlers(app)

    # ── Swagger / OpenAPI UI ──────────────────────────────────────────────────
    Swagger(app, config=SWAGGER_CONFIG, template=SWAGGER_TEMPLATE)

    # ── Root endpoint ─────────────────────────────────────────────────────────
    @app.route('/')
    def index():
        return {
            "name": "GA Scheduler API",
            "version": "1.0.0",
            "description": "Genetic Algorithm School Timetable Completion System",
            "database": "connected" if database.is_available() else "not configured",
            "endpoints": {
                "GET /": "API documentation",
                "GET /health": "Health check",
                "POST /api/v1/schedule": "Submit scheduling job (files + params in one request)",
                "GET /api/v1/schedule/<job_id>": "Get job status and results",
                "GET /api/v1/schedule/<job_id>/download": "Download results as ZIP",
                "DELETE /api/v1/schedule/<job_id>": "Delete job",
                "GET /api/v1/jobs": "List all jobs",
                "GET /api/v1/schedules": "List schedule records (filters: org_id, user_id, status)",
                "GET /api/v1/schedules/<schedule_id>": "Get a single schedule record",
                "POST /api/v1/organizations": "Create an organization",
                "GET /api/v1/organizations": "List organizations",
                "GET /api/v1/organizations/<org_id>": "Get an organization",
                "GET /api/v1/organizations/<org_id>/users": "Users in an organization",
                "GET /api/v1/organizations/<org_id>/schedules": "Schedules for an organization",
                "POST /api/v1/users": "Create a user",
                "GET /api/v1/users": "List users",
                "GET /api/v1/users/<user_id>": "Get a user",
                "GET /api/v1/users/<user_id>/schedules": "Schedules for a user",
                "POST /api/v1/auth/register": "Register a new user account",
                "POST /api/v1/auth/login": "Login and receive a JWT access token",
                "GET /api/v1/auth/me": "Get the authenticated user's profile",
                "POST /api/v1/auth/logout": "Logout (client-side token invalidation)",
            },
            "documentation": "/apidocs",
        }

    @app.route('/health')
    def health():
        return {
            "status": "healthy",
            "service": "ga-scheduler-api",
            "database": "connected" if database.is_available() else "not configured",
        }

    return app


# Create the application instance
app = create_app()


if __name__ == '__main__':
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'True').lower() == 'true'
    )