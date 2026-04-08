/**
 * Shared backend configuration for Next.js API route proxies.
 *
 * Set BACKEND_URL in .env.local to override (defaults to localhost:5000).
 */
export const BACKEND_BASE = (process.env.BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export const BACKEND_SCHEDULE = `${BACKEND_BASE}/api/v1/schedule`;
export const BACKEND_JOBS = `${BACKEND_BASE}/api/v1/jobs`;
