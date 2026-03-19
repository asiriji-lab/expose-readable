'use client';

import { ValidationError } from '../../../validators/types';

interface DataPreviewProps {
  /** Parsed rows as header→value maps */
  rows: Record<string, string>[];
  /** List of errors/warnings for highlight */
  errors: ValidationError[];
  warnings: ValidationError[];
}

export default function DataPreview({ rows, errors, warnings }: DataPreviewProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground-muted italic">ไม่มีข้อมูล</p>;
  }

  const headers = Object.keys(rows[0]);

  // Build a Set of "row-col" keys for fast lookup
  const errorCells = new Set(errors.map((e) => `${e.row}-${e.col}`));
  const warnCells = new Set(warnings.map((w) => `${w.row}-${w.col}`));

  // Only show rows with issues + a few surrounding rows
  const affectedRows = new Set([...errors, ...warnings].map((e) => e.row - 2)); // convert to 0-based data index

  // Show max 50 rows; always show rows with errors/warnings
  const rowIndicesToShow = rows
    .map((_, i) => i)
    .filter((i) => affectedRows.has(i) || i < 5)
    .slice(0, 50);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-background">
          <tr>
            <th className="px-3 py-2 text-left text-foreground-muted font-medium border-b border-border w-10">#</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-foreground-muted font-medium border-b border-border whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowIndicesToShow.map((i) => {
            const row = rows[i];
            const dataRowNum = i + 2; // 1-based, row 1 is header
            return (
              <tr key={i} className="border-b border-border hover:bg-background">
                <td className="px-3 py-1.5 text-foreground-muted">{dataRowNum}</td>
                {headers.map((h, colIdx) => {
                  const cellKey = `${dataRowNum}-${colIdx + 1}`;
                  const isError = errorCells.has(cellKey);
                  const isWarn = warnCells.has(cellKey);
                  const value = row[h] ?? '';
                  return (
                    <td
                      key={h}
                      className={`px-3 py-1.5 max-w-40 truncate ${
                        isError ? 'bg-red-100 text-red-700 font-medium' :
                        isWarn ? 'bg-yellow-50 text-yellow-700' :
                        'text-foreground-muted'
                      }`}
                      title={value}
                    >
                      {value || <span className="text-foreground-muted/40 italic">ว่าง</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 50 && (
        <p className="text-xs text-foreground-muted px-3 py-2">
          แสดง {rowIndicesToShow.length} จาก {rows.length} แถว (เฉพาะแถวที่มีปัญหาและแถวแรก)
        </p>
      )}
    </div>
  );
}
