"""
================================================================================
GA SCHEDULER - Job Manager
================================================================================

Manages scheduling jobs - creation, status tracking, and cleanup.
"""

import os
import threading
from datetime import datetime
from typing import Dict, List, Optional

_JOB_STORE: Dict[str, Dict] = {}   # jobs_folder -> {job_id -> job_dict}
_JOB_LOCK = threading.Lock()


class JobManager:
    """Manages scheduling jobs using an in-memory store."""

    def __init__(self, jobs_folder: str):
        self.jobs_folder = jobs_folder
        os.makedirs(jobs_folder, exist_ok=True)
        with _JOB_LOCK:
            if jobs_folder not in _JOB_STORE:
                _JOB_STORE[jobs_folder] = {}

    def _store(self) -> Dict:
        return _JOB_STORE[self.jobs_folder]

    def create_job(self, job_id: str, job_name: str, params: Dict) -> Dict:
        """Create a new job record."""
        job = {
            'job_id': job_id,
            'job_name': job_name,
            'status': 'created',
            'params': params,
            'files': {},
            'progress': 0,
            'progress_details': None,
            'result': None,
            'error': None,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        with _JOB_LOCK:
            self._store()[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a job by ID."""
        with _JOB_LOCK:
            return self._store().get(job_id)

    def list_jobs(self) -> List[Dict]:
        """List all jobs."""
        with _JOB_LOCK:
            return list(self._store().values())

    def update_job_status(self, job_id: str, status: str,
                          error: str = None, result: Dict = None):
        """Update job status."""
        with _JOB_LOCK:
            store = self._store()
            if job_id in store:
                store[job_id]['status'] = status
                store[job_id]['updated_at'] = datetime.now().isoformat()
                if error:
                    store[job_id]['error'] = error
                if result:
                    store[job_id]['result'] = result
        if status == 'failed' and error:
            try:
                from src.db import database
                if database.is_available():
                    from src.db import models
                    models.fail_schedule(job_id, error)
            except Exception:
                pass

    def update_job_progress(self, job_id: str, stage: str,
                            progress: float, details: Dict = None):
        """Update job progress."""
        with _JOB_LOCK:
            store = self._store()
            if job_id in store:
                store[job_id]['status'] = stage
                store[job_id]['progress'] = progress
                store[job_id]['progress_details'] = details
                store[job_id]['updated_at'] = datetime.now().isoformat()
        try:
            from src.db import database
            if database.is_available():
                from src.db import models
                models.update_schedule_status(job_id, stage, progress)
        except Exception:
            pass

    def add_file_to_job(self, job_id: str, file_type: str, filepath: str):
        """Add file reference to job."""
        with _JOB_LOCK:
            store = self._store()
            if job_id in store:
                if file_type not in store[job_id]['files']:
                    store[job_id]['files'][file_type] = []
                store[job_id]['files'][file_type].append(filepath)
                store[job_id]['updated_at'] = datetime.now().isoformat()

    def delete_job(self, job_id: str):
        """Delete a job record."""
        with _JOB_LOCK:
            store = self._store()
            if job_id in store:
                del store[job_id]

    def cleanup_old_jobs(self, days: int = 7):
        """Remove jobs older than specified days."""
        now = datetime.now()
        to_delete = []
        with _JOB_LOCK:
            store = self._store()
            for job_id, job in store.items():
                created = datetime.fromisoformat(job['created_at'])
                age = (now - created).days
                if age > days:
                    to_delete.append(job_id)
            for job_id in to_delete:
                del store[job_id]
        return len(to_delete)
