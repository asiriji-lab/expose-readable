if (!process.env.BACKEND_URL) {
  throw new Error(
    '[ScheDool] BACKEND_URL is not set.\n' +
    'Add BACKEND_URL=http://localhost:5000 to your .env.local file.'
  );
}
export const BACKEND_BASE = process.env.BACKEND_URL.replace(/\/$/, '');
export const BACKEND_JOBS = `${BACKEND_BASE}/api/v1/jobs`;
export const BACKEND_SCHEDULES = `${BACKEND_BASE}/api/v1/schedules`;
