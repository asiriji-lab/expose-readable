"""
================================================================================
SCHEDOOL - SQLAlchemy ORM Models
================================================================================

Declarative model definitions for the three core tables:

    Organization  — tenants (schools / institutions)
    User          — individual accounts
    Schedule      — one row per scheduling job (schedule_id == API job_id)

Each model exposes a ``to_dict()`` method that returns a JSON-serialisable
dict.  The ``Schedule`` model accepts an optional ``include_data`` flag to
omit the large JSONB ``data`` column from list responses.

Relationships
-------------
    Organization.users      → dynamic query for related User rows
    Organization.schedules  → dynamic query for related Schedule rows
    User.schedules          → dynamic query for related Schedule rows

``updated_at`` is set automatically by SQLAlchemy's ``onupdate`` hook on
every client-side UPDATE, so no database trigger is required.
================================================================================
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .database import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

class Organization(db.Model):
    """A school or institution that owns scheduling jobs."""

    __tablename__ = 'organizations'

    org_id     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name       = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    users     = relationship('User',     back_populates='organization', lazy='dynamic')
    schedules = relationship('Schedule', back_populates='organization', lazy='dynamic')

    def to_dict(self) -> dict:
        return {
            'org_id':     str(self.org_id),
            'name':       self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(db.Model):
    """An individual account that can submit scheduling jobs."""

    __tablename__ = 'users'

    user_id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id        = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.org_id', ondelete='SET NULL'),
        nullable=True,
    )
    email         = Column(String(255), nullable=False, unique=True)
    username      = Column(String(255), nullable=True,  unique=True)
    role          = Column(String(50),  nullable=False)
    first_name    = Column(String(255), nullable=True)
    last_name     = Column(String(255), nullable=True)
    name          = Column(String(255), nullable=True)
    # Stores a Werkzeug/bcrypt hash; NULL means the account has no password (API-only)
    password_hash = Column(String(255), nullable=True)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at    = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    organization = relationship('Organization', back_populates='users')
    schedules    = relationship('Schedule',     back_populates='user', lazy='dynamic')

    def to_dict(self) -> dict:
        """Return a dict suitable for JSON serialisation (password_hash excluded)."""
        return {
            'user_id':    str(self.user_id),
            'org_id':     str(self.org_id) if self.org_id else None,
            'email':      self.email,
            'username':   self.username,
            'role':       self.role,
            'first_name': self.first_name,
            'last_name':  self.last_name,
            'name':       self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------

class Schedule(db.Model):
    """
    One row per scheduling job.

    ``schedule_id`` is identical to the API ``job_id`` UUID so no mapping is
    needed between the two systems.  The ``data`` column stores the full
    ``schedule.json`` content as JSONB and can be several MB for large schools
    — it is excluded from list responses by default (pass ``include_data=True``
    to ``to_dict()`` when you need it).
    """

    __tablename__ = 'schedules'

    schedule_id   = Column(UUID(as_uuid=True), primary_key=True)
    org_id        = Column(
        UUID(as_uuid=True),
        ForeignKey('organizations.org_id', ondelete='SET NULL'),
        nullable=True,
    )
    user_id       = Column(
        UUID(as_uuid=True),
        ForeignKey('users.user_id', ondelete='SET NULL'),
        nullable=True,
    )
    job_name      = Column(String(255), nullable=True)
    academic_year = Column(String(10),  nullable=True)
    semester      = Column(Integer,     nullable=True)
    status        = Column(String(50),  nullable=False, default='created')
    progress      = Column(Float,       nullable=False, default=0.0)
    # Reserved for a future Google Sheets integration
    sheet_url     = Column(Text, nullable=True)
    # Full schedule output (schedule.json content); populated on completion
    data          = Column(JSONB, nullable=True)
    # GA configuration used for this run
    ga_params     = Column(JSONB, nullable=True)
    error         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at    = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationships
    organization = relationship('Organization', back_populates='schedules')
    user         = relationship('User',         back_populates='schedules')

    def to_dict(self, include_data: bool = False) -> dict:
        """
        Return a JSON-serialisable dict.

        Args:
            include_data: When True, include the full JSONB ``data`` column
                          (the complete schedule output).  Defaults to False
                          because the payload can be very large.
        """
        d = {
            'schedule_id':   str(self.schedule_id),
            'org_id':        str(self.org_id)  if self.org_id  else None,
            'user_id':       str(self.user_id) if self.user_id else None,
            'job_name':      self.job_name,
            'academic_year': self.academic_year,
            'semester':      self.semester,
            'status':        self.status,
            'progress':      self.progress,
            'sheet_url':     self.sheet_url,
            'ga_params':     self.ga_params,
            'error':         self.error,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_data:
            d['data'] = self.data
        return d
