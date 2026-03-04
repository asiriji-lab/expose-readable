'use client';

/**
 * TODO: Google Sheets Integration
 *
 * Prerequisites before enabling this component:
 *  1. Create a Google Cloud Project
 *  2. Enable Google Sheets API + Google Drive API
 *  3. Create a Service Account → download JSON key
 *  4. Add key to .env.local as GOOGLE_SERVICE_ACCOUNT_KEY
 *  5. Create a Master Template Sheet with 8 tabs:
 *     period, room, teacher, student, preplace, scout, elective, curriculum
 *  6. Implement POST /api/sessions → clone template, return new spreadsheetId
 *  7. Implement GET /api/sheets?id=... → return parsed tab data
 *  8. Wire useGoogleSheet() hook in page.tsx
 *  9. Save google_sheet_id per session in Supabase
 */

interface SheetEmbedProps {
  /** Spreadsheet ID — stored per session in Supabase (future) */
  spreadsheetId?: string;
}

export default function SheetEmbed({ spreadsheetId }: SheetEmbedProps) {
  const sheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null;

  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">📊</span>
        <h2 className="font-semibold text-gray-700">Google Sheet</h2>
        <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 border border-yellow-200">
          🚧 Coming Soon
        </span>
      </div>

      <p className="text-sm text-gray-500">
        เมื่อระบบพร้อม ผู้ดูแลจะสร้าง Google Sheet อัตโนมัติต่อ Session
        และวางลิงก์ที่นี่เพื่อดึงข้อมูลทั้ง 8 แท็บโดยอัตโนมัติ
      </p>

      {/* URL Input skeleton */}
      <div className="flex gap-2">
        <input
          type="text"
          disabled
          placeholder="https://docs.google.com/spreadsheets/d/..."
          defaultValue={sheetUrl ?? ''}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 placeholder:text-gray-300 cursor-not-allowed"
        />
        <button
          disabled
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed whitespace-nowrap"
        >
          เชื่อมต่อ
        </button>
      </div>

      {/* Developer checklist */}
      <div className="rounded-lg bg-white border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Developer Checklist
        </p>
        <ol className="space-y-2 text-sm text-gray-400 list-none">
          {[
            'สร้าง Google Cloud Project + เปิดใช้ Sheets API & Drive API',
            'สร้าง Service Account → เพิ่ม GOOGLE_SERVICE_ACCOUNT_KEY ใน .env.local',
            'สร้าง Master Template Sheet (8 แท็บ)',
            'Implement POST /api/sessions → clone template, return spreadsheetId',
            'Implement GET /api/sheets?id=... → return parsed tab data',
            'บันทึก google_sheet_id ต่อ session ใน Supabase',
            'Wire useGoogleSheet() + fetchSheet() ใน page.tsx',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-gray-300 font-mono text-xs">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-gray-400">
        💡 ระหว่างรอ: Validate ผ่าน manual CSV upload ด้านล่างได้เลย
      </p>
    </div>
  );
}
