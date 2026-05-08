"""
================================================================================
SCHEDOOL - Database CRUD Operations (SQLAlchemy ORM)
================================================================================

Thin data-access layer over the three ORM models:
    Organization, User, Schedule  (defined in orm_models.py)

Every public function returns plain dicts (or lists of dicts) so callers
never handle ORM objects directly.

All functions are no-ops (return None / []) when the database is not
available — the ``@_guard`` decorator handles this transparently, keeping all
callers free of try/except boilerplate.

New helpers added for auth and richer metadata queries:
    get_user_by_email()      — look up a user by e-mail address
    get_user_orm()           — return the raw ORM User object (for password check)
    get_user_schedules()     — schedules submitted by a specific user
    get_org_schedules()      — schedules belonging to an organisation
================================================================================
"""

import logging
import uuid
from functools import wraps
from typing import Dict, List, Optional

from sqlalchemy.orm.attributes import flag_modified

from .database import db, is_available
from .orm_models import Organization, User, Schedule

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _guard(func):
    """
    Decorator that short-circuits the function and returns None when the
    database is not available, logging a debug message instead of raising.
    Also rolls back any in-flight transaction on unexpected errors.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not is_available():
            logger.debug("DB not available — skipping %s()", func.__name__)
            return None
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            logger.error("DB error in %s(): %s", func.__name__, exc)
            db.session.rollback()
            return None
    return wrapper


def _parse_uuid(value: Optional[str]) -> Optional[uuid.UUID]:
    """Convert a UUID string to a uuid.UUID, returning None if falsy or invalid."""
    if not value:
        return None
    try:
        parsed = uuid.UUID(str(value))
        if parsed.version != 4:
            return None
        return parsed
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# organizations
# ---------------------------------------------------------------------------

@_guard
def create_organization(name: str, registration_key: str) -> Optional[Dict]:
    """
    Insert a new organization.

    Args:
        name:             Unique display name for the organization.
        registration_key: Secret key admins submit to register under this org.

    Returns:
        The newly created row as a dict, or None on error.
    """
    org = Organization(name=name, registration_key=registration_key.upper())
    db.session.add(org)
    db.session.commit()
    return org.to_dict()


@_guard
def get_organization(org_id: str) -> Optional[Dict]:
    """Return a single organization by UUID, or None if not found."""
    org = db.session.get(Organization, _parse_uuid(org_id))
    return org.to_dict() if org else None


@_guard
def get_org_by_registration_key(key: str) -> Optional[Dict]:
    """Return org whose registration_key matches, or None. Key stored and compared uppercase."""
    org = Organization.query.filter_by(registration_key=key.upper()).first()
    return org.to_dict() if org else None


@_guard
def list_organizations() -> List[Dict]:
    """Return all organizations ordered newest-first."""
    orgs = Organization.query.order_by(Organization.created_at.desc()).all()
    return [o.to_dict() for o in orgs]


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------

@_guard
def create_user(
    email: str,
    role: str,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    name: Optional[str] = None,
    org_id: Optional[str] = None,
    password_hash: Optional[str] = None,
) -> Optional[Dict]:
    """
    Insert a new user.

    Args:
        email:         Unique e-mail address.
        role:          Account role — 'admin', 'teacher', or 'student'.
        username:      Unique username (optional).
        first_name:    Given name (optional).
        last_name:     Family name (optional).
        name:          Legacy display name (optional).
        org_id:        UUID of the user's organization (optional).
        password_hash: Pre-hashed password string for auth (optional).

    Returns:
        The newly created row as a dict (password_hash excluded), or None on error.
    """
    user = User(
        email=email,
        role=role,
        username=username or None,
        first_name=first_name or None,
        last_name=last_name or None,
        name=name or None,
        org_id=_parse_uuid(org_id),
        password_hash=password_hash,
    )
    db.session.add(user)
    db.session.commit()
    return user.to_dict()


@_guard
def get_user(user_id: str) -> Optional[Dict]:
    """Return a single user by UUID, or None if not found."""
    user = db.session.get(User, _parse_uuid(user_id))
    return user.to_dict() if user else None


@_guard
def set_user_org(user_id: str, org_id: str) -> Optional[Dict]:
    """Set org_id on an existing user. Returns updated user dict or None."""
    user = db.session.get(User, _parse_uuid(user_id))
    if not user:
        return None
    user.org_id = _parse_uuid(org_id)
    db.session.commit()
    return user.to_dict()


@_guard
def get_user_by_email(email: str) -> Optional[Dict]:
    """Return a single user by e-mail address, or None if not found."""
    user = User.query.filter(User.email.ilike(email)).first()
    return user.to_dict() if user else None


@_guard
def get_user_orm(email: str) -> Optional[User]:
    """
    Return the raw ORM User object for the given e-mail.

    Unlike other functions this returns the ORM instance (not a dict) so the
    caller can access ``user.password_hash`` for authentication.  Returns None
    if the e-mail is not found or the database is unavailable.
    """
    return User.query.filter_by(email=email).first()


@_guard
def list_users(org_id: Optional[str] = None) -> List[Dict]:
    """
    List users.

    Args:
        org_id: Optional UUID string — when provided, filters to that org only.

    Returns:
        List of user dicts ordered newest-first.
    """
    q = User.query
    if org_id:
        q = q.filter_by(org_id=_parse_uuid(org_id))
    return [u.to_dict() for u in q.order_by(User.created_at.desc()).all()]


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
    sheet_url: Optional[str] = None,
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
    sched = Schedule(
        schedule_id=uuid.UUID(schedule_id),
        job_name=job_name,
        academic_year=academic_year or None,
        semester=semester,
        ga_params=ga_params,
        org_id=_parse_uuid(org_id),
        user_id=_parse_uuid(user_id),
        sheet_url=sheet_url or None,
    )
    db.session.add(sched)
    db.session.commit()
    return sched.to_dict()


@_guard
def update_schedule_status(
    schedule_id: str,
    status: str,
    progress: Optional[float] = None,
    error: Optional[str] = None,
) -> None:
    """Update the status (and optionally progress / error) of a schedule row."""
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return
    sched.status = status
    if progress is not None:
        sched.progress = progress
    if error is not None:
        sched.error = error
    db.session.commit()


@_guard
def complete_schedule(schedule_id: str, data: Dict,
                      entity_meta: Optional[Dict] = None) -> None:
    """
    Mark the schedule as completed and store the full schedule JSON output.

    Args:
        schedule_id: The job UUID.
        data:        The schedule output dict (content of schedule.json).
        entity_meta: Entity metadata computed from input CSVs (optional).
    """
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return
    sched.status = 'completed'
    sched.progress = 100.0
    sched.data = data
    flag_modified(sched, 'data')
    if entity_meta is not None:
        sched.entity_meta = entity_meta
        flag_modified(sched, 'entity_meta')
    db.session.commit()


@_guard
def fail_schedule(schedule_id: str, error: str) -> None:
    """Mark a schedule as failed and store the error message."""
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return
    sched.status = 'failed'
    sched.error = error
    db.session.commit()


@_guard
def get_schedule(schedule_id: str) -> Optional[Dict]:
    """
    Retrieve a single schedule row including the full data JSONB column.

    Returns:
        Dict with all columns (including data), or None if not found.
    """
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    return sched.to_dict(include_data=True) if sched else None


@_guard
def list_schedules(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
) -> List[Dict]:
    """
    List schedules (excludes the large data column for efficiency).

    Args:
        org_id:  Filter by organization (optional).
        user_id: Filter by user (optional).
        status:  Filter by status string e.g. "completed" (optional).

    Returns:
        List of dicts ordered newest-first.
    """
    q = Schedule.query
    if org_id:
        q = q.filter_by(org_id=_parse_uuid(org_id))
    if user_id:
        q = q.filter_by(user_id=_parse_uuid(user_id))
    if status:
        q = q.filter_by(status=status)
    return [s.to_dict() for s in q.order_by(Schedule.created_at.desc()).all()]


@_guard
def get_user_schedules(user_id: str) -> List[Dict]:
    """
    Return all schedules submitted by a specific user.

    Args:
        user_id: UUID string of the user.

    Returns:
        List of schedule dicts ordered newest-first (data column excluded).
    """
    scheds = (
        Schedule.query
        .filter_by(user_id=_parse_uuid(user_id))
        .order_by(Schedule.created_at.desc())
        .all()
    )
    return [s.to_dict() for s in scheds]


_NON_TERMINAL = {'created', 'queued', 'loading_data', 'running_ga', 'exporting'}


@_guard
def reconcile_interrupted_jobs() -> int:
    """
    Mark all non-terminal jobs as failed.

    Called once at startup to clean up jobs that were in-flight when the
    server last stopped. Returns the count of rows updated.
    """
    rows = (
        db.session.query(Schedule)
        .filter(Schedule.status.in_(_NON_TERMINAL))
        .all()
    )
    for sched in rows:
        sched.status = 'failed'
        sched.error = 'Job interrupted: server restarted'
    if rows:
        db.session.commit()
    return len(rows)


@_guard
def update_schedule_job_name(schedule_id: str, job_name: str) -> None:
    """Update the job_name of a schedule record."""
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return
    sched.job_name = job_name
    db.session.commit()


@_guard
def update_entity_meta(schedule_id: str, entity_meta: Dict) -> None:
    """
    Update only the entity_meta column without touching data or status.

    Used when the frontend computes and pushes entity_meta separately from
    a full schedule save (e.g. first load after generation, or PUT with only
    entity_meta in the body).
    """
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return
    sched.entity_meta = entity_meta
    flag_modified(sched, 'entity_meta')
    db.session.commit()


def save_manual_edit(schedule_id: str, data: Dict, entity_meta: Optional[Dict] = None) -> None:
    """
    Persist manually-edited schedule data from the frontend.

    Unlike complete_schedule(), this function raises on any error so the
    caller (PUT route) can return a proper 500 instead of silently returning
    success while the DB write was rolled back.
    """
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        raise ValueError(f"Schedule {schedule_id} not found")
    sched.data = data
    flag_modified(sched, 'data')
    if entity_meta is not None:
        sched.entity_meta = entity_meta
        flag_modified(sched, 'entity_meta')
    db.session.commit()


@_guard
def delete_schedule(schedule_id: str) -> bool:
    """
    Delete a schedule record from the database.

    Returns True if deleted, False if not found.
    """
    sched = db.session.get(Schedule, uuid.UUID(schedule_id))
    if not sched:
        return False
    db.session.delete(sched)
    db.session.commit()
    return True


@_guard
def get_org_schedules(org_id: str) -> List[Dict]:
    """
    Return all schedules belonging to a specific organization.

    Args:
        org_id: UUID string of the organization.

    Returns:
        List of schedule dicts ordered newest-first (data column excluded).
    """
    scheds = (
        Schedule.query
        .filter_by(org_id=_parse_uuid(org_id))
        .order_by(Schedule.created_at.desc())
        .all()
    )
    return [s.to_dict() for s in scheds]
