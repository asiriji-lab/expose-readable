// BACKEND_URL is injected at runtime via environment variable — not available
// during `npm run build`. Routes will receive a clear 500 error if unset.
export const BACKEND_BASE = (process.env.BACKEND_URL ?? '').replace(/\/$/, '');
export const BACKEND_JOBS = `${BACKEND_BASE}/api/v1/jobs`;
export const BACKEND_SCHEDULES = `${BACKEND_BASE}/api/v1/schedules`;

/** Throws with a helpful message when BACKEND_URL was not injected at startup. */
export function assertBackendConfigured(): void {
  if (!BACKEND_BASE) {
    throw new Error(
      '[ScheDool] BACKEND_URL is not set. Add it to your .env file on the VM.\n' +
      'Example: BACKEND_URL=http://localhost:5000'
    );
  }
}
