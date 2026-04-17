'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import {
  parseCurriculumRows,
  buildTeacherNameToCodeMap,
  resolveWorkloadToTeacherCodes,
} from '../../../schedule/_utils/parseCurriculum';
import { TEACHER_META } from '../../../schedule/_utils/dummyData';
import { SheetData, TabName } from '../../../validators/types';
import { ALL_TAB_NAMES, extractSheetId, filenameToTabName, parseCSVText, fetchPublicSheetTab } from '../_utils/csvHelpers';

// ── Icons / labels per tab ──────────────────────────────────────────────────
const TAB_META: Record<TabName, { icon: string; label: string }> = {
  period:     { icon: '📅', label: 'period' },
  room:       { icon: '🏫', label: 'room' },
  teacher:    { icon: '👨‍🏫', label: 'teacher' },
  student:    { icon: '👨‍🎓', label: 'student' },
  preplace:   { icon: '📌', label: 'preplace' },
  scout:      { icon: '⚜️',  label: 'scout' },
  elective:   { icon: '📚', label: 'elective' },
  curriculum: { icon: '📖', label: 'curriculum' },
};

// ── CurriculumSummary ───────────────────────────────────────────────────────
function CurriculumSummary({ rows }: { rows: string[][] }) {
  const [expanded, setExpanded] = useState(false);

  const nameToCode = useMemo(() => buildTeacherNameToCodeMap(TEACHER_META), []);

  const { parseResult, resolved, unmapped } = useMemo(() => {
    const parseResult = parseCurriculumRows(rows);
    const { resolved, unmapped } = resolveWorkloadToTeacherCodes(parseResult.workload, nameToCode);
    return { parseResult, resolved, unmapped };
  }, [rows, nameToCode]);

  const teachers = useMemo(() => {
    return Object.entries(resolved).map(([code, entries]) => {
      const meta = TEACHER_META[code];
      const totalPeriods = entries.reduce((sum, e) => sum + e.totalPeriods, 0);
      const subjectCount = entries.length;
      const classCount = new Set(entries.flatMap(e => e.assignments.map(a => a.classCode))).size;
      return { code, name: meta?.firstName ?? code, subjectCount, classCount, totalPeriods };
    }).sort((a, b) => b.totalPeriods - a.totalPeriods);
  }, [resolved]);

  const totalPeriods = teachers.reduce((sum, t) => sum + t.totalPeriods, 0);
  const warningCount = parseResult.warnings.length;

  return (
    <div className="rounded-lg border border-primary-border bg-primary-light text-xs">
      {/* Stats bar — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-alt transition-colors rounded-lg"
      >
        <span className="font-semibold text-primary font-bold">
          📊 Curriculum Summary
        </span>
        <span className="text-foreground">
          {teachers.length} ครู · {totalPeriods} คาบ/สัปดาห์
          {warningCount > 0 && <span className="ml-1 text-orange-600">· ⚠️ {warningCount} warnings</span>}
          {unmapped.length > 0 && <span className="ml-1 text-red-600">· ❌ {unmapped.length} unmapped</span>}
          <span className="ml-2 text-primary/70">{expanded ? '▼' : '▶'}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          {/* Teacher table */}
          <div className="max-h-60 overflow-y-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-foreground">
                  <th className="pb-1 pr-2">Code</th>
                  <th className="pb-1 pr-2">Name</th>
                  <th className="pb-1 pr-2">Subjects</th>
                  <th className="pb-1 pr-2">Classes</th>
                  <th className="pb-1">คาบ/สัปดาห์</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.code} className="border-t border-border">
                    <td className="py-0.5 pr-2 text-foreground">{t.code}</td>
                    <td className="py-0.5 pr-2">{t.name}</td>
                    <td className="py-0.5 pr-2 text-center">{t.subjectCount}</td>
                    <td className="py-0.5 pr-2 text-center">{t.classCount}</td>
                    <td className={`py-0.5 font-medium ${t.totalPeriods > 20 ? 'text-red-600 font-bold' : ''}`}>
                      {t.totalPeriods}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warnings */}
          {warningCount > 0 && (
            <div>
              <p className="font-semibold text-orange-700 mb-1">⚠️ Warnings:</p>
              <ul className="space-y-0.5 text-orange-600">
                {parseResult.warnings.map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Unmapped teachers */}
          {unmapped.length > 0 && (
            <div>
              <p className="font-semibold text-red-700 mb-1">❌ Unmapped teachers (not in TEACHER_META):</p>
              <ul className="space-y-0.5 text-red-600">
                {unmapped.map((name, i) => (
                  <li key={i}>- &quot;{name}&quot;</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────
interface DevTestPanelProps {
  onDataLoaded: (data: SheetData) => void;
  onClear: () => void;
  currentData: SheetData;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseCSVFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => resolve(result.data as string[][]),
      error: (err: Error) => reject(err),
    });
  });
}

// Component
export default function DevTestPanel({ onDataLoaded, onClear, currentData }: DevTestPanelProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'link' | 'upload'>('link');

  // ── Link tab state ──
  const [linkInput, setLinkInput]       = useState('');
  const [linkStatus, setLinkStatus]       = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');
  const [linkError, setLinkError]         = useState('');
  const [linkFound, setLinkFound]         = useState<TabName[]>([]);
  const [linkMissing, setLinkMissing]     = useState<TabName[]>([]);

  // ── Upload tab state ──
  const [isDragging, setIsDragging]     = useState(false);
  const fileInputRefs = useRef<Partial<Record<TabName, HTMLInputElement>>>({});

  // ── Shared helpers ──
  const loadedCount = ALL_TAB_NAMES.filter((t) => !!currentData[t]).length;

  // ── Load example CSVs ──
  async function handleLoadExamples() {
    try {
      const entries = await Promise.all(
        ALL_TAB_NAMES.map(async (tab) => {
          const res = await fetch(`/example_csv/example_${tab}.csv`);
          if (!res.ok) return [tab, null] as const;
          const text = await res.text();
          const rows = await parseCSVText(text);
          return [tab, rows] as const;
        })
      );
      const data: SheetData = {};
      for (const [tab, rows] of entries) {
        if (rows) data[tab as TabName] = rows;
      }
      onDataLoaded(data);
    } catch {
      // ignore
    }
  }

  // ── Google Sheet fetch ──
  async function handleFetchSheet() {
    const id = extractSheetId(linkInput);
    if (!id) {
      setLinkError('ลิงก์ไม่ถูกต้อง — วาง Google Sheet URL หรือ Spreadsheet ID');
      return;
    }
    setLinkError('');
    setLinkStatus('fetching');
    setLinkFound([]);
    setLinkMissing([]);

    try {
      const data: SheetData = {};
      await Promise.all(
        ALL_TAB_NAMES.map(async (tab) => {
          const rows = await fetchPublicSheetTab(id, tab);
          if (rows) data[tab] = rows;
        })
      );

      const found   = ALL_TAB_NAMES.filter((t) =>  data[t]);
      const missing = ALL_TAB_NAMES.filter((t) => !data[t]);
      setLinkFound(found);
      setLinkMissing(missing);
      setLinkStatus(found.length > 0 ? 'success' : 'error');
      if (found.length > 0) {
        onDataLoaded(data);
      } else {
        setLinkError('ไม่พบแท็บใดเลย — ตรวจว่าชื่อแท็บตรงกับที่กำหนด (period, room, teacher, ...)');
      }
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'ดึงข้อมูลไม่สำเร็จ');
      setLinkStatus('error');
    }
  }

  // ── CSV file upload (single) ──
  async function handleFileChange(tab: TabName, file: File) {
    try {
      const rows = await parseCSVFile(file);
      onDataLoaded({ ...currentData, [tab]: rows });
    } catch {
      alert(`แปลงไฟล์ ${file.name} ไม่สำเร็จ`);
    }
  }

  // ── Drag-drop multiple files ──
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.csv'));
    if (!files.length) return;

    const updates: SheetData = { ...currentData };
    await Promise.all(
      files.map(async (file) => {
        const tab = filenameToTabName(file.name);
        if (!tab) return;
        const rows = await parseCSVFile(file);
        updates[tab] = rows;
      })
    );
    onDataLoaded(updates);
  }, [currentData, onDataLoaded]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div data-testid="dev-test-panel" className="rounded-xl border-2 border-dashed border-primary-border bg-primary-light overflow-hidden">
      {/* Header bar */}
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface-alt transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🧪</span>
          <span className="font-semibold text-primary font-bold text-sm">Dev Testing Panel</span>
          {loadedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary font-bold">
              {loadedCount}/8 แท็บ
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground-muted">⚠️ Development Only</span>
          <span className="text-foreground-muted text-xs">{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {/* Mode switcher */}
          <div className="flex gap-1 mt-4 bg-surface-alt rounded-lg p-1 w-fit">
            {(['link', 'upload'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActiveTab(mode)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === mode
                    ? 'bg-surface text-primary font-bold shadow-sm'
                    : 'text-foreground-muted hover:text-primary font-bold'
                }`}
              >
                {mode === 'link' ? '🔗 Google Sheet Link' : '📁 Upload CSV'}
              </button>
            ))}
          </div>

          {/* ── Tab A: Link ── */}
          {activeTab === 'link' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => { setLinkInput(e.target.value); setLinkError(''); setLinkStatus('idle'); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchSheet()}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-primary-border bg-surface outline-none focus:border-primary focus:ring-2 focus:ring-yellow-100 transition-all"
                />
                <button
                  onClick={handleFetchSheet}
                  disabled={!linkInput.trim() || linkStatus === 'fetching'}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                    !linkInput.trim() || linkStatus === 'fetching'
                      ? 'bg-surface-alt text-primary/70 cursor-not-allowed'
                      : 'bg-primary-light0 hover:bg-primary/90 text-white shadow-sm'
                  }`}
                >
                  {linkStatus === 'fetching' ? '🔄 กำลังดึง...' : '🔍 ดึงข้อมูล'}
                </button>
              </div>

              {linkError && (
                <p className="text-xs text-red-600">❌ {linkError}</p>
              )}

              {linkStatus === 'success' && (
                <div className="space-y-1 text-xs">
                  {linkFound.length > 0 && (
                    <p className="text-green-700">✅ พบ: {linkFound.join(', ')}</p>
                  )}
                  {linkMissing.length > 0 && (
                    <p className="text-orange-600">⚠️ ไม่พบ: {linkMissing.join(', ')}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-foreground-muted">
                💡 Sheet ต้องตั้งค่า &quot;Anyone with the link can view&quot;
              </p>
            </div>
          )}

          {/* ── Tab B: Upload ── */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isDragging ? 'border-primary bg-surface-alt' : 'border-primary-border bg-surface'
                }`}
              >
                <p className="text-sm text-foreground">
                  📂 ลากไฟล์ <code>.csv</code> ทั้งหมดมาวางที่นี่
                </p>
                <p className="text-xs text-primary/70 mt-1">
                  ชื่อไฟล์จะถูก match อัตโนมัติ เช่น <code>period.csv</code> → period
                </p>
              </div>

              {/* Per-tab file status */}
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_TAB_NAMES.map((tab) => {
                  const loaded = !!currentData[tab];
                  const rowCount = currentData[tab]?.length;
                  return (
                    <div
                      key={tab}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border ${
                        loaded ? 'bg-green-50 border-green-200' : 'bg-surface border-border'
                      }`}
                    >
                      <span className={loaded ? 'text-green-800 font-medium' : 'text-foreground-muted'}>
                        {TAB_META[tab].icon} {tab}
                        {loaded && (
                          <span className="ml-1 text-green-600 font-normal">({rowCount} rows)</span>
                        )}
                      </span>
                      <button
                        onClick={() => fileInputRefs.current[tab]?.click()}
                        className="text-foreground-muted hover:text-primary font-bold underline"
                      >
                        {loaded ? '🔄' : '+ ไฟล์'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Hidden file inputs per tab */}
              {ALL_TAB_NAMES.map((tab) => (
                <input
                  key={tab}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={(el) => { if (el) fileInputRefs.current[tab] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(tab, file);
                    e.target.value = '';
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Curriculum summary ── */}
          {currentData.curriculum && (
            <CurriculumSummary rows={currentData.curriculum} />
          )}

          {/* ── Shared action buttons ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={handleLoadExamples}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-light0 hover:bg-primary/90 text-white transition-colors"
            >
              📦 โหลดไฟล์ตัวอย่าง
            </button>
            {loadedCount > 0 && (
              <button
                onClick={onClear}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary-border text-foreground hover:bg-surface-alt transition-colors"
              >
                🗑 ล้างข้อมูล
              </button>
            )}
            <span className="text-xs text-foreground-muted ml-auto">
              {loadedCount === 0
                ? 'ยังไม่มีข้อมูล'
                : `${loadedCount}/8 แท็บโหลดแล้ว`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
