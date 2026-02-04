"""
================================================================================
GA SCHEDULER - File Helpers
================================================================================

Utility functions for file handling.
"""

import os
import zipfile
from typing import Set


def allowed_file(filename: str, allowed_extensions: Set[str]) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions


def get_job_folder(jobs_folder: str, job_id: str) -> str:
    """Get the folder path for a specific job."""
    return os.path.join(jobs_folder, job_id)


def create_zip_archive(source_folder: str, zip_path: str) -> str:
    """
    Create a ZIP archive of a folder.
    
    Args:
        source_folder: Path to folder to zip
        zip_path: Path for output ZIP file
        
    Returns:
        Path to created ZIP file
    """
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_folder):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_folder)
                zipf.write(file_path, arcname)
    
    return zip_path


def get_file_size(filepath: str) -> int:
    """Get file size in bytes."""
    return os.path.getsize(filepath) if os.path.exists(filepath) else 0


def ensure_directory(path: str):
    """Ensure a directory exists."""
    os.makedirs(path, exist_ok=True)


def list_csv_files(folder: str) -> list:
    """List all CSV files in a folder."""
    if not os.path.exists(folder):
        return []
    return [f for f in os.listdir(folder) if f.endswith('.csv')]