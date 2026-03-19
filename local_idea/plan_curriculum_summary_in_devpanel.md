# Plan: Curriculum Summary in DevTestPanel

## Goal
When the `curriculum` CSV is loaded in DevTestPanel, parse it and show an inline verification summary so admins can confirm the workload mapping is correct before proceeding.

## Files to modify
- `app/(admin)/dashboard/[id]/_components/DevTestPanel.tsx` — add summary section
- `app/(admin)/schedule/_utils/parseCurriculum.ts` — already exists, import from here

## Files for reference (read-only)
- `app/(admin)/schedule/_utils/dummyData.ts` — has `TEACHER_META`, `WorkloadEntry` type
- `scripts/testParseCurriculum.mjs` — working test showing expected output

---

## Step 1: Create a lightweight wrapper that works with `string[][]`

The DevTestPanel stores CSV data as `string[][]` (papaparse output), but `parseCurriculumCSV()` expects a raw CSV string. Add a small adapter:

```ts
// In parseCurriculum.ts, add:
export function parseCurriculumRows(rows: string[][]): ParseResult {
    // Convert string[][] back to CSV text (rejoin with commas, handle quoting)
    const csvText = rows.map(row =>
        row.map(cell => cell.includes(',') || cell.includes('"')
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(',')
    ).join('\n');
    return parseCurriculumCSV(csvText);
}
```

## Step 2: Add `CurriculumSummary` component in DevTestPanel

Insert a new component below the curriculum tab's status badge. It should:

1. Accept `rows: string[][]` prop
2. Call `parseCurriculumRows(rows)` via `useMemo`
3. Call `buildTeacherNameToCodeMap(TEACHER_META)` + `resolveWorkloadToTeacherCodes()` to resolve names → codes
4. Display:

```
┌─────────────────────────────────────────────┐
│ 📊 Curriculum Summary                    [▼] │
│                                              │
│  55 ครู · 712 คาบ/สัปดาห์ · ⚠️ 1 warning    │
│                                              │
│  ┌─ Workload by teacher (collapsible) ─────┐ │
│  │ T033 จิรัสชยาณ์  12p/w  1 subject       │ │
│  │ T035 ปาริชาต    22p/w  2 subjects       │ │
│  │ ...                                     │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ⚠️ Warnings:                                │
│  - Line 90: no teacher for ว32283           │
│                                              │
│  ❌ Unmapped teachers (not in TEACHER_META): │
│  - " สุขุมาภรณ์" (leading space)            │
│                                              │
└─────────────────────────────────────────────┘
```

### Key details:
- Only render when `currentData.curriculum` exists
- Place it AFTER the tab status grid, BEFORE the action buttons
- Use same yellow styling as the rest of DevTestPanel (`bg-yellow-50`, `border-yellow-200`, etc.)
- Collapsed by default, expand on click
- Show stats line always (even when collapsed): `{teacherCount} ครู · {totalPeriods} คาบ/สัปดาห์ · {warningCount} warnings`

## Step 3: Teacher detail table (inside collapsible)

```tsx
<div className="max-h-60 overflow-y-auto">
  <table className="w-full text-xs">
    <thead>
      <tr className="text-left text-yellow-700">
        <th>Code</th><th>Name</th><th>Subjects</th><th>Classes</th><th>Periods/wk</th>
      </tr>
    </thead>
    <tbody>
      {teachers.map(t => (
        <tr key={t.code} className="border-t border-yellow-100">
          <td>{t.code}</td>
          <td>{t.name}</td>
          <td>{t.subjectCount}</td>
          <td>{t.classCount}</td>
          <td className={t.totalPeriods > 20 ? 'text-red-600 font-bold' : ''}>
            {t.totalPeriods}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Highlight teachers with >20 periods/week in red (overloaded).

## Step 4: Warnings section

Show `warnings` array from `ParseResult` + `unmapped` array from `resolveWorkloadToTeacherCodes`. Each as a small list with yellow/red styling.

---

## Import summary

```ts
// DevTestPanel.tsx needs these new imports:
import {
  parseCurriculumRows,      // Step 1
  buildTeacherNameToCodeMap,
  resolveWorkloadToTeacherCodes,
} from '../../schedule/_utils/parseCurriculum';
import { TEACHER_META } from '../../schedule/_utils/dummyData';
```

Note: the import path from `dashboard/[id]/_components/` to `schedule/_utils/` is:
`../../../schedule/_utils/parseCurriculum`

(go up from `_components` → `[id]` → `dashboard` → `(admin)`, then down to `schedule/_utils`)

Actually: `app/(admin)/dashboard/[id]/_components/` → `app/(admin)/schedule/_utils/`
= `../../../../schedule/_utils/parseCurriculum`

Double-check the relative path. It's 4 levels up from `_components` to `(admin)`.

---

## Testing

After implementation, run:
1. Load example CSVs in DevTestPanel
2. Verify curriculum summary appears with correct counts
3. Compare output against `node scripts/testParseCurriculum.mjs`
4. Check the 1 warning (Line 90) shows up
5. Check that collapsing/expanding works
