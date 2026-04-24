import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/auth/server';
import { BACKEND_BASE, BACKEND_SCHEDULE } from '@/lib/api/backend';

/**
 * POST /api/schedule/generate
 *
 * Accepts validated tab data (parsedRows per tab) and forwards it to
 * the backend scheduler as multipart/form-data CSV files.
 *
 * Request body:
 *   {
 *     sessionId: string,
 *     session:   { name: string; semester: number; year: number },
 *     data: {
 *       [tabName]: Record<string, string>[]   // parsedRows from validation
 *     }
 *   }
 *
 * Response (202):
 *   { job_id, job_name, message, status_url, result_url, download_url }
 */

const SCHEDULER_URL = BACKEND_SCHEDULE;

/**
 * Maps Thai column headers (from the Google Sheet template) to the English
 * column names expected by the scheduler API.
 */
const TAB_COLUMN_MAP: Record<string, Record<string, string>> = {
  period: {
    'คาบ': 'period_label',
    'เวลา': 'period_time',
  },
  room: {
    'room_id': 'room_id',
    'ชื่อห้อง': 'room_name',
    'ชั้นเรียนประจำ': 'class_id',
    'ประเภท': 'tags',
  },
  teacher: {
    'ชื่อ': 'teacher_name',
    'ตำแหน่ง': 'position',
    'กลุ่มสาระ': 'subject_group',
    'หมายเหตุ': 'note',
  },
  student: {
    'ชั้นเรียน': 'class_id',
    'ชั้น': 'grade',
    'ห้อง': 'section',
    'หลักสูตร': 'curriculum',
  },
  preplace: {
    'ชื่อ': 'slot_name',
    'คาบ': 'periods',
  },
  elective: {
    'รหัสวิชา': 'subject_id',
    'ชื่อวิชา (เสรี)': 'subject_name',
    'ครูผู้สอน': 'teacher',
    'ห้องเรียน': 'room',
  },
  curriculum: {
    'รหัสวิชา': 'subject_id',
    'ชื่อวิชา': 'subject_name',
    'คาบ/สัปดาห์': 'periods_per_week',
    'จำนวนห้อง': 'room_count',
    'รวมคาบ': 'total_periods',
    'ครู': 'teacher',
    'การแบ่งคาบสอน': 'block_pattern',
    'ห้อง (ชั้นเรียน) ที่สอน': 'student_class',
    'หมายเหตุ': 'note',
    'ห้องเรียน': 'room',
    'คาบเรียน': 'fixed_period',
  },
};

/** Rename Thai column keys to English for a given tab. */
function translateColumns(tabName: string, rows: Record<string, string>[]): Record<string, string>[] {
  const map = TAB_COLUMN_MAP[tabName];
  if (!map) return rows;
  return rows.map((row) => {
    const translated: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      translated[map[key] ?? key] = val;
    }
    return translated;
  });
}

/** Convert an array of row objects to a CSV string (UTF-8, quoted values). */
function rowsToCSV(rows: Record<string, string>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(',')),
  ].join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const { session, data } = await req.json();

    if (!data) {
      return NextResponse.json({ error: 'Missing data payload' }, { status: 400 });
    }

    // Build multipart form matching the scheduler API spec
    const form = new FormData();

    for (const [tabName, rows] of Object.entries(data as Record<string, Record<string, string>[]>)) {
      if (!rows || rows.length === 0) continue;
      const csv = rowsToCSV(translateColumns(tabName, rows));
      const blob = new Blob([csv], { type: 'text/csv' });
      form.append(tabName, blob, `${tabName}.csv`);
    }

    // Optional metadata fields
    if (session?.name) form.append('job_name', session.name);
    if (session?.semester != null) form.append('semester', String(session.semester));
    if (session?.year != null) form.append('academic_year', String(session.year));

    // Sync the authenticated user to the backend and pass user_id so the job is
    // associated with their account.  Failures are non-fatal.
    try {
      const authUser = await getAuthUser();
      if (authUser?.email) {
        const name = [authUser.first_name, authUser.last_name].filter(Boolean).join(' ')
                  || authUser.username || '';
        const syncRes = await fetch(`${BACKEND_BASE}/api/v1/users/sync`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: authUser.email, name }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          const backendUserId = syncData.user?.user_id;
          if (backendUserId) form.append('user_id', backendUserId);
        }
      }
    } catch {
      // Non-fatal — job will still be created, just without user association.
    }

    const upstream = await fetch(SCHEDULER_URL, {
      method: 'POST',
      body: form,
    });

    const result = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: result?.message ?? 'Scheduler error' },
        { status: upstream.status },
      );
    }

    // Rewrite download_url to go through our proxy so the browser resolves it correctly
    const proxied = {
      ...result,
      download_url: result.job_id
        ? `/api/schedule/download?job_id=${result.job_id}`
        : result.download_url,
    };
    return NextResponse.json(proxied, { status: upstream.status });
  } catch (err: unknown) {
    console.error('[/api/schedule/generate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
