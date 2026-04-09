-- ============================================================================
-- Schedool Database Schema
-- ============================================================================
--
-- Three core tables:
--   organizations  → tenants / schools that own scheduling jobs
--   users          → individuals who submit scheduling requests
--   schedules      → one row per scheduling job (schedule_id = job UUID)
--
-- The schema is idempotent (IF NOT EXISTS / CREATE OR REPLACE) so it can
-- be re-run safely on every application start.
-- ============================================================================

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    org_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID         REFERENCES organizations(org_id) ON DELETE SET NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    username      VARCHAR(255) UNIQUE,
    role          VARCHAR(50)  NOT NULL DEFAULT 'student',
    first_name    VARCHAR(255),
    last_name     VARCHAR(255),
    name          VARCHAR(255),
    password_hash VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add profile columns to existing tables (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username   VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role       VARCHAR(50)  NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  VARCHAR(255);

-- ----------------------------------------------------------------------------
-- schedules
-- ----------------------------------------------------------------------------
-- schedule_id is the same UUID as the API job_id so cross-referencing is trivial.
-- sheet_url   is reserved for a future Google Sheets integration; left blank now.
-- data        stores the complete schedule output (schedule.json content) as JSONB.
-- ga_params   stores the GA configuration used for this run.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
    schedule_id   UUID         PRIMARY KEY,
    org_id        UUID         REFERENCES organizations(org_id) ON DELETE SET NULL,
    user_id       UUID         REFERENCES users(user_id)        ON DELETE SET NULL,
    job_name      VARCHAR(255),
    academic_year VARCHAR(10),
    semester      INTEGER,
    status        VARCHAR(50)  NOT NULL DEFAULT 'created',
    progress      FLOAT        NOT NULL DEFAULT 0,
    sheet_url     TEXT,
    data          JSONB,
    ga_params     JSONB,
    error         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Auto-update updated_at on row modification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _schedool_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- organizations trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_organizations_updated_at'
    ) THEN
        CREATE TRIGGER trg_organizations_updated_at
            BEFORE UPDATE ON organizations
            FOR EACH ROW EXECUTE FUNCTION _schedool_set_updated_at();
    END IF;
END;
$$;

-- users trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_users_updated_at'
    ) THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION _schedool_set_updated_at();
    END IF;
END;
$$;

-- schedules trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_schedules_updated_at'
    ) THEN
        CREATE TRIGGER trg_schedules_updated_at
            BEFORE UPDATE ON schedules
            FOR EACH ROW EXECUTE FUNCTION _schedool_set_updated_at();
    END IF;
END;
$$;
