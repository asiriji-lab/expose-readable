import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sheets?id=SPREADSHEET_ID
 *
 * Reads all tabs from a publicly-shared Google Sheet using the
 * Sheets CSV export endpoint (no API key required, sheet must be
 * set to "Anyone with the link can view").
 *
 * Response shape:
 *   { tabs: { [tabTitle: string]: string[][] } }
 *
 * TODO: Replace with Google Sheets API + Service Account when
 * private sheets need to be supported.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing spreadsheet id' }, { status: 400 });
  }

  try {
    // Step 1: Fetch the sheet metadata to get all tab (sheet) names and gids
    const metaUrl = `https://docs.google.com/spreadsheets/d/${id}/sheets/json/1`;
    // The public sheets feed returns JSON with sheet metadata
    const feedUrl = `https://spreadsheets.google.com/feeds/worksheets/${id}/public/full?alt=json`;

    const feedRes = await fetch(feedUrl);
    if (!feedRes.ok) {
      return NextResponse.json(
        { error: 'Cannot access spreadsheet. Make sure it is shared as "Anyone with the link can view".' },
        { status: 403 }
      );
    }

    const feedJson = await feedRes.json();
    const entries: Array<{ title: { $t: string }; id: { $t: string } }> =
      feedJson.feed.entry ?? [];

    // Step 2: For each tab, fetch CSV data
    const tabs: Record<string, string[][]> = {};

    await Promise.all(
      entries.map(async (entry) => {
        const tabTitle = entry.title.$t;

        // Extract gid from entry id URL
        const gidMatch = entry.id.$t.match(/\/(\d+)$/);
        if (!gidMatch) return;
        const gid = gidMatch[1];

        const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
        const csvRes = await fetch(csvUrl);
        if (!csvRes.ok) return;

        const csvText = await csvRes.text();
        const rows = parseCSV(csvText);
        tabs[tabTitle] = rows;
      })
    );

    return NextResponse.json({ tabs });
  } catch (err) {
    console.error('[/api/sheets]', err);
    return NextResponse.json({ error: 'Failed to fetch spreadsheet data.' }, { status: 500 });
  }
}

/**
 * Minimal CSV parser — handles quoted fields with commas and newlines.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }

  return rows;
}
