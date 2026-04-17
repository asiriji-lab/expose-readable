/**
 * Quick test: node scripts/testParseCurriculum.mjs
 *
 * Parses the curriculum CSV and prints workload per teacher,
 * then resolves names → teacher codes.
 */

import fs from 'fs';
import path from 'path';

// ── Inline the parser (since we can't import TS directly) ──

function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else current += ch;
    }
    fields.push(current.trim());
    return fields;
}

function parseCurriculumCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    const warnings = [];
    const workload = {};

    let grade = 0, lastSubCode = '', lastSubName = '', lastPeriods = 0;

    for (let i = 1; i < lines.length; i++) {
        const f = parseCSVLine(lines[i]);

        const gm = f[0].match(/^ม\.(\d)$/);
        if (gm) { grade = +gm[1]; lastSubCode = ''; lastSubName = ''; continue; }
        if (!grade) { warnings.push(`Line ${i + 1}: no grade context`); continue; }

        const isCont = !f[0] && !f[1];
        const subCode = f[0] || (isCont ? lastSubCode : f[1] || '');
        const subName = f[1] || (isCont ? lastSubName : '');
        if (!subCode && !subName) continue;
        if (!isCont) { lastSubCode = subCode; lastSubName = subName; }

        const periods = f[2] ? +f[2] : lastPeriods;
        if (f[2]) lastPeriods = periods;
        const numSections = +f[3] || 0;
        const teachers = (f[5] || '').split(',').map(s => s.trim()).filter(Boolean);
        const sections = (f[7] || '').split(',').map(s => s.trim()).filter(s => s.startsWith('/'));
        const classCodes = sections.length > 0
            ? sections.map(s => `${grade}/${s.replace('/', '')}`)
            : Array.from({ length: numSections }, (_, j) => `${grade}/${j + 1}`);

        if (!teachers.length) { warnings.push(`Line ${i + 1}: no teacher for ${subCode}`); continue; }
        if (!classCodes.length) { warnings.push(`Line ${i + 1}: no classes for ${subCode}`); continue; }

        for (const t of teachers) {
            if (!workload[t]) workload[t] = [];
            let entry = workload[t].find(e => e.subjectCode === subCode);
            if (!entry) {
                entry = { subjectCode: subCode, subject: subName, assignments: [], totalPeriods: 0 };
                workload[t].push(entry);
            }
            for (const cc of classCodes) {
                if (entry.assignments.some(a => a.classCode === cc)) continue;
                entry.assignments.push({ classCode: cc, periodsPerWeek: periods });
                entry.totalPeriods += periods;
            }
        }
    }
    return { workload, warnings };
}

// ── TEACHER_META (name → code mapping) ──

const TEACHER_META = {
    'T001': 'รัตติยาวัลย์', 'T002': 'สุทธิพจน์', 'T003': 'พิรพงศ์', 'T004': 'คณิตา',
    'T005': 'ภฤศรินทร์', 'T006': 'ศรารัตน์', 'T007': 'สหรัฐ', 'T008': 'วสุพล',
    'T009': 'วงศ์ตะวัน', 'T010': 'Coulter', 'T011': 'นงค์นุช', 'T012': 'พิมพ์วิภา',
    'T013': 'นิรมล', 'T014': 'คชาภรณ์', 'T015': 'พิไลลักษณ์', 'T016': 'มนรวัส',
    'T017': 'สมใจ', 'T018': 'วีรภัทร', 'T019': 'สุธิโชติ', 'T020': 'ธนิกานต์',
    'T021': 'ปาริชาติ', 'T022': 'สุขุมาภรณ์', 'T023': 'วิฑูรย์', 'T024': 'รัชนิกร',
    'T025': 'มงคล', 'T026': 'เมธา', 'T027': 'พีรวัฒน์', 'T028': 'จิดาภา',
    'T029': 'สุธีรวรรณ', 'T030': 'สิปปนันท์', 'T031': 'มารวย', 'T032': 'พิชยา',
    'T033': 'จิรัสชยาณ์', 'T034': 'เนตญา', 'T035': 'ปาริชาต', 'T036': 'วัชรพล',
    'T037': 'ธัญนัชญ์', 'T038': 'ปริญญ์', 'T039': 'หทัยรัตน์', 'T040': 'ธนินทร์',
    'T041': 'อนันธิตา', 'T042': 'อติวิชญ์', 'T043': 'อานนท์', 'T044': 'ณัฏฐ์ณภัทร',
    'T045': 'รุ่งนภา', 'T046': 'วรวุฒิ', 'T047': 'สุธาศินี', 'T048': 'พฤกษ์',
    'T049': 'อติชาต', 'E001': 'Falah', 'E002': 'อรชุน', 'E003': 'วัชระ',
    'E004': 'ภานุ', 'E005': 'มหาลัย (วมว)', 'E006': 'นฤเทพ', 'E007': 'มยุรี',
    'E008': 'วินัย', 'E009': 'บุญฤทธิ์', 'E010': 'วรยศ', 'E011': 'อิสระ', 'E012': 'ฐิติวรดา',
};

// Reverse: name → code
const nameToCode = {};
for (const [code, name] of Object.entries(TEACHER_META)) {
    nameToCode[name] = code;
}

// ── Run ──

const csvPath = path.resolve('.agent/solver_something/context/raw/dataset SWS - curriculum.csv');
const csvText = fs.readFileSync(csvPath, 'utf-8');
const { workload, warnings } = parseCurriculumCSV(csvText);

// ── Report ──

console.log('═══════════════════════════════════════════');
console.log(' CURRICULUM PARSER TEST');
console.log('═══════════════════════════════════════════\n');

if (warnings.length) {
    console.log(`⚠️  ${warnings.length} warnings:`);
    warnings.forEach(w => console.log(`   ${w}`));
    console.log();
}

const teacherNames = Object.keys(workload).sort();
console.log(`✅ ${teacherNames.length} teachers parsed\n`);

// Resolve to codes
const resolved = {};
const unmapped = [];
for (const name of teacherNames) {
    const code = nameToCode[name];
    if (code) {
        resolved[code] = workload[name];
    } else {
        unmapped.push(name);
    }
}

if (unmapped.length) {
    console.log(`❌ ${unmapped.length} teachers NOT in TEACHER_META:`);
    unmapped.forEach(n => console.log(`   - "${n}"`));
    console.log();
}

// Print per-teacher summary
console.log('─── Workload Summary ───────────────────────\n');
for (const name of teacherNames) {
    const code = nameToCode[name] || '???';
    const entries = workload[name];
    const totalPeriods = entries.reduce((s, e) => s + e.totalPeriods, 0);
    const totalClasses = entries.reduce((s, e) => s + e.assignments.length, 0);

    console.log(`${code.padEnd(5)} ${name}`);
    for (const e of entries) {
        const classes = e.assignments.map(a => a.classCode).join(', ');
        console.log(`       ${e.subjectCode.padEnd(12)} ${e.subject.padEnd(30).slice(0, 30)} ${e.assignments[0].periodsPerWeek}p/w × ${e.assignments.length} classes  → [${classes}]`);
    }
    console.log(`       TOTAL: ${totalPeriods} periods/week across ${totalClasses} class-assignments\n`);
}
