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

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Schooldoo')
    .addItem('Validate All Tabs', 'runValidation')
    .addItem('Debug: Show Tab Names', 'debugTabNames')
    .addToUi();
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
