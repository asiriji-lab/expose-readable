"""
================================================================================
SCHEDOOL - Centralized Logging Utilities
================================================================================

Two loggers are provided:

  1. API request logger  → logs/api_YYYY-MM-DD.log  (top-level logs/ directory)
     Rotates automatically at midnight; one file per calendar day.

  2. Job (GA) logger     → data/jobs/<job_id>/outputs/logs/ga_YYYY-MM-DD_HH-MM-SS.log
     A fresh file is created at the start of every scheduling run.
     The existing _Tee stdout-redirect in scheduler.py writes raw GA output to
     this same directory; the job logger adds structured phase-level entries.
================================================================================
"""

import os
import sys
import logging
from datetime import datetime


# ---------------------------------------------------------------------------
# Internal: daily-rotating file handler
# ---------------------------------------------------------------------------

class _DailyFileHandler(logging.FileHandler):
    """
    Writes to <logs_dir>/api_YYYY-MM-DD.log.

    On every emit, checks whether the calendar date has rolled over.
    If it has, closes the current file and opens a new one — giving us
    one log file per day without needing a background rotation thread.
    """

    def __init__(self, logs_dir: str, encoding: str = 'utf-8'):
        self._logs_dir = logs_dir
        self._current_date: str | None = None
        log_path = self._current_log_path()
        super().__init__(log_path, mode='a', encoding=encoding, delay=False)
        self._current_date = datetime.now().strftime('%Y-%m-%d')

    def _current_log_path(self) -> str:
        date_str = datetime.now().strftime('%Y-%m-%d')
        return os.path.join(self._logs_dir, f'api_{date_str}.log')

    def emit(self, record: logging.LogRecord):
        today = datetime.now().strftime('%Y-%m-%d')
        if today != self._current_date:
            self._current_date = today
            self.close()
            self.baseFilename = os.path.abspath(self._current_log_path())
            self.stream = self._open()
        super().emit(record)


# ---------------------------------------------------------------------------
# Public: API request logger
# ---------------------------------------------------------------------------

def init_api_logger(logs_dir: str) -> logging.Logger:
    """
    Initialise (or return the existing) API request logger.

    Writes to  <logs_dir>/api_YYYY-MM-DD.log  — one file per day.
    Safe to call multiple times; handlers are only attached once.

    Args:
        logs_dir: Directory where api_*.log files are written.
                  Created automatically if it does not exist.

    Returns:
        logging.Logger instance for 'schedool.api'.
    """
    os.makedirs(logs_dir, exist_ok=True)

    logger = logging.getLogger('schedool.api')
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)

    fmt = logging.Formatter(
        '%(asctime)s [%(levelname)-8s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    file_handler = _DailyFileHandler(logs_dir)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    # Prevent double-logging through the root logger
    logger.propagate = False

    return logger


# ---------------------------------------------------------------------------
# Public: per-job GA logger
# ---------------------------------------------------------------------------

def create_job_logger(job_id: str, outputs_folder: str) -> tuple[logging.Logger, str]:
    """
    Create a fresh structured logger for a single scheduling job.

    The log file is written to:
        <outputs_folder>/logs/ga_YYYY-MM-DD_HH-MM-SS.log

    The _Tee stdout redirect in scheduler.py (which captures all raw GA
    print output) also writes to this same ``logs/`` subdirectory, so
    every artifact for a job lives in one place.

    Args:
        job_id:         The job UUID (used to namespace the logger).
        outputs_folder: Job-level outputs directory
                        (e.g. data/jobs/<job_id>/outputs/).

    Returns:
        (logger, log_file_path) — the path lets the scheduler register
        the log with JobManager for later retrieval.
    """
    logs_dir = os.path.join(outputs_folder, 'logs')
    os.makedirs(logs_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    log_path = os.path.join(logs_dir, f'ga_{timestamp}.log')

    logger_name = f'schedool.job.{job_id}'
    logger = logging.getLogger(logger_name)

    # Clear stale handlers from a previous run with the same job_id
    logger.handlers.clear()
    logger.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        '%(asctime)s [%(levelname)-8s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    file_handler = logging.FileHandler(log_path, encoding='utf-8')
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    logger.propagate = False
    return logger, log_path
