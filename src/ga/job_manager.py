"""
================================================================================
GA SCHEDULER - Job Manager
================================================================================

Manages scheduling jobs - creation, status tracking, and cleanup.
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional


class JobManager:
    """Manages scheduling jobs."""
    
    def __init__(self, jobs_folder: str):
        self.jobs_folder = jobs_folder
        self.jobs_file = os.path.join(jobs_folder, 'jobs.json')
        
        os.makedirs(jobs_folder, exist_ok=True)
        
        if not os.path.exists(self.jobs_file):
            self._save_jobs({})
    
    def _load_jobs(self) -> Dict:
        """Load jobs from file."""
        try:
            with open(self.jobs_file, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _save_jobs(self, jobs: Dict):
        """Save jobs to file."""
        with open(self.jobs_file, 'w') as f:
            json.dump(jobs, f, indent=2, default=str)
    
    def create_job(self, job_id: str, job_name: str, params: Dict) -> Dict:
        """Create a new job record."""
        jobs = self._load_jobs()
        
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
            'updated_at': datetime.now().isoformat()
        }
        
        jobs[job_id] = job
        self._save_jobs(jobs)
        
        return job
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a job by ID."""
        jobs = self._load_jobs()
        return jobs.get(job_id)
    
    def list_jobs(self) -> List[Dict]:
        """List all jobs."""
        jobs = self._load_jobs()
        return list(jobs.values())
    
    def update_job_status(self, job_id: str, status: str, 
                          error: str = None, result: Dict = None):
        """Update job status."""
        jobs = self._load_jobs()
        
        if job_id in jobs:
            jobs[job_id]['status'] = status
            jobs[job_id]['updated_at'] = datetime.now().isoformat()
            
            if error:
                jobs[job_id]['error'] = error
            if result:
                jobs[job_id]['result'] = result
                
            self._save_jobs(jobs)
    
    def update_job_progress(self, job_id: str, stage: str, 
                           progress: float, details: Dict = None):
        """Update job progress."""
        jobs = self._load_jobs()
        
        if job_id in jobs:
            jobs[job_id]['status'] = stage
            jobs[job_id]['progress'] = progress
            jobs[job_id]['progress_details'] = details
            jobs[job_id]['updated_at'] = datetime.now().isoformat()
            self._save_jobs(jobs)
    
    def add_file_to_job(self, job_id: str, file_type: str, filepath: str):
        """Add file reference to job."""
        jobs = self._load_jobs()
        
        if job_id in jobs:
            if file_type not in jobs[job_id]['files']:
                jobs[job_id]['files'][file_type] = []
            jobs[job_id]['files'][file_type].append(filepath)
            jobs[job_id]['updated_at'] = datetime.now().isoformat()
            self._save_jobs(jobs)
    
    def delete_job(self, job_id: str):
        """Delete a job record."""
        jobs = self._load_jobs()
        
        if job_id in jobs:
            del jobs[job_id]
            self._save_jobs(jobs)
    
    def cleanup_old_jobs(self, days: int = 7):
        """Remove jobs older than specified days."""
        jobs = self._load_jobs()
        now = datetime.now()
        
        to_delete = []
        for job_id, job in jobs.items():
            created = datetime.fromisoformat(job['created_at'])
            age = (now - created).days
            if age > days:
                to_delete.append(job_id)
        
        for job_id in to_delete:
            del jobs[job_id]
        
        if to_delete:
            self._save_jobs(jobs)
        
        return len(to_delete)