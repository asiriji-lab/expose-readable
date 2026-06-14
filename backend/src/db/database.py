"""
================================================================================
SCHEDOOL - Database Engine (SQLAlchemy ORM)
================================================================================

Holds the shared SQLAlchemy ``db`` instance (Flask-SQLAlchemy) and exposes a
small surface area used across the rest of the application:

    ``db``            — the SQLAlchemy extension object (import this to define /
                        query models)
    ``init_db(app)``  — call once at startup; connects, creates tables, sets the
                        availability flag
    ``is_available()``— True after a successful ``init_db``; used as a guard
                        before any DB operation
    ``close_all()``   — no-op; Flask-SQLAlchemy manages the connection pool
                        automatically

Usage
-----
At application startup (inside the app factory)::

    from src.db import database
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    database.init_db(app)

Anywhere else::

    from src.db import database
    if database.is_available():
        # safe to use the ORM
        ...

Or use the models layer, which calls ``is_available()`` automatically via the
``@_guard`` decorator in ``src/db/models.py``.
================================================================================
"""

import logging
from flask_sqlalchemy import SQLAlchemy

logger = logging.getLogger(__name__)

# Shared SQLAlchemy extension — import this in orm_models.py and models.py
db = SQLAlchemy()

# Set to True once init_db() succeeds
_available = False


def init_db(app) -> bool:
    """
    Bind the SQLAlchemy extension to *app*, then create all tables that do not
    yet exist (idempotent — safe to call on every startup).

    ``app.config['SQLALCHEMY_DATABASE_URI']`` must be set before calling this.

    Args:
        app: The Flask application instance.

    Returns:
        True on success, False if the database is unreachable so the
        application can continue running in file-only mode.
    """
    global _available
    try:
        db.init_app(app)
        with app.app_context():
            db.create_all()
        _available = True
        logger.info("SQLAlchemy ORM initialised — all tables are ready.")
        return True
    except Exception as exc:
        logger.warning(
            "Database unavailable — running without PostgreSQL. (%s: %s)",
            type(exc).__name__,
            exc,
        )
        _available = False
        return False


def is_available() -> bool:
    """Return True if the ORM was successfully initialised."""
    return _available


def close_all() -> None:
    """
    No-op — Flask-SQLAlchemy manages the underlying connection pool
    automatically (connections are returned to the pool after each request
    and released on app teardown).
    """
