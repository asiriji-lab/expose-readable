import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/auth/server';

/**
 * POST /api/sheets/copy
 *
 * Acts as a secure messenger between the Dashboard and the Google Apps Script.
 * Email is read from the server-side auth cookie — not from the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    const authUser = await getAuthUser();
    const userEmail = authUser?.email ?? null;
    const gasUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!gasUrl) {
      return NextResponse.json(
        { error: 'Google Apps Script URL not configured in .env.local' },
        { status: 500 }
      );
    }

    // Proxy the request to the Google Apps Script Web App
    // Fixed: Passing 'userEmail' instead of 'email' to match the GAS doPost logic.
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: userEmail, 
        title: title 
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to duplicate template');
    }

    return NextResponse.json({ 
      spreadsheetId: data.spreadsheetId, 
      spreadsheetUrl: data.url,
      message: 'One-click workspace generated successfully.'
    });

  } catch (err: any) {
    console.error('[/api/sheets/copy] Bridge Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Server-side error during sheet generation.' },
      { status: 500 }
    );
  }
}
