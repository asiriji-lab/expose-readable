'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  FileSpreadsheet, 
  Upload, 
  ExternalLink, 
  Search, 
  Loader2, 
  ArrowLeft, 
  Trash2, 
  CheckCircle,
  AlertTriangle,
  Zap,
  Info
} from 'lucide-react';
import {
  parseCurriculumRows,
  buildTeacherNameToCodeMap,
  resolveWorkloadToTeacherCodes,
} from '../../../schedule/_utils/parseCurriculum';
import { TEACHER_META } from '../../../schedule/_utils/dummyData';
import { SheetData, TabName } from '../../../validators/types';
import { ALL_TAB_NAMES, extractSheetId, filenameToTabName, parseCSVText, fetchAllPublicTabs } from '../_utils/csvHelpers';

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

  const { resolved, unmapped, parseResult } = useMemo(() => {
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
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-alt transition-colors rounded-lg"
      >
        <span className="font-semibold text-primary font-bold">
          📊 สรุปภาระงาน (Curriculum Summary)
        </span>
        <span className="text-foreground">
          {teachers.length} ครู · {totalPeriods} คาบ/สัปดาห์
          {warningCount > 0 && <span className="ml-1 text-orange-600">· ⚠️ {warningCount}</span>}
          {unmapped.length > 0 && <span className="ml-1 text-red-600">· ❌ {unmapped.length}</span>}
          <span className="ml-2 text-primary/70">{expanded ? '▼' : '▶'}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border">
          <div className="max-h-60 overflow-y-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-foreground">
                  <th className="pb-1 pr-2">Code</th>
                  <th className="pb-1 pr-2">Name</th>
                  <th className="pb-1 pr-2 text-center">Subjects</th>
                  <th className="pb-1 pr-2 text-center">Classes</th>
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
        </div>
      )}
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────
interface DataCommandCenterProps {
  onDataLoaded: (data: SheetData) => void;
  onClear: () => void;
  currentData: SheetData;
  onSheetUrlConnected?: (url: string) => void;
  // Lifecycle props from SheetConnector
  connectedSheetId: string | null;
  connectedSheetUrl: string | null;
  isCreatingSheet: boolean;
  onCreateSkeleton: () => void;
  onTabClick: (tab: TabName) => void;
}

function parseCSVFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => resolve(result.data as string[][]),
      error: (err: Error) => reject(err),
    });
  });
}

export default function DataCommandCenter({ 
  onDataLoaded, 
  onClear, 
  currentData, 
  onSheetUrlConnected,
  connectedSheetId,
  connectedSheetUrl,
  isCreatingSheet,
  onCreateSkeleton,
  onTabClick
}: DataCommandCenterProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [activeTab, setActiveTab]   = useState<'link' | 'upload'>('link');
  const [isImportMode, setIsImportMode] = useState(false);

  // ── Link tab state ──
  const [linkInput, setLinkInput]       = useState('');
  const [linkStatus, setLinkStatus]       = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');
  const [linkError, setLinkError]         = useState('');
  const [linkFound, setLinkFound]         = useState<TabName[]>([]);
  const [linkMissing, setLinkMissing]     = useState<TabName[]>([]);

  // ── Upload tab state ──
  const [isDragging, setIsDragging]     = useState(false);
  const fileInputRefs = useRef<Partial<Record<TabName, HTMLInputElement>>>({});

  const loadedCount = ALL_TAB_NAMES.filter((t) => !!currentData[t]).length;

  // ── Google Sheet fetch ──
  async function handleFetchSheet() {
    const id = extractSheetId(linkInput);
    if (!id) {
      setLinkError('ลิงก์ไม่ถูกต้อง — วาง Spreadsheet URL');
      return;
    }
    setLinkError('');
    setLinkStatus('fetching');

    try {
      const { data, missingTabs } = await fetchAllPublicTabs(id);
      const found = ALL_TAB_NAMES.filter((t) => data[t]);
      setLinkFound(found);
      setLinkMissing(missingTabs);
      setLinkStatus(found.length > 0 ? 'success' : 'error');
      
      if (found.length > 0) {
        onDataLoaded(data);
        const fullUrl = linkInput.trim().startsWith('http')
          ? linkInput.trim()
          : `https://docs.google.com/spreadsheets/d/${id}/edit`;
        onSheetUrlConnected?.(fullUrl);
      } else {
        setLinkError('ไม่พบแท็บข้อมูล (period, room, teacher, ...)');
      }
    } catch (err: any) {
      setLinkError(err.message || 'ดึงข้อมูลไม่สำเร็จ');
      setLinkStatus('error');
    }
  }

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

  return (
    <div data-testid="dev-test-panel" className="rounded-xl border-2 border-dashed border-primary-border bg-primary-light overflow-hidden transition-all duration-300">
      {/* Header bar */}
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-surface-alt transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-primary fill-primary" />
          <span className="font-semibold text-primary font-bold text-sm">Data Command Center</span>
          {connectedSheetId && (
            <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
              <CheckCircle size={10} /> CONNECTED
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground-muted">Project Workspace & Stats</span>
          <span className="text-foreground-muted text-xs">{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {/* Mode switcher */}
          <div className="flex gap-1 mt-4 bg-surface-alt rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'link' ? 'bg-surface text-primary font-bold shadow-sm' : 'text-foreground-muted hover:text-primary'
              }`}
            >
              <FileSpreadsheet size={14} /> Google Sheet
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'upload' ? 'bg-surface text-primary font-bold shadow-sm' : 'text-foreground-muted hover:text-primary'
              }`}
            >
              <Upload size={14} /> Local CSV
            </button>
          </div>

          {/* ── Tab: Google Sheet ── */}
          {activeTab === 'link' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              {connectedSheetId ? (
                /* Connected State */
                <div className="bg-surface border border-primary-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">เชื่อมต่อกับ Google Sheet แล้ว</p>
                    <button onClick={onClear} className="text-danger hover:underline text-xs">ยกเลิกการเชื่อมต่อ</button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-warning-light border border-warning-border rounded-lg text-xs text-foreground-muted truncate">
                      {connectedSheetUrl}
                    </div>
                    <a
                      href={connectedSheetUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm"
                    >
                      <ExternalLink size={14} /> เปิดไฟล์
                    </a>
                  </div>
                </div>
              ) : isImportMode ? (
                /* Import Mode */
                <div className="space-y-3 bg-surface border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-foreground">นำเข้า Google Sheet ที่มีอยู่แล้ว</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={linkInput}
                      onChange={(e) => { setLinkInput(e.target.value); setLinkError(''); }}
                      placeholder="วางลิงก์ Google Sheet..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-primary-border bg-surface outline-none focus:ring-2 focus:ring-yellow-100 transition-all"
                    />
                    <button
                      onClick={handleFetchSheet}
                      disabled={!linkInput.trim() || linkStatus === 'fetching'}
                      className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {linkStatus === 'fetching' ? <Loader2 className="animate-spin" size={16} /> : 'เชื่อมต่อ'}
                    </button>
                  </div>
                  <button onClick={() => setIsImportMode(false)} className="text-xs text-foreground-muted hover:text-primary flex items-center gap-1">
                    <ArrowLeft size={12} /> กลับไปสร้างไฟล์ใหม่
                  </button>
                  {linkError && <p className="text-xs text-red-600">❌ {linkError}</p>}
                </div>
              ) : (
                /* Generate Mode (Default) */
                <div className="text-center py-6 bg-surface border border-primary-border rounded-xl space-y-4">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <FileSpreadsheet className="text-primary" size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">ยังไม่มีพื้นที่ทำงานสำหรับเซสชันนี้</h4>
                    <p className="text-xs text-foreground-muted mt-1">กดปุ่มด้านล่างเพื่อสร้างไฟล์ Google Sheet สำหรับกรอกข้อมูล</p>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={onCreateSkeleton}
                      disabled={isCreatingSheet}
                      className="px-8 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isCreatingSheet ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} className="fill-white" />}
                      สร้างไฟล์ Google Sheet ใหม่
                    </button>
                    <button onClick={() => setIsImportMode(true)} className="text-xs text-primary font-bold hover:underline">
                      หรือนำเข้าไฟล์ที่มีอยู่แล้ว (Import)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Upload ── */}
          {activeTab === 'upload' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isDragging ? 'border-primary bg-surface-alt' : 'border-primary-border bg-surface'
                }`}
              >
                <p className="text-sm text-foreground">📂 ลากไฟล์ <code>.csv</code> ทั้งหมดมาวางที่นี่</p>
                <p className="text-[10px] text-primary/70 mt-1 font-medium italic">ชื่อไฟล์ต้องตรง เช่น period.csv, teacher.csv</p>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {ALL_TAB_NAMES.map((tab) => {
                  const loaded = !!currentData[tab];
                  return (
                    <div key={tab} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border ${loaded ? 'bg-green-50 border-green-200' : 'bg-surface border-border'}`}>
                      <button 
                        onClick={() => onTabClick(tab)}
                        className={`flex-1 text-left ${loaded ? 'text-green-800 font-bold' : 'text-foreground-muted'}`}
                      >
                        {TAB_META[tab].icon} {tab}
                      </button>
                      <button onClick={() => fileInputRefs.current[tab]?.click()} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold hover:bg-primary/20">
                        {loaded ? '🔄' : '+ เพิ่ม'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {ALL_TAB_NAMES.map((tab) => (
                <input
                  key={tab}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={(el) => { if (el) fileInputRefs.current[tab] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      parseCSVFile(file).then(rows => onDataLoaded({ ...currentData, [tab]: rows }));
                    }
                    e.target.value = '';
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Data Status Grid (Interactive Icons) ── */}
          <div className="p-3 bg-surface border border-primary-border rounded-xl space-y-2">
             <div className="flex items-center justify-between">
               <p className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-widest">
                 <Info size={10} /> Data Status Overview
               </p>
               <span className="text-[9px] text-foreground-muted italic">Click icons to view details</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {ALL_TAB_NAMES.map(tab => {
                  const loaded = !!currentData[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => onTabClick(tab)}
                      title={`Click to view ${tab} details`}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                        loaded ? 'bg-green-50 border-green-200 text-green-700' : 'bg-surface border-border text-foreground-muted grayscale opacity-50'
                      } hover:scale-105 active:scale-95`}
                    >
                      <span>{TAB_META[tab].icon}</span>
                      <span>{tab.toUpperCase()}</span>
                    </button>
                  );
                })}
             </div>
          </div>

          {/* ── Curriculum summary ── */}
          {currentData.curriculum && (
            <CurriculumSummary rows={currentData.curriculum} />
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider">
              {loadedCount}/8 Tabs Loaded
            </span>
            {loadedCount > 0 && (
              <button
                onClick={onClear}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border border-danger/20 text-danger hover:bg-danger/5 transition-colors"
              >
                <Trash2 size={12} /> ล้างข้อมูลทั้งหมด
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
