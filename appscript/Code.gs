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

// Phase mapping for referential checks
var REF_VALIDATORS = {
  'room':       validateRoomRefs,
  'curriculum': validateCurriculumRefs,
  'elective':   validateElectiveRefs,
  'student':    validateStudentRefs,
  'scout':      validateScoutRefs,
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

// ─── Tab Definitions ─────────────────────────────────────────────────────────
// Tab skeleton definitions — must stay in sync with /api/sheets/copy TAB_DEFS
// Each entry now includes an exampleRow for user guidance.
var TAB_DEFS = [
  {
    name: 'period',
    headers: ['คาบ', 'เวลา'],
    exampleRow: ['1', '08.30-09.20'],
  },
  {
    name: 'room',
    headers: ['room_id', 'ชื่อห้อง', 'ชั้นเรียนประจำ', 'ประเภท'],
    exampleRow: ['LAB1', 'ห้องปฏิบัติการวิทย์', '', 'LAB'],
  },
  {
    name: 'teacher',
    headers: ['teacher_id', 'ตำแหน่ง', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'unavailable_slots', 'หมายเหตุ'],
    exampleRow: ['T001', 'ครู', 'สมชาย ใจดี', 'วิทยาศาสตร์', 'MON_1,MON_2,TUE_1', '', 'ครูประจำชั้น ม.1/1'],
  },
  {
    name: 'student',
    headers: ['นักเรียน', 'ชั้น', 'ห้อง', 'หลักสูตร'],
    exampleRow: ['1/1', 'ม.1', '1', 'วิทย์-คณิต'],
  },
  {
    name: 'preplace',
    headers: ['ชื่อ', 'คาบ', 'apply_to'],
    exampleRow: ['กิจกรรมหน้าเสาธง', 'Everyday_1', 'All'],
  },
  {
    name: 'scout',
    headers: ['ลูกเสือม.1', 'ลูกเสือม.2', 'ลูกเสือม.3'],
    exampleRow: ['สมชาย ใจดี', 'สมหญิง รักเรียน', 'สมศักดิ์ มานะ'],
  },
  {
    name: 'elective',
    headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'เสรีม.ต้น1', 'เสรีม.ต้น2', 'เสรีม.ปลาย1', 'เสรีม.ปลาย2', 'เสรีม.ปลาย3', 'เสรีม.ปลาย4', 'เสรีม.ปลาย5', 'เสรีม.ปลาย6'],
    exampleRow: ['EL001', 'ดนตรีสากล', 'สมชาย ใจดี', '201', '', '', '', '', '', '', '', ''],
  },
  {
    name: 'curriculum',
    headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'จำนวนห้อง', 'รวมคาบ', 'ครู', 'การแบ่งคาบสอน', 'ห้อง (นักเรียน) ที่สอน', 'หมายเหตุ', 'ห้องเรียน', 'คาบเรียน'],
    exampleRow: ['SCI101', 'วิทยาศาสตร์พื้นฐาน', '3', '4', '12', 'สมชาย ใจดี', '1+1+1', '1/1,1/2,1/3,1/4', '', '201', 'MON_2'],
  },
  {
    name: 'constraints',
    headers: ['id', 'Name', 'Type', 'description', 'Note', 'parameters (example)', 'Example Constraints'],
    exampleRow: ['C001', 'MaxPeriodsPerDay', 'hard', 'จำกัดจำนวนคาบ/วัน', '', '{"max": 6}', ''],
  },
];

// ─── Data Validation Dropdowns Config ─────────────────────────────────────────
// Maps canonical tab name → array of { column: headerName, values: [...] }
var TAB_VALIDATIONS = {
  'student': [
    { column: 'ชั้น', values: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] },
  ],
  'preplace': [
    { column: 'apply_to', values: ['All', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] },
  ],
  'room': [
    { column: 'ประเภท', values: ['exclude'] },
  ],
};

// ─── Conditional Formatting Rules Config ──────────────────────────────────────
// Maps canonical tab name → array of { column: headerName, formula: string }
// Use {COL} as placeholder for the column letter (replaced at runtime).
// Formulas are relative to row 2; Google Sheets adjusts for other rows automatically.
var TAB_FORMAT_RULES = {
  'teacher': [
    {
      column: 'teacher_id',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^[TE]\\d{3,}$")))',
    },
    {
      column: 'ชื่อ',
      formula: '=AND(ROW()>1,ISBLANK({COL}2),NOT(ISBLANK($A2)))',
    },
  ],
  'student': [
    {
      column: 'นักเรียน',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+/\\d+$")))',
    },
    {
      column: 'ชั้น',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^ม\\.[1-6]$")))',
    },
    {
      column: 'ห้อง',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+$")))',
    },
  ],
  'period': [
    {
      column: 'เวลา',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d{2}\\.\\d{2}-\\d{2}\\.\\d{2}$")),NOT(REGEXMATCH({COL}2,"^\\d+$")))',
    },
  ],
  'curriculum': [
    {
      column: 'คาบ/สัปดาห์',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+(\\.\\d+)?$")))',
    },
  ],
  'preplace': [
    {
      column: 'คาบ',
      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^(Everyday_\\d+|(MON|TUE|WED|THU|FRI)_\\d+)(,(Everyday_\\d+|(MON|TUE|WED|THU|FRI)_\\d+))*$")))',
    },
  ],
};

// ─── onEdit Cell Validators Config ────────────────────────────────────────────
// Maps canonical tab name → { headerName: { check: fn, msg: string } }
// Only cheap single-cell structural checks — NO cross-tab referential checks.
var CELL_VALIDATORS = {
  'teacher': {
    'teacher_id': {
      check: function(v) { return isValidTeacherId(v); },
      msg: 'ต้องเป็น T### หรือ E### (อย่างน้อย 3 หลัก) เช่น T001',
    },
    'ชื่อ': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุชื่อครู',
    },
  },
  'student': {
    'นักเรียน': {
      check: function(v) { return isValidClassId(v); },
      msg: 'ต้องเป็นรูปแบบ G/S เช่น 1/1',
    },
    'ชั้น': {
      check: function(v) { return /^ม\.[1-6]$/.test(v); },
      msg: 'ต้องเป็น ม.1–ม.6',
    },
    'ห้อง': {
      check: function(v) { return /^\d+$/.test(v) && parseInt(v, 10) > 0; },
      msg: 'ต้องเป็นจำนวนเต็มบวก',
    },
  },
  'period': {
    'คาบ': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุชื่อคาบ',
    },
    'เวลา': {
      check: function(v) { return isValidTimeFormat(v); },
      msg: 'ต้องเป็น HH.MM-HH.MM หรือตัวเลข (นาที) เช่น 08.30-09.20 หรือ 50',
    },
  },
  'preplace': {
    'ชื่อ': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุชื่อ slot',
    },
    'คาบ': {
      check: function(v) { return getInvalidPreplaceSlotTokens(v).length === 0; },
      msg: 'รูปแบบ slot ไม่ถูกต้อง — ใช้ Everyday_1, MON_1 หรือ MON_1-FRI_5',
    },
    'apply_to': {
      check: function(v) { return isValidApplyTo(v); },
      msg: 'ต้องเป็น All, ม.X หรือรายการคั่นด้วยจุลภาค เช่น ม.1,ม.2',
    },
  },
  'curriculum': {
    'คาบ/สัปดาห์': {
      check: function(v) { return /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0; },
      msg: 'ต้องเป็นจำนวนบวก เช่น 3 หรือ 1.5',
    },
  },
  'room': {
    'room_id': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุroom_id',
    },
  },
  'elective': {
    'รหัสวิชา': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุรหัสวิชา',
    },
    'ชื่อวิชา (เสรี)': {
      check: function(v) { return v.length > 0; },
      msg: 'ต้องระบุชื่อวิชา',
    },
  },
};

var COLOR_HEADER_BG = { red: 0.91, green: 0.92, blue: 0.96 }; // #E8EAF6

// ─── Web App Entry Point ─────────────────────────────────────────────────────

/**
 * doPost(e) — Google Apps Script Web App handler.
 *
 * Called by the Next.js /api/sheets/copy route (server-side fetch).
 * Accepts JSON body: { userEmail: string, title?: string }
 * Returns JSON: { success: true, spreadsheetId: string, url: string }
 *            or { success: false, error: string }
 *
 * Deployment requirements:
 *   Execute as: Me
 *   Who has access: Anyone   ← must be "Anyone", NOT "Anyone with Google account"
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    
    // Add ability to securely read spreadsheet data as the Domain User
    if (body.action === 'read_sheet') {
      return _handleReadSheet(body.spreadsheetId);
    }

    var userEmail = body.userEmail || body.email; // accept both field names
    var title = body.title || 'Schedool Workspace';

    if (!userEmail) {
      return _jsonResponse({ success: false, error: 'userEmail is required' });
    }

    // Copy the template spreadsheet
    var templateId = PropertiesService.getScriptProperties().getProperty('TEMPLATE_ID')
      || '14hgR1XI-RgqPjc6pKhfdPxR7DbX8Gejrbl4P68PrOgE'; // fallback to hardcoded id

    var template = DriveApp.getFileById(templateId);
    var copy = template.makeCopy(title, DriveApp.getRootFolder());

    // Share with the requester
    copy.addEditor(userEmail);
    // Allow Schedool Backend service account to read/update the workbook without user setting anything
    copy.addEditor('sheet-bot@absolute-runner-331411.iam.gserviceaccount.com');
    // Important: Allow the NextJS client to fetch XLSX directly without Google wall blocking it
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var spreadsheetId = copy.getId();
    var spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';

    return _jsonResponse({
      success: true,
      spreadsheetId: spreadsheetId,
      url: spreadsheetUrl,
    });

  } catch (err) {
    return _jsonResponse({ success: false, error: err.message });
  }
}

/**
 * doGet(e) — Health check endpoint.
 * Visit the /exec URL in a browser to confirm the Web App is deployed and reachable.
 */
function doGet(e) {
  return _jsonResponse({ status: 'ok', message: 'Schedool GAS Web App is running.' });
}

/**
 * Returns a JSON ContentService response with proper MIME type.
 * Google Apps Script requires this specific pattern for Web App responses.
 */
function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

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

  // Ensure installable triggers exist so the menu appears on every open
  // and onEdit fires with proper permissions.
  createTriggerIfNeeded_();
}

/**
 * Creates installable onOpen and onEdit triggers if they don't exist yet.
 * Called automatically on first open via the simple onOpen trigger.
 */
function createTriggerIfNeeded_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getUserTriggers(ss);

  var hasOpen = false;
  var hasEdit = false;

  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getEventType() === ScriptApp.EventType.ON_OPEN) hasOpen = true;
    if (t.getEventType() === ScriptApp.EventType.ON_EDIT) hasEdit = true;
  }

  if (!hasOpen) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(ss)
      .onOpen()
      .create();
  }

  if (!hasEdit) {
    ScriptApp.newTrigger('onEditInstallable')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
}

// ─── onEdit — Live Per-Cell Validation ────────────────────────────────────────

/**
 * Simple onEdit trigger (limited permissions).
 * Delegates to internal logic; catches all errors to avoid breaking the sheet.
 */
function onEdit(e) {
  // Intentionally a no-op. The installable trigger (onEditInstallable) handles
  // all edit validation with full permissions. This simple trigger is kept to
  // satisfy the GAS contract but does NOT call _handleEdit, because both
  // triggers fire on every edit and that causes double-execution + race conditions.
  // The installable trigger is auto-created by createTriggerIfNeeded_() on first open.
}

/**
 * Installable onEdit trigger (full permissions, registered via createTriggerIfNeeded_).
 * Same logic as simple onEdit but runs with higher quota limits.
 */
function onEditInstallable(e) {
  try {
    _handleEdit(e);
  } catch (err) {
    // Never let onEdit crash — silently swallow errors.
  }
}

/**
 * Core logic for live per-cell validation on edit.
 * Only validates the single edited cell. NEVER runs runValidation() or cross-tab checks.
 * (Exception: Teacher name fuzzy matching is enabled for high-priority UX).
 */
function _handleEdit(e) {
  if (!e || !e.range) return;

  var range = e.range;
  var sheet = range.getSheet();
  var editedRow = range.getRow();
  var editedCol = range.getColumn();

  // Guard: skip header row
  if (editedRow === 1) return;

  // Find canonical tab name from sheet name
  var sheetName = sheet.getName().trim();
  var tabName = null;
  var canonicalNames = Object.keys(TAB_ALIASES);
  for (var i = 0; i < canonicalNames.length; i++) {
    var aliases = TAB_ALIASES[canonicalNames[i]];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] === sheetName) {
        tabName = canonicalNames[i];
        break;
      }
    }
    if (tabName) break;
  }

  // Guard: not a known data tab (e.g. "Validation Results")
  if (!tabName) return;

  // Guard: skip the example row (row 2) only if it still contains example data.
  // If the user overwrote the example with real data, we MUST validate it.
  if (editedRow === 2) {
    for (var d = 0; d < TAB_DEFS.length; d++) {
      if (TAB_DEFS[d].name === tabName) {
        var row2Vals = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
        if (isExampleRow_(TAB_DEFS[d], row2Vals)) return;
        break;
      }
    }
  }

  // Get the column header from row 1
  var headerCell = sheet.getRange(1, editedCol);
  var headerName = sanitize(headerCell.getValue());
  if (!headerName) return;

  // Get and sanitize the edited value
  var rawValue = e.value !== undefined ? e.value : range.getValue();
  var cleanValue = sanitize(String(rawValue));
  var cell = sheet.getRange(editedRow, editedCol);

  // If cell is blank, clear any previous error styling and exit
  if (!cleanValue) {
    cell.setBackground(null);
    cell.clearNote();
    return;
  }

  // ── 1. High-Impact Referential Check: Teacher Name Fuzzy Matching ─────────
  // We allow this in onEdit because it's a critical UX piece.
  var isTeacherCol = (headerName === 'ครู' || headerName === 'ครูผู้สอน' || tabName === 'scout');
  if (isTeacherCol) {
    var validNames = _getCachedTeacherNames();
    if (validNames.length > 0) {
      var items = splitAndSanitize(cleanValue);
      var missing = [];
      var suggestion = '';

      for (var k = 0; k < items.length; k++) {
        var item = items[k];
        if (validNames.indexOf(item) === -1) {
          missing.push(item);
          if (!suggestion) suggestion = fuzzyMatchTeacher(item, validNames);
        }
      }

      if (missing.length > 0) {
        var msg = 'ไม่พบชื่อครู: ' + missing.join(', ');
        if (suggestion) msg += '\nคุณหมายถึง "' + suggestion + '" หรือไม่?';
        cell.setBackground(COLOR_RED);
        cell.setNote('⚠ ' + msg);
        return; // Skip structural checks if referential check fails
      }
    }
  }

  // ── 2. Standard Structural Checks ──────────────────────────────────────────
  var tabValidators = CELL_VALIDATORS[tabName];
  if (tabValidators) {
    var validator = tabValidators[headerName];
    if (validator) {
      if (validator.check(cleanValue)) {
        cell.setBackground(null);
        cell.clearNote();
      } else {
        cell.setBackground(COLOR_RED);
        cell.setNote('⚠ ' + validator.msg);
      }
      return;
    }
  }

  // If no specific validator, only clear error/warning state — don't touch green markers or clean cells.
  var currentBg = cell.getBackground();
  if (currentBg === COLOR_RED || currentBg === COLOR_YELLOW) {
    cell.setBackground(null);
    cell.clearNote();
  }
}

/**
 * Returns cached teacher names for onEdit fuzzy matching.
 * Uses CacheService to avoid reading the teacher sheet on every keystroke.
 * Cache TTL: 60 seconds — edits to the teacher tab are reflected within a minute.
 */
function _getCachedTeacherNames() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('onEdit_teacherNames');
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var teacherSheet = getSheetByAliases(ss, 'teacher');
  if (!teacherSheet) return [];

  var tData = teacherSheet.getDataRange().getValues();
  var tHeaders = tData[0].map(function(h) { return sanitize(h); });
  var tNameIdx = tHeaders.indexOf('ชื่อ');
  var validNames = [];
  if (tNameIdx !== -1) {
    for (var r = 1; r < tData.length; r++) {
      var n = sanitize(tData[r][tNameIdx]);
      if (n && !isSkipRow(sanitize(tData[r][0]))) validNames.push(n);
    }
  }

  cache.put('onEdit_teacherNames', JSON.stringify(validNames), 60);
  return validNames;
}

// ─── Skeleton Generation ──────────────────────────────────────────────────────

/**
 * Generates the skeleton structure: creates missing tabs, writes headers,
 * inserts an example data row, applies data validation dropdowns,
 * applies conditional formatting rules, formats header rows,
 * and protects them so only the spreadsheet owner can edit.
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
    var isEmpty = existing.every(function(c) { return !sanitize(c); });
    if (isEmpty) {
      headerRange.setValues([def.headers]);
    }

    // Format header row
    sheet.getRange(1, 1, 1, def.headers.length)
      .setFontWeight('bold')
      .setBackground('#E8EAF6')
      .setFontStyle('normal')
      .setFontColor('#000000');

    // Freeze header row
    sheet.setFrozenRows(1);

    // ── Insert example row (row 2) ──────────────────────────────────────────
    _insertExampleRow_(sheet, def);

    // ── Apply native data validation dropdowns ──────────────────────────────
    var headers = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0]
      .map(function(h) { return sanitize(h); });
    applyDataValidations_(sheet, def.name, headers);

    // ── Apply conditional formatting rules ──────────────────────────────────
    applyConditionalFormatting_(sheet, def.name, headers);

    // ── Add info notes to validated column headers ──────────────────────────
    _addValidationHints_(sheet, def.name, headers);

    // Protect header row — only owner can edit
    lockHeaderRow_(sheet);
  }

  ui.alert(
    'Skeleton Generated',
    'All tabs are ready.\n\n' +
    '• Row 2 in each tab shows an example — delete it before entering real data.\n' +
    '• Dropdowns guide you in cells that accept specific values.\n' +
    '• Cells turn red instantly if you type in the wrong format.\n\n' +
    'The header row of each tab is locked so only the owner can edit headers.',
    ui.ButtonSet.OK
  );
}

/**
 * Inserts a formatted example row (row 2) into the sheet.
 * Shows realistic data in gray/italic with a deletion reminder note.
 */
function _insertExampleRow_(sheet, def) {
  if (!def.exampleRow || def.exampleRow.length === 0) return;

  var exampleRange = sheet.getRange(2, 1, 1, def.exampleRow.length);

  // Check if row 2 is already occupied with non-example data.
  // Only write the example if row 2 is fully empty.
  var currentRow2 = exampleRange.getValues()[0];
  var row2IsEmpty = currentRow2.every(function(c) { return !sanitize(c); });
  if (!row2IsEmpty) return;

  exampleRange.setValues([def.exampleRow]);
  exampleRange
    .setFontStyle('italic')
    .setFontColor('#9E9E9E')
    .setBackground('#FFF9C4');

  // Add a deletion reminder note on all cells of the example row (not just A2)
  for (var c = 1; c <= def.exampleRow.length; c++) {
    sheet.getRange(2, c).setNote('⬆ ตัวอย่าง — ลบแถวนี้ก่อนกรอกข้อมูลจริง');
  }
}

/**
 * Checks whether a given data row matches the example row for this tab definition.
 * Used by validators to auto-skip example rows the user forgot to delete.
 */
function isExampleRow_(def, row) {
  if (!def || !def.exampleRow || def.exampleRow.length === 0) return false;
  // Compare first 2 cells (sufficient to identify example row without false positives)
  var checkCols = Math.min(2, def.exampleRow.length);
  for (var i = 0; i < checkCols; i++) {
    if (sanitize(row[i]) !== sanitize(def.exampleRow[i])) return false;
  }
  return true;
}

/**
 * Applies native Google Sheets data validation dropdowns to specific columns.
 * Dropdowns are non-blocking (setAllowInvalid true) — they guide without hard-blocking.
 */
function applyDataValidations_(sheet, tabName, headers) {
  var rules = TAB_VALIDATIONS[tabName];
  if (!rules || rules.length === 0) return;

  var lastRow = 1000; // Apply to data range (rows 2–1000)

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var colIdx = headers.indexOf(sanitize(rule.column));
    if (colIdx === -1) continue; // Header not found — skip gracefully

    var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    var validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(rule.values, true)
      .setAllowInvalid(true) // Show dropdown but don't block custom values
      .build();

    colRange.setDataValidation(validation);
  }
}

/**
 * Applies conditional formatting rules that highlight invalid cell values in red.
 * These rules are permanent — they work even without the script running.
 */
function applyConditionalFormatting_(sheet, tabName, headers) {
  var rules = TAB_FORMAT_RULES[tabName];
  if (!rules || rules.length === 0) return;

  var lastRow = 1000;

  // Get existing conditional format rules and filter out any we previously set
  // to avoid duplicates on re-running generateSkeleton().
  var existingRules = sheet.getConditionalFormatRules();
  var newRules = [];

  // Retain rules we didn't create (user-defined rules)
  // We identify our rules by color (#FFCDD2). This is a heuristic — good enough.
  for (var k = 0; k < existingRules.length; k++) {
    try {
      var bg = existingRules[k].getBooleanCondition();
      if (bg && bg.getBackground() === '#FFCDD2') continue; // Our rule — skip (will re-add)
    } catch (_) { /* keep non-boolean rules (e.g. gradient rules) */ }
    newRules.push(existingRules[k]);
  }

  for (var i = 0; i < rules.length; i++) {
    var ruleDef = rules[i];
    var colIdx = headers.indexOf(sanitize(ruleDef.column));
    if (colIdx === -1) continue;

    // Convert 0-based index to A1 column letter
    var colLetter = columnIndexToLetter_(colIdx + 1);

    // Replace {COL} placeholder with actual column letter
    var formula = ruleDef.formula.replace(/\{COL\}/g, colLetter);

    var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    var cfRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground('#FFCDD2')
      .setRanges([colRange])
      .build();

    newRules.push(cfRule);
  }

  sheet.setConditionalFormatRules(newRules);
}

/**
 * Converts a 1-based column index to an A1 column letter.
 * e.g. 1 → 'A', 26 → 'Z', 27 → 'AA'
 */
function columnIndexToLetter_(colIndex) {
  var letter = '';
  while (colIndex > 0) {
    var remainder = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
}

/**
 * Adds informational notes to header cells of columns that have live validation.
 * Helps users understand which columns give instant feedback on edit.
 */
function _addValidationHints_(sheet, tabName, headers) {
  var tabValidators = CELL_VALIDATORS[tabName];
  if (!tabValidators) return;

  for (var headerName in tabValidators) {
    var colIdx = headers.indexOf(sanitize(headerName));
    if (colIdx === -1) continue;
    var headerCell = sheet.getRange(1, colIdx + 1);
    // Don't overwrite existing notes
    if (headerCell.getNote()) continue;
    headerCell.setNote('ℹ️ ตรวจสอบอัตโนมัติ: ' + tabValidators[headerName].msg);
  }
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
 * Run this once on existing sheets that were created before the skeleton was updated.
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

var COLOR_RED    = '#FFCDD2';  // error cell
var COLOR_YELLOW = '#FFF9C4';  // warning cell
var COLOR_GREEN  = '#C8E6C9';  // clean row indicator (col 1 only)
var COLOR_HEADER = '#E8EAF6';  // header row

/**
 * Applies CELL-LEVEL highlighting based on validation results.
 *
 * Strategy:
 * 1. Bulk-clear all backgrounds + notes in the data range first (efficient).
 * 2. For each error: color the specific problem cell red + add a note.
 * 3. For each warning: same in yellow (only if no error already on that cell).
 * 4. For clean, non-empty rows: color col 1 green as a subtle "row is OK" signal.
 *
 * This replaces the old row-level approach which painted entire rows.
 */
function applyHighlights(sheet, dataRowCount, errors, warnings, rawData) {
  if (dataRowCount <= 0) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return;

  // ── Step 1: Bulk clear all backgrounds and notes (one API call) ────────────
  sheet.getRange(2, 1, dataRowCount, lastCol)
    .setBackground(null)
    .clearNote();

  // ── Step 2: Build a cell → worst-status map ──────────────────────────────
  // Key: 'row:col' (1-based). Value: { status, message }
  var cellMap = {};

  for (var w = 0; w < warnings.length; w++) {
    var wr = warnings[w];
    var wKey = wr.row + ':' + wr.col;
    if (!cellMap[wKey]) {
      cellMap[wKey] = { status: 'warning', message: wr.message };
    }
  }
  for (var e = 0; e < errors.length; e++) {
    var er = errors[e];
    var eKey = er.row + ':' + er.col;
    // Error always overrides warning
    cellMap[eKey] = { status: 'error', message: er.message };
  }

  // ── Step 3: Track which rows have any error or warning ────────────────────
  var rowHasIssue = {};
  for (var key in cellMap) {
    var rowNum = parseInt(key.split(':')[0], 10);
    rowHasIssue[rowNum] = true;
  }

  // ── Step 4: Find the TAB_DEFS entry to check for example rows ────────────
  var sheetName = sheet.getName().trim();
  var tabDef = null;
  for (var d = 0; d < TAB_DEFS.length; d++) {
    var aliases = TAB_ALIASES[TAB_DEFS[d].name] || [];
    for (var a = 0; a < aliases.length; a++) {
      if (aliases[a] === sheetName) { tabDef = TAB_DEFS[d]; break; }
    }
    if (tabDef) break;
  }

  // ── Step 5: Apply per-cell colors for issues ─────────────────────────────
  for (var cellKey in cellMap) {
    var parts = cellKey.split(':');
    var cellRow = parseInt(parts[0], 10);
    var cellCol = parseInt(parts[1], 10);
    var info = cellMap[cellKey];

    // Skip if column index is out of bounds
    if (cellCol < 1 || cellCol > lastCol) continue;

    var color = (info.status === 'error') ? COLOR_RED : COLOR_YELLOW;
    sheet.getRange(cellRow, cellCol)
      .setBackground(color)
      .setNote('⚠ ' + info.message);
  }

  // ── Step 6: Mark clean, non-empty rows with a green col-1 indicator ───────
  for (var dr = 2; dr <= dataRowCount + 1; dr++) {
    var rowData = rawData[dr - 1]; // rawData is 0-indexed data array
    if (!rowData) continue;
    if (_isEmptyRow(rowData)) continue;
    if (isMarkerRow(rowData)) continue;

    // Auto-skip example rows the user forgot to delete
    if (tabDef && isExampleRow_(tabDef, rowData)) continue;

    if (!rowHasIssue[dr]) {
      // Row is clean — put a subtle green marker on col 1 only
      sheet.getRange(dr, 1).setBackground(COLOR_GREEN);
    }
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

  var allData = {};
  var sheets  = {};
  var structuralResults = {};

  // ── Phase 1: Structural Scan ──
  var tabNames = Object.keys(TAB_VALIDATORS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var sheet   = getSheetByAliases(ss, tabName);
    if (!sheet) continue;

    sheets[tabName] = sheet;
    var data = sheet.getDataRange().getValues().map(function(r) {
      return r.map(function(c) {
        if (c instanceof Date) return (c.getMonth() + 1) + '/' + c.getDate();
        return String(c);
      });
    });
    allData[tabName] = data;
    structuralResults[tabName] = TAB_VALIDATORS[tabName](data);
  }

  // ── Phase 2: Build Lookups & Referential Check ──
  var lookups = buildGASLookups(allData);

  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var structural = structuralResults[tabName];
    var sheet = sheets[tabName];

    if (!sheet) {
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

    var errors = structural.errors;
    var warnings = structural.warnings;

    // Run referential check if it exists for this tab
    if (REF_VALIDATORS[tabName]) {
      var refResult = REF_VALIDATORS[tabName](allData[tabName], lookups);
      errors = errors.concat(refResult.errors);
      warnings = warnings.concat(refResult.warnings);
    }

    var data = allData[tabName];
    applyHighlights(sheet, data.length - 1, errors, warnings, data);

    // Write summary row
    var errCount  = errors.length;
    var warnCount = warnings.length;
    var issueText = '';

    if (errCount > 0) {
      issueText += 'ERRORS:\n' +
        errors.map(function(e) { return '  Row ' + e.row + ': ' + e.message; }).join('\n');
    }
    if (warnCount > 0) {
      if (issueText) issueText += '\n\n';
      issueText += 'WARNINGS:\n' +
        warnings.map(function(w) { return '  Row ' + w.row + ': ' + w.message; }).join('\n');
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

  // Navigate to results
  ss.setActiveSheet(resultSheet);

  // Final summary alert
  if (allValid && totalWarnings === 0) {
    ui.alert('Validation Passed', 'All tabs are valid.', ui.ButtonSet.OK);
  } else if (allValid) {
    ui.alert('Validation Passed with Warnings', totalWarnings + ' warning(s) found. Check yellow cells for details.', ui.ButtonSet.OK);
  } else {
    ui.alert('Validation Failed', totalErrors + ' error(s) found. Check red cells for details.', ui.ButtonSet.OK);
  }
}
function _handleReadSheet(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheets = ss.getSheets();
    var result = {};
    for (var i = 0; i < sheets.length; i++) {
        var sheet = sheets[i];
        var name = sheet.getName();
        var data = sheet.getDataRange().getValues();
        result[name] = data;
    }
    return _jsonResponse({ success: true, data: result });
  } catch (err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}
