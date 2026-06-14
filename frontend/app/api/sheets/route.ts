import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get('id');

  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Missing spreadsheet id.' }, { status: 400 });
  }

  const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!gasUrl) {
    return NextResponse.json(
      { error: 'Google Apps Script URL not configured in .env.local' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'read_sheet',
        spreadsheetId: spreadsheetId
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to read spreadsheet from proxy');
    }

    return NextResponse.json({ data: data.data });
  } catch (err: any) {
    console.error('[/api/sheets] Proxy Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Server-side error reading spreadsheet.' },
      { status: 500 }
    );
  }
}