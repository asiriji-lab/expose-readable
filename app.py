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
from flask import Flask
from flask_cors import CORS

from api.routes import api_bp
from api.errors import register_error_handlers
from config import Config


def create_app(config_class=Config):
    """Application factory for creating Flask app instances."""
    
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable CORS for API access
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Create required directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
    os.makedirs(app.config['JOBS_FOLDER'], exist_ok=True)
    
    # Register blueprints
    app.register_blueprint(api_bp)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Root endpoint - API documentation
    @app.route('/')
    def index():
        return {
            "name": "GA Scheduler API",
            "version": "1.0.0",
            "description": "Genetic Algorithm School Timetable Completion System",
            "endpoints": {
                "GET /": "API documentation",
                "GET /health": "Health check",
                "POST /api/v1/schedule/create": "Create scheduling job",
                "GET /api/v1/schedule/<job_id>": "Get job status",
                "GET /api/v1/schedule/<job_id>/download": "Download results",
                "POST /api/v1/curriculum/upload": "Upload curriculum CSV",
                "POST /api/v1/rooms/upload": "Upload rooms CSV",
                "POST /api/v1/timetables/upload": "Upload timetable CSVs",
                "GET /api/v1/jobs": "List all jobs",
                "DELETE /api/v1/schedule/<job_id>": "Delete job"
            },
            "documentation": "/api/v1/docs"
        }
    
    @app.route('/health')
    def health():
        return {"status": "healthy", "service": "ga-scheduler-api"}
    
    return app


# Create the application instance
app = create_app()


if __name__ == '__main__':
    app.run(
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'True').lower() == 'true'
    )