import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = ['Code.gs', 'validators.gs', 'parsers.gs'] as const;

export async function GET() {
  try {
    const base = join(process.cwd(), 'appscript');
    const result: Record<string, string> = {};
    for (const file of FILES) {
      result[file] = readFileSync(join(base, file), 'utf-8');
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Could not read Apps Script files.' }, { status: 500 });
  }
}
