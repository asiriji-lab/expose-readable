// ─── Code.gs ─────────────────────────────────────────────────────────────────
// Main entry: custom menu, skeleton generator, and validation runner.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tab Definitions ─────────────────────────────────────────────────────────
// Each entry defines the tab name and its header row for the skeleton.

var TAB_DEFS = [
  { name: 'period',      headers: ['คาบ', 'เวลา'] },
  { name: 'room',        headers: ['ห้องทั้งหมด', 'หมายเหตุ', 'ประเภท'] },
  { name: 'teacher',     headers: ['teacher_id', 'ตำแหน่ง', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ'] },
  { name: 'student',     headers: ['ชั้นเรียน', 'ชั้น', 'ห้อง', 'ห้องประจำ', 'หลักสูตร'] },
  { name: 'preplace',    headers: ['ชื่อ', 'คาบ', 'apply_to'] },
  { name: 'scout',       headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'] },
  { name: 'elective',    headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'เสรีม.ต้น1', 'เสรีม.ต้น2', 'เสรีม.ปลาย1', 'เสรีม.ปลาย2', 'เสรีม.ปลาย3', 'เสรีม.ปลาย4', 'เสรีม.ปลาย5', 'เสรีม.ปลาย6'] },
  { name: 'curriculum',  headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'จำนวนห้อง', 'รวมคาบ', 'ครู', 'การแบ่งคาบสอน', 'ห้อง (ชั้นเรียน) ที่สอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน'] },
  { name: 'constraints', headers: ['id', 'Name', 'Type', 'description', 'Note', 'parameters (example)', 'Example Constraints'] },
];

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

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Schooldoo')
    .addItem('Create Skeleton Tabs', 'createSkeleton')
    .addSeparator()
    .addItem('Validate All Tabs', 'runValidation')
    .addToUi();
}

// ─── Skeleton Generator ──────────────────────────────────────────────────────
// Creates all 9 tabs with header rows. Skips tabs that already exist.

function createSkeleton() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var created = [];
  var skipped = [];

  for (var i = 0; i < TAB_DEFS.length; i++) {
    var def = TAB_DEFS[i];
    var existing = ss.getSheetByName(def.name);

    if (existing) {
      skipped.push(def.name);
      continue;
    }

    var sheet = ss.insertSheet(def.name);

    // Write header row
    if (def.headers.length > 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);

      // Bold + freeze header row
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#E8EAF6');
      sheet.setFrozenRows(1);

      // Protect header row — only owner can edit
      var protection = sheet.getRange(1, 1, 1, def.headers.length).protect();
      protection.setDescription('Header row — do not edit');
      protection.setWarningOnly(true);
    }

    created.push(def.name);
  }

  // Remove the default "Sheet1" if it exists and is empty
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getDataRange().getNumRows() <= 1 &&
      sheet1.getDataRange().getNumColumns() <= 1) {
    ss.deleteSheet(sheet1);
  }

  var msg = '';
  if (created.length) msg += 'Created: ' + created.join(', ') + '\n';
  if (skipped.length) msg += 'Skipped (already exists): ' + skipped.join(', ');
  if (!msg) msg = 'All tabs already exist.';

  ui.alert('Skeleton Setup', msg, ui.ButtonSet.OK);
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
 * - Clean rows   → green
 */
function applyHighlights(sheet, dataRowCount, errors, warnings) {
  if (dataRowCount <= 0) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return;

  // 1. Reset all data rows to green (optimistic default)
  sheet.getRange(2, 1, dataRowCount, lastCol).setBackground(COLOR_GREEN);

  // 2. Build row → worst status map
  var rowStatus = {};
  for (var w = 0; w < warnings.length; w++) {
    var wr = warnings[w].row;
    if (!rowStatus[wr]) rowStatus[wr] = 'warning';
  }
  for (var e = 0; e < errors.length; e++) {
    rowStatus[errors[e].row] = 'error';
  }

  // 3. Color rows by worst status
  var rows = Object.keys(rowStatus);
  for (var i = 0; i < rows.length; i++) {
    var r      = parseInt(rows[i]);
    var color  = rowStatus[r] === 'error' ? COLOR_RED : COLOR_YELLOW;
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
    var sheet     = ss.getSheetByName(tabName);

    if (!sheet) {
      resultSheet.getRange(resultRow, 1, 1, 3)
        .setValues([[tabName, 'MISSING', 'Tab not found in this spreadsheet.']]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
      allValid = false;
      totalErrors++;
      resultRow++;
      continue;
    }

    // Read all data as strings
    var data = sheet.getDataRange().getValues().map(function(r) {
      return r.map(function(c) { return String(c); });
    });

    var result = validator(data);

    // ── Highlight cells in the actual data sheet ─────────────────────────────
    applyHighlights(sheet, data.length - 1, result.errors, result.warnings);

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
