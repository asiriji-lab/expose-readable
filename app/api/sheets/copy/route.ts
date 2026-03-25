import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * POST /api/sheets/copy
 *
 * Creates a new Google Sheet with all 9 skeleton tabs using a service account,
 * shares it with the requesting admin, and returns the new sheet URL.
 *
 * Request body:
 *   { adminEmail: string, title?: string }
 *
 * Response:
 *   { spreadsheetId: string, spreadsheetUrl: string }
 */

const TAB_DEFS = [
  { name: 'period',      headers: ['period_label', 'period_time'] },
  { name: 'room',        headers: ['room_id', 'note', 'tag'] },
  { name: 'teacher',     headers: ['teacher_id', 'teacher_name', 'available_slots', 'unavailable_slots', 'constraint'] },
  { name: 'student',     headers: ['class_id', 'grade', 'section', 'default_room', 'curriculum'] },
  { name: 'preplace',    headers: ['slot_name', 'periods', 'apply_to'] },
  { name: 'scout',       headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'] },
  { name: 'elective',    headers: ['subject_id', 'subject_name', 'teacher', 'room'] },
  { name: 'curriculum',  headers: ['subject_id', 'subject_name', 'periods_per_week', 'teacher', 'block_pattern', 'student_class', 'constraint', 'room', 'fixed_period'] },
  { name: 'constraints', headers: ['slot_name', 'periods', 'apply_to'] },
];

export async function POST(req: NextRequest) {
  const { adminEmail, title } = await req.json();

  if (!adminEmail) {
    return NextResponse.json({ error: 'Missing adminEmail' }, { status: 400 });
  }

  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceEmail || !privateKey) {
    return NextResponse.json(
      { error: 'Google service account not configured.' },
      { status: 500 }
    );
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const sheetTitle = title || `Schooldoo Schedule — ${new Date().toLocaleDateString('en-GB')}`;

    // 1. Create a new spreadsheet with all 9 tabs
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: sheetTitle },
        sheets: TAB_DEFS.map((tab, i) => ({
          properties: {
            sheetId: i,
            title: tab.name,
            gridProperties: { frozenRowCount: 1 },
          },
        })),
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Failed to create spreadsheet.');
    }

    // 2. Write headers to all tabs and format them
    const headerData = TAB_DEFS.map((tab) => ({
      range: `${tab.name}!A1:${columnLetter(tab.headers.length)}1`,
      values: [tab.headers],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: headerData,
      },
    });

    // 3. Bold + color header rows
    const formatRequests = TAB_DEFS.map((tab, i) => ({
      repeatCell: {
        range: {
          sheetId: i,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: tab.headers.length,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.91, green: 0.92, blue: 0.96 }, // #E8EAF6
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    // 4. Share with admin as Editor
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: adminEmail,
      },
      sendNotificationEmail: false,
    });

    // 5. Make viewable by anyone with link (so React app can read it)
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'anyone',
        role: 'reader',
      },
    });

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return NextResponse.json({ spreadsheetId, spreadsheetUrl });
  } catch (err) {
    console.error('[/api/sheets/copy]', err);
    const message = err instanceof Error ? err.message : 'Failed to create spreadsheet.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Convert 1-based column number to letter (1→A, 26→Z) */
function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
