import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/sheets?id=SPREADSHEET_ID
 *
 * Reads all tabs from a Google Sheet using the service account.
 * The sheet must be shared with the service account email (or "Anyone with the link").
 *
 * Response shape:
 *   { tabs: { [tabTitle: string]: string[][] } }
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing spreadsheet id' }, { status: 400 });
  }

  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceEmail || !privateKey) {
    return NextResponse.json({ error: 'Google service account not configured.' }, { status: 500 });
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceEmail,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Step 1: Get spreadsheet metadata to list all sheet (tab) names
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const sheetList = meta.data.sheets ?? [];

    // Step 2: Batch-read all tabs in one request
    const ranges = sheetList.map((s) => s.properties?.title ?? '').filter(Boolean);

    if (ranges.length === 0) {
      return NextResponse.json({ tabs: {} });
    }

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: id,
      ranges,
    });

    const tabs: Record<string, string[][]> = {};
    for (const vr of batchRes.data.valueRanges ?? []) {
      // range comes back as "SheetName!A1:Z100" — extract the sheet name
      const title = vr.range?.split('!')[0].replace(/^'|'$/g, '') ?? '';
      tabs[title] = (vr.values as string[][] | undefined) ?? [];
    }

    return NextResponse.json({ tabs });
  } catch (err: unknown) {
    console.error('[/api/sheets]', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch spreadsheet data.';
    // Surface a friendlier message for permission errors
    if (message.includes('not found') || message.includes('403') || message.includes('permission')) {
      return NextResponse.json(
        { error: `Cannot access spreadsheet. Share it with the service account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}` },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}