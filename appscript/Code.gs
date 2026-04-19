// ─── Code.gs ─────────────────────────────────────────────────────────────────
// Main entry: custom menu and validation runner.
// ─────────────────────────────────────────────────────────────────────────────

// Tab name → validator function mapping
var TAB_VALIDATORS = {
  'period':      validatePeriod,
  'room':        validateRoom,
  'teacher':     validateTeacher,
  'student':     validateStudent,
  'preplace':    validatePreplace,
  'scout':       validateScout,
  'elective':    validateElective,
  'curriculum':  validateCurriculum,
  'constraints': validateConstraints,
};

// Aliases to try (in order) when looking up a tab by its canonical name.
// Handles Thai tab names and Title-case variants in addition to lowercase English.
var TAB_ALIASES = {
  'period':      ['period', 'Period', 'คาบ'],
  'room':        ['room',   'Room',   'ห้อง'],
  'teacher':     ['teacher','Teacher','ครู'],
  'student':     ['student','Student','นักเรียน'],
  'preplace':    ['preplace','Preplace','ตรึงคาบ'],
  'scout':       ['scout',  'Scout',  'ลูกเสือ'],
  'elective':    ['elective','Elective','วิชาเสรี'],
  'curriculum':  ['curriculum','Curriculum','หลักสูตร'],
  'constraints': ['constraints','Constraints'],
};

/**
 * Returns the first Sheet found for a canonical tab name by trying all aliases.
 * Returns null if none of the aliases match a sheet in the spreadsheet.
 */
function getSheetByAliases(ss, tabName) {
  var aliases = TAB_ALIASES[tabName] || [tabName];
  // Use trimmed comparison so trailing/leading spaces in tab names don't break lookup.
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var trimmedName = allSheets[i].getName().trim();
    for (var j = 0; j < aliases.length; j++) {
      if (trimmedName === aliases[j]) return allSheets[i];
    }
  }
  return null;
}

// Tab skeleton definitions — must stay in sync with /api/sheets/copy TAB_DEFS
var TAB_DEFS = [
  { name: 'period',     headers: ['คาบ', 'เวลา'] },
  { name: 'room',       headers: ['ห้องทั้งหมด', 'หมายเหตุ', 'ประเภท'] },
  { name: 'teacher',    headers: ['teacher_id', 'ตำแหน่ง', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ'] },
  { name: 'student',    headers: ['นักเรียน', 'ชั้น', 'ห้อง', 'ห้องประจำ', 'หลักสูตร'] },
  { name: 'preplace',   headers: ['ชื่อ', 'คาบ', 'apply_to'] },
  { name: 'scout',      headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'] },
  { name: 'elective',   headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'เสรีม.ต้น1', 'เสรีม.ต้น2', 'เสรีม.ปลาย1', 'เสรีม.ปลาย2', 'เสรีม.ปลาย3', 'เสรีม.ปลาย4', 'เสรีม.ปลาย5', 'เสรีม.ปลาย6'] },
  { name: 'curriculum', headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'จำนวนห้อง', 'รวมคาบ', 'ครู', 'การแบ่งคาบสอน', 'ห้อง (นักเรียน) ที่สอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน'] },
  { name: 'constraints', headers: ['id', 'Name', 'Type', 'description', 'Note', 'parameters (example)', 'Example Constraints'] },
];

var COLOR_HEADER_BG = { red: 0.91, green: 0.92, blue: 0.96 }; // #E8EAF6

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Schooldoo')
    .addItem('Validate All Tabs', 'runValidation')
    .addItem('Generate Skeleton', 'generateSkeleton')
    .addItem('Fix Curriculum Headers', 'fixCurriculumHeaders')
    .addSeparator()
    .addItem('Debug: Show Tab Names', 'debugTabNames')
    .addToUi();

  // Ensure an installable onOpen trigger exists so the menu appears on every open
  createTriggerIfNeeded_();
}

/**
 * Creates an installable onOpen trigger if none exists.
 * Called automatically on first open via the simple onOpen trigger.
 */
function createTriggerIfNeeded_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getUserTriggers(ss);
  var hasOpen = triggers.some(function(t) {
    return t.getEventType() === ScriptApp.EventType.ON_OPEN;
  });
  if (!hasOpen) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(ss)
      .onOpen()
      .create();
  }
}

/**
 * Generates the skeleton structure: creates missing tabs, writes headers,
 * formats header rows, and protects them so only the spreadsheet owner can edit.
 */
function generateSkeleton() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  for (var i = 0; i < TAB_DEFS.length; i++) {
    var def = TAB_DEFS[i];
    var sheet = getSheetByAliases(ss, def.name);

    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }

    // Write headers only if row 1 is empty
    var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    var existing = headerRange.getValues()[0];
    var isEmpty = existing.every(function(c) { return !String(c).trim(); });
    if (isEmpty) {
      headerRange.setValues([def.headers]);
    }

    // Format header row
    sheet.getRange(1, 1, 1, def.headers.length)
      .setFontWeight('bold')
      .setBackground('#E8EAF6');

    // Freeze header row
    sheet.setFrozenRows(1);

    // Protect header row — only owner can edit
    lockHeaderRow_(sheet);
  }

  ui.alert(
    'Skeleton Generated',
    'All tabs are ready. The header row of each tab is locked so only the owner can edit headers.',
    ui.ButtonSet.OK
  );
}

/**
 * Protects row 1 of the given sheet so only the spreadsheet owner can edit it.
 * Existing protections on row 1 are removed first to avoid duplicates.
 */
function lockHeaderRow_(sheet) {
  // Remove existing row-1 protections to avoid accumulation
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var p = 0; p < protections.length; p++) {
    var prot = protections[p];
    var range = prot.getRange();
    if (range.getRow() === 1 && range.getNumRows() === 1) {
      prot.remove();
    }
  }

  // Create new protection for the header row
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  var protection = headerRow.protect().setDescription('Header — owner only');

  // Remove all editors except the owner (the account running this script)
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
}

/**
 * Renames legacy column headers in the curriculum tab so they match what the
 * backend expects.  Specifically: 'รหัสวิชา 2' → 'คาบเรียน'.
 * Run this once on existing sheets that were created before the skeleton was
 * updated.
 */
function fixCurriculumHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheetByAliases(ss, 'curriculum');

  if (!sheet) {
    ui.alert('Fix Curriculum Headers', 'ไม่พบแท็บ curriculum / หลักสูตร', ui.ButtonSet.OK);
    return;
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) {
    ui.alert('Fix Curriculum Headers', 'แท็บ curriculum ว่างเปล่า', ui.ButtonSet.OK);
    return;
  }

  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var headers = headerRange.getValues()[0];
  var fixed = 0;

  var RENAMES = { 'รหัสวิชา 2': 'คาบเรียน' };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (RENAMES[h]) {
      sheet.getRange(1, i + 1).setValue(RENAMES[h]);
      fixed++;
    }
  }

  if (fixed > 0) {
    ui.alert('Fix Curriculum Headers', 'แก้ไข ' + fixed + ' คอลัมน์เรียบร้อยแล้ว', ui.ButtonSet.OK);
  } else {
    ui.alert('Fix Curriculum Headers', 'ไม่พบคอลัมน์ที่ต้องแก้ไข (อาจถูกแก้ไขแล้ว)', ui.ButtonSet.OK);
  }
}

function debugTabNames() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var lines = sheets.map(function(s) {
    var name = s.getName();
    var codes = [];
    for (var i = 0; i < name.length; i++) {
      codes.push('U+' + name.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'));
    }
    return '"' + name + '"  [' + codes.join(' ') + ']';
  });
  SpreadsheetApp.getUi().alert('Tab names in this spreadsheet:\n\n' + lines.join('\n'));
}

// ─── Validation Runner ──────────────────────────────────────────────────────

var COLOR_RED    = '#FFCDD2';  // error row
var COLOR_YELLOW = '#FFF9C4';  // warning row
var COLOR_GREEN  = '#C8E6C9';  // clean row
var COLOR_HEADER = '#E8EAF6';  // header row (unchanged)

/**
 * Applies row-level highlighting to a data sheet based on validation results.
 * - Error rows   → red
 * - Warning rows → yellow (unless also has an error)
 * - Marker rows  → no colour change (left as-is)
 * - Clean rows   → green
 */
function applyHighlights(sheet, dataRowCount, errors, warnings, rawData) {
  if (dataRowCount <= 0) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return;

  // Build set of 1-based marker row indices (skip row 1 = header)
  var markerRows = {};
  if (rawData) {
    for (var m = 1; m < rawData.length; m++) {
      var firstCell = _str(rawData[m][0]);
      if (isGradeHeader(firstCell) || isMarkerRow(rawData[m])) {
        markerRows[m + 1] = true; // convert to 1-based sheet row
      }
    }
  }

  // 1. Reset all non-marker data rows to green (optimistic default)
  for (var dr = 2; dr <= dataRowCount + 1; dr++) {
    if (!markerRows[dr]) {
      sheet.getRange(dr, 1, 1, lastCol).setBackground(COLOR_GREEN);
    }
  }

  // 2. Build row → worst status map
  var rowStatus = {};
  for (var w = 0; w < warnings.length; w++) {
    var wr = warnings[w].row;
    if (!rowStatus[wr]) rowStatus[wr] = 'warning';
  }
  for (var e = 0; e < errors.length; e++) {
    rowStatus[errors[e].row] = 'error';
  }

  // 3. Color rows by worst status (skip marker rows)
  var rows = Object.keys(rowStatus);
  for (var i = 0; i < rows.length; i++) {
    var r = parseInt(rows[i]);
    if (markerRows[r]) continue; // don't color marker rows
    var color = rowStatus[r] === 'error' ? COLOR_RED : COLOR_YELLOW;
    sheet.getRange(r, 1, 1, lastCol).setBackground(color);
  }
}

function runValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Get or create "Validation Results" tab
  var resultSheet = ss.getSheetByName('Validation Results');
  if (!resultSheet) {
    resultSheet = ss.insertSheet('Validation Results');
  }
  resultSheet.clearContents();
  resultSheet.clearFormats();

  // Header
  resultSheet.getRange(1, 1, 1, 3).setValues([['Tab', 'Status', 'Issues']]);
  resultSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground(COLOR_HEADER);
  resultSheet.setFrozenRows(1);

  var resultRow = 2;
  var allValid  = true;
  var totalErrors   = 0;
  var totalWarnings = 0;

  var tabNames = Object.keys(TAB_VALIDATORS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName   = tabNames[i];
    var validator = TAB_VALIDATORS[tabName];
    var sheet     = getSheetByAliases(ss, tabName);

    if (!sheet) {
      // constraints tab is optional — its validator always passes, so just skip it.
      if (tabName === 'constraints') {
        resultSheet.getRange(resultRow, 1, 1, 3)
          .setValues([[tabName, 'SKIPPED', 'Optional tab not found — no validation required.']]);
        resultSheet.getRange(resultRow, 2).setBackground(COLOR_YELLOW).setFontColor('#F57F17');
        resultRow++;
        continue;
      }
      resultSheet.getRange(resultRow, 1, 1, 3)
        .setValues([[tabName, 'MISSING', 'Tab not found in this spreadsheet.']]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
      allValid = false;
      totalErrors++;
      resultRow++;
      continue;
    }

    // Read all data as strings.
    // Date objects (e.g. Sheets auto-converts "1/1" → Date) are formatted as M/D
    // so validators receive the original class-ID format, not a full date string.
    var data = sheet.getDataRange().getValues().map(function(r) {
      return r.map(function(c) {
        if (c instanceof Date) return (c.getMonth() + 1) + '/' + c.getDate();
        return String(c);
      });
    });

    var result = validator(data);

    // ── Highlight cells in the actual data sheet ─────────────────────────────
    // Pass marker rows so they remain uncolored (neither green nor red)
    applyHighlights(sheet, data.length - 1, result.errors, result.warnings, data);

    // ── Write summary row to Validation Results ──────────────────────────────
    var errCount  = result.errors.length;
    var warnCount = result.warnings.length;
    var issueText = '';

    if (errCount > 0) {
      issueText += 'ERRORS:\n' +
        result.errors.map(function(e) { return '  Row ' + e.row + ': ' + e.message; }).join('\n');
    }
    if (warnCount > 0) {
      if (issueText) issueText += '\n\n';
      issueText += 'WARNINGS:\n' +
        result.warnings.map(function(w) { return '  Row ' + w.row + ': ' + w.message; }).join('\n');
    }

    if (errCount === 0 && warnCount === 0) {
      resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'PASSED', '']]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_GREEN).setFontColor('#1B5E20');
    } else if (errCount === 0) {
      resultSheet.getRange(resultRow, 1, 1, 3)
        .setValues([[tabName, 'WARNINGS (' + warnCount + ')', issueText]]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_YELLOW).setFontColor('#F57F17');
    } else {
      resultSheet.getRange(resultRow, 1, 1, 3)
        .setValues([[tabName, 'ERRORS (' + errCount + ')', issueText]]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
      allValid = false;
    }

    totalErrors   += errCount;
    totalWarnings += warnCount;
    resultRow++;
  }

  // Format results tab
  resultSheet.autoResizeColumn(1);
  resultSheet.autoResizeColumn(2);
  resultSheet.setColumnWidth(3, 600);
  resultSheet.getRange(2, 3, Math.max(resultRow - 2, 1), 1).setWrap(true);

  // ── Navigate to results tab ──────────────────────────────────────────────
  ss.setActiveSheet(resultSheet);

  // ── Summary alert — BLOCKS if there are errors ───────────────────────────
  if (allValid && totalWarnings === 0) {
    ui.alert(
      'Validation Passed',
      'All tabs are valid. You can now return to Schooldoo and submit.',
      ui.ButtonSet.OK
    );
  } else if (allValid) {
    ui.alert(
      'Validation Passed with Warnings',
      totalWarnings + ' warning(s) found (yellow rows). Warnings will not block submission, ' +
      'but review them before proceeding.\n\nReturn to Schooldoo when ready.',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      'Validation Failed — Cannot Proceed',
      totalErrors + ' error(s) found across your tabs (red rows).\n\n' +
      'Fix all red rows before returning to Schooldoo to submit.\n\n' +
      'See the "Validation Results" tab for details.',
      ui.ButtonSet.OK
    );
  }
}
