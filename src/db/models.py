"""
================================================================================
SCHEDOOL - Database CRUD Operations
================================================================================

Thin data-access layer over the three core tables:
  organizations, users, schedules.

Every public function returns plain dicts (or lists of dicts) so callers
never handle psycopg2 row objects directly.  datetime / UUID values are
serialised to strings automatically.

All functions are no-ops (return None / []) when the database is not
available, so the rest of the application degrades gracefully.
================================================================================
"""

import json
import logging
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from . import database

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _serialize(value: Any) -> Any:
    """Convert psycopg2-specific types to JSON-safe Python primitives."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _row_to_dict(description, row) -> Dict:
    cols = [col.name for col in description]
    return {col: _serialize(val) for col, val in zip(cols, row)}


@contextmanager
def _conn():
    """
    Context manager that acquires a connection, commits on exit, and
    rolls back + releases on exception.
    """
    conn = database.get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        database.put_conn(conn)


def _guard(func):
    """
    Decorator that short-circuits the function and returns None when the
    database is not available, logging a debug message instead of raising.
    """
    import functools

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not database.is_available():
            logger.debug("DB not available — skipping %s()", func.__name__)
            return None
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            logger.error("DB error in %s(): %s", func.__name__, exc)
            return None

    return wrapper


# ---------------------------------------------------------------------------
# organizations
# ---------------------------------------------------------------------------

@_guard
def create_organization(name: str) -> Optional[Dict]:
    """
    Insert a new organization.

    Args:
        name: Unique display name for the organization.

    Returns:
        The newly created row as a dict, or None on error.
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO organizations (name) VALUES (%s) RETURNING *",
                (name,),
            )
            return _row_to_dict(cur.description, cur.fetchone())


@_guard
def get_organization(org_id: str) -> Optional[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM organizations WHERE org_id = %s", (org_id,)
            )
            row = cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None


@_guard
def list_organizations() -> List[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM organizations ORDER BY created_at DESC")
            desc = cur.description
            return [_row_to_dict(desc, row) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------

@_guard
def create_user(
    email: str,
    name: Optional[str] = None,
    org_id: Optional[str] = None,
) -> Optional[Dict]:
    """
    Insert a new user.

    Args:
        email:  Unique e-mail address.
        name:   Display name (optional).
        org_id: UUID of the user's organization (optional).

    Returns:
        The newly created row as a dict, or None on error.
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (email, name, org_id)
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (email, name, org_id or None),
            )
            return _row_to_dict(cur.description, cur.fetchone())


@_guard
def get_user(user_id: str) -> Optional[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None


@_guard
def list_users(org_id: Optional[str] = None) -> List[Dict]:
    with _conn() as conn:
        with conn.cursor() as cur:
            if org_id:
                cur.execute(
                    "SELECT * FROM users WHERE org_id = %s ORDER BY created_at DESC",
                    (org_id,),
                )
            else:
                cur.execute("SELECT * FROM users ORDER BY created_at DESC")
            desc = cur.description
            return [_row_to_dict(desc, row) for row in cur.fetchall()]


# ---------------------------------------------------------------------------
# schedules
# ---------------------------------------------------------------------------

@_guard
def create_schedule(
    schedule_id: str,
    job_name: str,
    academic_year: str,
    semester: int,
    ga_params: Dict,
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Optional[Dict]:
    """
    Insert a schedule row at the moment the API job is created.

    Args:
        schedule_id:   The job UUID (same value used throughout the API).
        job_name:      Human-readable label.
        academic_year: e.g. "2026".
        semester:      1 or 2.
        ga_params:     Raw GA parameter dict stored as JSONB.
        org_id:        Optional owning organization UUID.
        user_id:       Optional submitting user UUID.

    Returns:
        The newly created row (without the data column), or None on error.
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO schedules
                    (schedule_id, org_id, user_id, job_name,
                     academic_year, semester, ga_params)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING schedule_id, org_id, user_id, job_name,
                          academic_year, semester, status, progress,
                          sheet_url, ga_params, error, created_at, updated_at
                """,
                (
                    schedule_id,
                    org_id or None,
                    user_id or None,
                    job_name,
                    academic_year or None,
                    semester,
                    json.dumps(ga_params),
                ),
            )
            return _row_to_dict(cur.description, cur.fetchone())


@_guard
def update_schedule_status(
    schedule_id: str,
    status: str,
    progress: Optional[float] = None,
    error: Optional[str] = None,
) -> None:
    """Update the status (and optionally progress / error) of a schedule row."""
    with _conn() as conn:
        with conn.cursor() as cur:
            if progress is not None:
                cur.execute(
                    "UPDATE schedules SET status = %s, progress = %s WHERE schedule_id = %s",
                    (status, progress, schedule_id),
                )
            else:
                cur.execute(
                    "UPDATE schedules SET status = %s WHERE schedule_id = %s",
                    (status, schedule_id),
                )
            if error is not None:
                cur.execute(
                    "UPDATE schedules SET error = %s WHERE schedule_id = %s",
                    (error, schedule_id),
                )


@_guard
def complete_schedule(schedule_id: str, data: Dict) -> None:
    """
    Mark the schedule as completed and store the full schedule JSON output.

    Args:
        schedule_id: The job UUID.
        data:        The schedule output dict (content of schedule.json).
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE schedules
                SET status   = 'completed',
                    progress = 100,
                    data     = %s
                WHERE schedule_id = %s
                """,
                (json.dumps(data), schedule_id),
            )


@_guard
def fail_schedule(schedule_id: str, error: str) -> None:
    """Mark a schedule as failed and store the error message."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE schedules
                SET status = 'failed', error = %s
                WHERE schedule_id = %s
                """,
                (error, schedule_id),
            )


@_guard
def get_schedule(schedule_id: str) -> Optional[Dict]:
    """
    Retrieve a single schedule row including the full data JSONB column.

    Returns:
        Dict with all columns, or None if not found.
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM schedules WHERE schedule_id = %s", (schedule_id,)
            )
            row = cur.fetchone()
            return _row_to_dict(cur.description, row) if row else None


@_guard
def list_schedules(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Dict]:
    """
    List schedules (excludes the large data column for efficiency).

    Args:
        org_id:  Filter by organization (optional).
        user_id: Filter by user (optional).

    Returns:
        List of dicts ordered newest-first.
    """
    cols = (
        "schedule_id, org_id, user_id, job_name, academic_year, semester, "
        "status, progress, sheet_url, ga_params, error, created_at, updated_at"
    )
    with _conn() as conn:
        with conn.cursor() as cur:
            if org_id:
                cur.execute(
                    f"SELECT {cols} FROM schedules WHERE org_id = %s ORDER BY created_at DESC",
                    (org_id,),
                )
            elif user_id:
                cur.execute(
                    f"SELECT {cols} FROM schedules WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,),
                )
            else:
                cur.execute(
                    f"SELECT {cols} FROM schedules ORDER BY created_at DESC"
                )
            desc = cur.description
            return [_row_to_dict(desc, row) for row in cur.fetchall()]
