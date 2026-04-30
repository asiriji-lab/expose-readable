"""
Job queue — ThreadPoolExecutor wrapper with cooperative cancellation.
"""

import threading
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Dict, Optional


class JobCancelledError(Exception):
    pass


class JobQueue:
    def __init__(self, max_workers: int = 2):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: Dict[str, Future] = {}
        self._cancel_events: Dict[str, threading.Event] = {}
        self._lock = threading.Lock()

    def submit(self, job_id: str, fn, *args, **kwargs) -> Future:
        """Submit fn(*args, **kwargs, cancel_event=event) to the pool."""
        cancel_event = threading.Event()
        with self._lock:
            self._cancel_events[job_id] = cancel_event
        future = self.executor.submit(fn, *args, cancel_event=cancel_event, **kwargs)
        with self._lock:
            self._futures[job_id] = future
        return future

    def cancel(self, job_id: str) -> str:
        """
        Cancel a job.

        Returns:
            'cancelled_queued'   — was queued, future.cancel() succeeded (never runs)
            'cancelling_running' — running, cancel event set (exits at next GA epoch)
            'not_found'          — no record of this job_id
        """
        with self._lock:
            future = self._futures.get(job_id)
            cancel_event = self._cancel_events.get(job_id)

        if future is None and cancel_event is None:
            return 'not_found'

        if future and future.cancel():
            self.cleanup(job_id)
            return 'cancelled_queued'

        if cancel_event:
            cancel_event.set()
            return 'cancelling_running'

        return 'not_found'

    def cleanup(self, job_id: str):
        """Remove job tracking state after it finishes or is cancelled."""
        with self._lock:
            self._futures.pop(job_id, None)
            self._cancel_events.pop(job_id, None)
