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
  { name: 'period',      headers: ['คาบ', 'เวลา'] },
  { name: 'room',        headers: ['ห้องทั้งหมด', 'หมายเหตุ', 'ประเภท'] },
  { name: 'teacher',     headers: ['teacher_id', 'ตำแหน่ง', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ'] },
  { name: 'student',     headers: ['นักเรียน', 'ชั้น', 'ห้อง', 'ห้องประจำ', 'หลักสูตร'] },
  { name: 'preplace',    headers: ['ชื่อ', 'คาบ', 'apply_to'] },
  { name: 'scout',       headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'] },
  { name: 'elective',    headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'เสรีม.ต้น1', 'เสรีม.ต้น2', 'เสรีม.ปลาย1', 'เสรีม.ปลาย2', 'เสรีม.ปลาย3', 'เสรีม.ปลาย4', 'เสรีม.ปลาย5', 'เสรีม.ปลาย6'] },
  { name: 'curriculum',  headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'จำนวนห้อง', 'รวมคาบ', 'ครู', 'การแบ่งคาบสอน', 'ห้อง (นักเรียน) ที่สอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน'] },
  { name: 'constraints', headers: ['id', 'Name', 'Type', 'description', 'Note', 'parameters (example)', 'Example Constraints'] },
];

export async function POST(req: NextRequest) {
  const { userEmail, title } = await req.json();

  // SCHEDOOL_ADMIN_EMAIL: the central admin account that owns all created sheets
  // GOOGLE_SERVICE_ACCOUNT_EMAIL: service account used to create the sheet via API
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const schedoolAdminEmail = process.env.SCHEDOOL_ADMIN_EMAIL; // placeholder: set this in .env.local

  if (!serviceEmail || !privateKey) {
    return NextResponse.json(
      { error: 'Google service account not configured.' },
      { status: 500 }
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth: auth as any });
    const drive = google.drive({ version: 'v3', auth: auth as any });
    const sheetTitle = title || `Schooldoo Schedule — ${new Date().toLocaleDateString('en-GB')}`;

    // 1. Create blank spreadsheet via Drive API
    const driveCreate = await drive.files.create({
      requestBody: {
        name: sheetTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      fields: 'id',
    });

    const spreadsheetId = driveCreate.data.id;
    if (!spreadsheetId) {
      throw new Error('Failed to create spreadsheet.');
    }

    // 1b. Add tabs and set frozen headers
    const addTabRequests = TAB_DEFS.map((tab) => ({
      addSheet: {
        properties: {
          title: tab.name,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));
    // Delete the default "Sheet1"
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const defaultSheetId = meta.data.sheets?.[0]?.properties?.sheetId;

    const batchReply = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          ...addTabRequests,
          ...(defaultSheetId !== undefined ? [{ deleteSheet: { sheetId: defaultSheetId } }] : []),
        ],
      },
    });

    // Capture the sheetId of the first tab (period) so we can deep-link to it
    const periodGid = batchReply.data.replies?.[0]?.addSheet?.properties?.sheetId;

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

    // 4. Share: SCHEDOOL_ADMIN_EMAIL becomes owner, userEmail gets editor access
    if (schedoolAdminEmail) {
      try {
        const adminPerm = await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: schedoolAdminEmail,
          },
          sendNotificationEmail: false,
          fields: 'id',
        });
        // Transfer ownership to the central admin account
        await drive.permissions.update({
          fileId: spreadsheetId,
          permissionId: adminPerm.data.id!,
          transferOwnership: true,
          requestBody: { role: 'owner' },
        });
      } catch {
        // Transfer may fail for non-Workspace accounts — admin still has writer access
      }
    }

    // Give the requesting user editor access
    if (userEmail) {
      try {
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: userEmail,
          },
          sendNotificationEmail: false,
          fields: 'id',
        });
      } catch {
        // Non-fatal — sheet is still usable
      }
    }

    // 5. Make viewable by anyone with link (so React app can read it)
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { type: 'anyone', role: 'reader' },
      });
    } catch {
      // Drive sharing failed — sheet still usable if admin has access
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${periodGid != null ? `#gid=${periodGid}` : ''}`;

    // 6. Link the bound Apps Script project (if GOOGLE_APPS_SCRIPT_ID is configured)
    // Placeholder: set GOOGLE_APPS_SCRIPT_ID in .env.local to the deployed script ID
    // When configured, this attaches the existing script project to the new spreadsheet
    // via the Apps Script API so it runs automatically in context.
    const scriptId = process.env.GOOGLE_APPS_SCRIPT_ID;
    if (scriptId) {
      // NOTE: Full programmatic binding requires the Apps Script API with
      // projects.create({ parentId: spreadsheetId }). This placeholder logs the
      // intent — implement with @googleapis/script when the script project is set up.
      console.log(`[sheets/copy] TODO: bind script ${scriptId} to sheet ${spreadsheetId}`);
    }

    return NextResponse.json({ spreadsheetId, spreadsheetUrl, scriptId: scriptId ?? null });
  } catch (err: any) {
    console.error('[/api/sheets/copy] Full error:', JSON.stringify(err?.response?.data || err?.errors || err?.message, null, 2));
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
