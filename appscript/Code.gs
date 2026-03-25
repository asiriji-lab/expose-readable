// ─── Code.gs ─────────────────────────────────────────────────────────────────
// Main entry: custom menu, skeleton generator, and validation runner.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Tab Definitions ─────────────────────────────────────────────────────────
// Each entry defines the tab name and its header row for the skeleton.

var TAB_DEFS = [
  { name: 'period',      headers: ['period_label', 'period_time'] },
  { name: 'room',        headers: ['room_id', 'note', 'tag'] },
  { name: 'teacher',     headers: ['teacher_id', 'teacher_name', 'available_slots', 'unavailable_slots', 'constraint'] },
  { name: 'student',     headers: ['class_id', 'grade', 'section', 'default_room', 'curriculum'] },
  { name: 'preplace',    headers: ['slot_name', 'periods', 'apply_to'] },
  { name: 'scout',       headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'] },
  { name: 'elective',    headers: ['subject_id', 'subject_name', 'teacher', 'room'] },
  { name: 'curriculum',  headers: ['subject_id', 'subject_name', 'periods_per_week', 'teacher', 'block_pattern', 'student_class', 'constraint', 'room', 'fixed_period'] },
  { name: 'constraints', headers: ['slot_name', 'periods', 'apply_to'] },
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

function runValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Get or create "Validation Results" tab
  var resultSheet = ss.getSheetByName('Validation Results');
  if (!resultSheet) {
    resultSheet = ss.insertSheet('Validation Results');
  }
  resultSheet.clearContents();

  // Header
  resultSheet.getRange(1, 1, 1, 3).setValues([['Tab', 'Status', 'Errors']]);
  resultSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#E8EAF6');
  resultSheet.setFrozenRows(1);

  var row = 2;
  var allValid = true;

  var tabNames = Object.keys(TAB_VALIDATORS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName   = tabNames[i];
    var validator = TAB_VALIDATORS[tabName];
    var sheet     = ss.getSheetByName(tabName);

    if (!sheet) {
      resultSheet.getRange(row, 1, 1, 3).setValues([[tabName, 'MISSING', 'Tab not found in this spreadsheet.']]);
      resultSheet.getRange(row, 2).setFontColor('#D32F2F');
      allValid = false;
      row++;
      continue;
    }

    // Read all data as strings
    var data = sheet.getDataRange().getValues().map(function(r) {
      return r.map(function(c) { return String(c); });
    });

    var result = validator(data);

    if (result.valid) {
      resultSheet.getRange(row, 1, 1, 3).setValues([[tabName, 'PASSED', '']]);
      resultSheet.getRange(row, 2).setFontColor('#388E3C');
    } else {
      var errorText = result.errors.join('\n');
      resultSheet.getRange(row, 1, 1, 3).setValues([[tabName, 'ERRORS (' + result.errors.length + ')', errorText]]);
      resultSheet.getRange(row, 2).setFontColor('#D32F2F');
      allValid = false;
    }
    row++;
  }

  // Auto-resize columns
  resultSheet.autoResizeColumn(1);
  resultSheet.autoResizeColumn(2);
  resultSheet.setColumnWidth(3, 600);

  // Wrap text in errors column
  resultSheet.getRange(2, 3, row - 2, 1).setWrap(true);

  // Show summary
  if (allValid) {
    ui.alert('Validation', 'All 9 tabs passed validation!', ui.ButtonSet.OK);
  } else {
    ui.alert('Validation', 'Some tabs have errors. Check the "Validation Results" tab for details.', ui.ButtonSet.OK);
  }
}
