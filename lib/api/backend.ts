/**
 * Shared backend configuration for Next.js API route proxies.
 *
 * BACKEND_URL must be set — no fallback. Missing it throws on first API call.
 */
// export const BACKEND_BASE = (process.env.BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');
export const BACKEND_BASE = process.env.BACKEND_URL;
export const BACKEND_SCHEDULE = `${BACKEND_BASE}/api/v1/schedule`;
export const BACKEND_SCHEDULES = `${BACKEND_BASE}/api/v1/schedules`;
export const BACKEND_JOBS = `${BACKEND_BASE}/api/v1/jobs`;
