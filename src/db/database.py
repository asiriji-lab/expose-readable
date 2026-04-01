"""
================================================================================
SCHEDOOL - Database Connection Pool
================================================================================

Manages a psycopg2 ThreadedConnectionPool so the Flask app and background
scheduling threads share a single pool.

Usage:
    # At application startup:
    from src.db import database
    database.init_db(app.config['DATABASE_URL'])

    # In any module (routes, scheduler, …):
    from src.db import database
    if database.is_available():
        conn = database.get_conn()
        try:
            ...
        finally:
            database.put_conn(conn)

    # Or use the models layer which handles acquire/release automatically.
================================================================================
"""

import os
import logging

logger = logging.getLogger(__name__)

# Module-level pool — None until init_db() succeeds.
_pool = None


def init_db(database_url: str) -> bool:
    """
    Initialise the connection pool and apply the schema.

    If the database is unreachable, logs a warning and returns False so the
    application can continue running in file-only mode.

    Args:
        database_url: Standard libpq connection string or DSN URI,
                      e.g. ``postgresql://user:pass@host:5432/dbname``.

    Returns:
        True on success, False if the database is unavailable.
    """
    global _pool
    try:
        import psycopg2
        from psycopg2 import pool as pg_pool

        _pool = pg_pool.ThreadedConnectionPool(1, 10, database_url)
        _apply_schema()
        logger.info("PostgreSQL connection pool initialised (min=1, max=10).")
        return True
    except Exception as exc:
        logger.warning(
            "Database unavailable — running without PostgreSQL. (%s: %s)",
            type(exc).__name__,
            exc,
        )
        _pool = None
        return False


def is_available() -> bool:
    """Return True if the connection pool is ready."""
    return _pool is not None


def get_conn():
    """Acquire a connection from the pool. Raises RuntimeError if not initialised."""
    if _pool is None:
        raise RuntimeError("Database not initialised — call init_db() first.")
    return _pool.getconn()


def put_conn(conn) -> None:
    """Return a connection to the pool."""
    if _pool is not None and conn is not None:
        _pool.putconn(conn)


def close_all() -> None:
    """Close all connections in the pool (call on application shutdown)."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        logger.info("PostgreSQL connection pool closed.")


# ---------------------------------------------------------------------------
# Internal: schema bootstrap
# ---------------------------------------------------------------------------

def _apply_schema() -> None:
    """Execute schema.sql against the database (idempotent)."""
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r', encoding='utf-8') as fh:
        sql = fh.read()

    conn = _pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        logger.info("Database schema applied successfully.")
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
