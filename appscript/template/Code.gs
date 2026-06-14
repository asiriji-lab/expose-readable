// ─── Code.gs (Template-bound script) ─────────────────────────────────────────
// Attached to the Schedool template spreadsheet.
// Copied automatically when a user creates a new workspace via the web app.
// Imports SchedoolLib (appscript/lib/) for all validation/parser logic.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Library Wrappers ────────────────────────────────────────────────────────
// Delegate to SchedoolLib so all existing code below needs no changes.
// In GAS project settings, add the library and set identifier to "SchedoolLib".

function sanitize(v)                    { return SchedoolLib.sanitize(v); }
function splitAndSanitize(v)            { return SchedoolLib.splitAndSanitize(v); }
function isMarkerRow(r)                 { return SchedoolLib.isMarkerRow(r); }
function isGradeHeader(v)               { return SchedoolLib.isGradeHeader(v); }
function isSkipRow(v)                   { return SchedoolLib.isSkipRow(v); }
function isValidTeacherId(v)            { return SchedoolLib.isValidTeacherId(v); }
function isValidClassId(v)              { return SchedoolLib.isValidClassId(v); }
function isValidTimeFormat(v)           { return SchedoolLib.isValidTimeFormat(v); }
function isValidApplyTo(v)              { return SchedoolLib.isValidApplyTo(v); }
function getInvalidSlotTokens(v)        { return SchedoolLib.getInvalidSlotTokens(v); }
function getInvalidPreplaceSlotTokens(v){ return SchedoolLib.getInvalidPreplaceSlotTokens(v); }
function fuzzyMatchTeacher(name, list)  { return SchedoolLib.fuzzyMatchTeacher(name, list); }
function parseStudentClassString(s)     { return SchedoolLib.parseStudentClassString(s); }

function validatePeriod(d)              { return SchedoolLib.validatePeriod(d); }
function validateRoom(d)                { return SchedoolLib.validateRoom(d); }
function validateTeacher(d)             { return SchedoolLib.validateTeacher(d); }
function validateStudent(d)             { return SchedoolLib.validateStudent(d); }
function validatePreplace(d)            { return SchedoolLib.validatePreplace(d); }
function validateScout(d)               { return SchedoolLib.validateScout(d); }
function validateElective(d)            { return SchedoolLib.validateElective(d); }
function validateCurriculum(d)          { return SchedoolLib.validateCurriculum(d); }
function validateConstraints(d)         { return SchedoolLib.validateConstraints(d); }
function buildGASLookups(d)             { return SchedoolLib.buildGASLookups(d); }
function validateRoomRefs(d, l)         { return SchedoolLib.validateRoomRefs(d, l); }
function validateCurriculumRefs(d, l)   { return SchedoolLib.validateCurriculumRefs(d, l); }
function validateElectiveRefs(d, l)     { return SchedoolLib.validateElectiveRefs(d, l); }
function validateStudentRefs(d, l)      { return SchedoolLib.validateStudentRefs(d, l); }
function validateScoutRefs(d, l)        { return SchedoolLib.validateScoutRefs(d, l); }

// ─────────────────────────────────────────────────────────────────────────────

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

var REF_VALIDATORS = {
  'room':       validateRoomRefs,
  'curriculum': validateCurriculumRefs,
  'elective':   validateElectiveRefs,
  'student':    validateStudentRefs,
  'scout':      validateScoutRefs,
};

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

var TAB_FORMAT_RULES = {
  'teacher': [
    { column: 'teacher_id', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^[TE]\\d{3,}$")))' },
    { column: 'ชื่อ',       formula: '=AND(ROW()>1,ISBLANK({COL}2),NOT(ISBLANK($A2)))' },
  ],
  'student': [
    { column: 'นักเรียน', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+/\\d+$")))' },
    { column: 'ชั้น',     formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^ม\\.[1-6]$")))' },
    { column: 'ห้อง',     formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+$")))' },
  ],
  'period': [
    { column: 'เวลา', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d{2}\\.\\d{2}-\\d{2}\\.\\d{2}$")),NOT(REGEXMATCH({COL}2,"^\\d+$")))' },
  ],
  'curriculum': [
    { column: 'คาบ/สัปดาห์', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+(\\.\\d+)?$")))' },
  ],
  'preplace': [
    { column: 'คาบ', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^(Everyday_\\d+|(MON|TUE|WED|THU|FRI)_\\d+)(,(Everyday_\\d+|(MON|TUE|WED|THU|FRI)_\\d+))*$")))' },
  ],
};

var CELL_VALIDATORS = {
  'teacher': {
    'teacher_id': { check: function(v) { return isValidTeacherId(v); }, msg: 'ต้องเป็น T### หรือ E### (อย่างน้อย 3 หลัก) เช่น T001' },
    'ชื่อ':       { check: function(v) { return v.length > 0; },        msg: 'ต้องระบุชื่อครู' },
  },
  'student': {
    'นักเรียน': { check: function(v) { return isValidClassId(v); },                             msg: 'ต้องเป็นรูปแบบ G/S เช่น 1/1' },
    'ชั้น':     { check: function(v) { return /^ม\.[1-6]$/.test(v); },                          msg: 'ต้องเป็น ม.1–ม.6' },
    'ห้อง':     { check: function(v) { return /^\d+$/.test(v) && parseInt(v, 10) > 0; },        msg: 'ต้องเป็นจำนวนเต็มบวก' },
  },
  'period': {
    'คาบ':  { check: function(v) { return v.length > 0; },          msg: 'ต้องระบุชื่อคาบ' },
    'เวลา': { check: function(v) { return isValidTimeFormat(v); },  msg: 'ต้องเป็น HH.MM-HH.MM หรือตัวเลข (นาที) เช่น 08.30-09.20 หรือ 50' },
  },
  'preplace': {
    'ชื่อ':     { check: function(v) { return v.length > 0; },                                   msg: 'ต้องระบุชื่อ slot' },
    'คาบ':      { check: function(v) { return getInvalidPreplaceSlotTokens(v).length === 0; },   msg: 'รูปแบบ slot ไม่ถูกต้อง — ใช้ Everyday_1, MON_1 หรือ MON_1-FRI_5' },
    'apply_to': { check: function(v) { return isValidApplyTo(v); },                              msg: 'ต้องเป็น All, ม.X หรือรายการคั่นด้วยจุลภาค เช่น ม.1,ม.2' },
  },
  'curriculum': {
    'คาบ/สัปดาห์': { check: function(v) { return /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0; }, msg: 'ต้องเป็นจำนวนบวก เช่น 3 หรือ 1.5' },
  },
  'room': {
    'room_id': { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุรหัสห้อง' },
  },
  'elective': {
    'รหัสวิชา':       { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุรหัสวิชา' },
    'ชื่อวิชา (เสรี)': { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุชื่อวิชา' },
  },
};

var COLOR_HEADER_BG = { red: 0.91, green: 0.92, blue: 0.96 };

// ─── Sheet Lookup ─────────────────────────────────────────────────────────────

function getSheetByAliases(ss, tabName) {
  var aliases = TAB_ALIASES[tabName] || [tabName];
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var trimmedName = allSheets[i].getName().trim();
    for (var j = 0; j < aliases.length; j++) {
      if (trimmedName === aliases[j]) return allSheets[i];
    }
  }
  return null;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ScheDool')
    .addItem('Validate All Tabs', 'runValidation')
    .addItem('Generate Skeleton', 'generateSkeleton')
    .addItem('Fix Curriculum Headers', 'fixCurriculumHeaders')
    .addSeparator()
    .addItem('Debug: Show Tab Names', 'debugTabNames')
    .addToUi();

  createTriggerIfNeeded_();
}

function createTriggerIfNeeded_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getUserTriggers(ss);
  var hasOpen = false, hasEdit = false;
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getEventType() === ScriptApp.EventType.ON_OPEN) hasOpen = true;
    if (t.getEventType() === ScriptApp.EventType.ON_EDIT) hasEdit = true;
  }
  if (!hasOpen) ScriptApp.newTrigger('onOpen').forSpreadsheet(ss).onOpen().create();
  if (!hasEdit) ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
}

// ─── onEdit ──────────────────────────────────────────────────────────────────

function onEdit(e) {
  // no-op — installable trigger handles it
}

function onEditInstallable(e) {
  try { _handleEdit(e); } catch (err) {}
}

function _handleEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var sheet = range.getSheet();
  var editedRow = range.getRow();
  var editedCol = range.getColumn();
  if (editedRow === 1) return;

  var sheetName = sheet.getName().trim();
  var tabName = null;
  var canonicalNames = Object.keys(TAB_ALIASES);
  for (var i = 0; i < canonicalNames.length; i++) {
    var aliases = TAB_ALIASES[canonicalNames[i]];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] === sheetName) { tabName = canonicalNames[i]; break; }
    }
    if (tabName) break;
  }
  if (!tabName) return;

  if (editedRow === 2) {
    for (var d = 0; d < TAB_DEFS.length; d++) {
      if (TAB_DEFS[d].name === tabName) {
        var row2Vals = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
        if (isExampleRow_(TAB_DEFS[d], row2Vals)) return;
        break;
      }
    }
  }

  var headerCell = sheet.getRange(1, editedCol);
  var headerName = sanitize(headerCell.getValue());
  if (!headerName) return;

  var rawValue = e.value !== undefined ? e.value : range.getValue();
  var cleanValue = sanitize(String(rawValue));
  var cell = sheet.getRange(editedRow, editedCol);

  if (!cleanValue) {
    cell.setBackground(null);
    cell.clearNote();
    return;
  }

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
        return;
      }
    }
  }

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

  var currentBg = cell.getBackground();
  if (currentBg === COLOR_RED || currentBg === COLOR_YELLOW) {
    cell.setBackground(null);
    cell.clearNote();
  }
}

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

function generateSkeleton() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  for (var i = 0; i < TAB_DEFS.length; i++) {
    var def = TAB_DEFS[i];
    var sheet = getSheetByAliases(ss, def.name);
    if (!sheet) sheet = ss.insertSheet(def.name);

    var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    var existing = headerRange.getValues()[0];
    var isEmpty = existing.every(function(c) { return !sanitize(c); });
    if (isEmpty) headerRange.setValues([def.headers]);

    sheet.getRange(1, 1, 1, def.headers.length)
      .setFontWeight('bold').setBackground('#E8EAF6')
      .setFontStyle('normal').setFontColor('#000000');
    sheet.setFrozenRows(1);

    _insertExampleRow_(sheet, def);

    var headers = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0]
      .map(function(h) { return sanitize(h); });
    applyDataValidations_(sheet, def.name, headers);
    applyConditionalFormatting_(sheet, def.name, headers);
    _addValidationHints_(sheet, def.name, headers);
    lockHeaderRow_(sheet);
  }

  ui.alert('Skeleton Generated',
    'All tabs are ready.\n\n' +
    '• Row 2 in each tab shows an example — delete it before entering real data.\n' +
    '• Dropdowns guide you in cells that accept specific values.\n' +
    '• Cells turn red instantly if you type in the wrong format.\n\n' +
    'The header row of each tab is locked so only the owner can edit headers.',
    ui.ButtonSet.OK);
}

function _insertExampleRow_(sheet, def) {
  if (!def.exampleRow || def.exampleRow.length === 0) return;
  var exampleRange = sheet.getRange(2, 1, 1, def.exampleRow.length);
  var currentRow2 = exampleRange.getValues()[0];
  var row2IsEmpty = currentRow2.every(function(c) { return !sanitize(c); });
  if (!row2IsEmpty) return;

  exampleRange.setValues([def.exampleRow]);
  exampleRange.setFontStyle('italic').setFontColor('#9E9E9E').setBackground('#FFF9C4');
  for (var c = 1; c <= def.exampleRow.length; c++) {
    sheet.getRange(2, c).setNote('⬆ ตัวอย่าง — ลบแถวนี้ก่อนกรอกข้อมูลจริง');
  }
}

function isExampleRow_(def, row) {
  if (!def || !def.exampleRow || def.exampleRow.length === 0) return false;
  var checkCols = Math.min(2, def.exampleRow.length);
  for (var i = 0; i < checkCols; i++) {
    if (sanitize(row[i]) !== sanitize(def.exampleRow[i])) return false;
  }
  return true;
}

function applyDataValidations_(sheet, tabName, headers) {
  var rules = TAB_VALIDATIONS[tabName];
  if (!rules || rules.length === 0) return;
  var lastRow = 1000;
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    var colIdx = headers.indexOf(sanitize(rule.column));
    if (colIdx === -1) continue;
    var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    var validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(rule.values, true).setAllowInvalid(true).build();
    colRange.setDataValidation(validation);
  }
}

function applyConditionalFormatting_(sheet, tabName, headers) {
  var rules = TAB_FORMAT_RULES[tabName];
  if (!rules || rules.length === 0) return;
  var lastRow = 1000;

  var existingRules = sheet.getConditionalFormatRules();
  var newRules = [];
  for (var k = 0; k < existingRules.length; k++) {
    try {
      var bg = existingRules[k].getBooleanCondition();
      if (bg && bg.getBackground() === '#FFCDD2') continue;
    } catch (_) {}
    newRules.push(existingRules[k]);
  }

  for (var i = 0; i < rules.length; i++) {
    var ruleDef = rules[i];
    var colIdx = headers.indexOf(sanitize(ruleDef.column));
    if (colIdx === -1) continue;
    var colLetter = columnIndexToLetter_(colIdx + 1);
    var formula = ruleDef.formula.replace(/\{COL\}/g, colLetter);
    var colRange = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    var cfRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula).setBackground('#FFCDD2').setRanges([colRange]).build();
    newRules.push(cfRule);
  }
  sheet.setConditionalFormatRules(newRules);
}

function columnIndexToLetter_(colIndex) {
  var letter = '';
  while (colIndex > 0) {
    var remainder = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
}

function _addValidationHints_(sheet, tabName, headers) {
  var tabValidators = CELL_VALIDATORS[tabName];
  if (!tabValidators) return;
  for (var headerName in tabValidators) {
    var colIdx = headers.indexOf(sanitize(headerName));
    if (colIdx === -1) continue;
    var headerCell = sheet.getRange(1, colIdx + 1);
    if (headerCell.getNote()) continue;
    headerCell.setNote('ℹ️ ตรวจสอบอัตโนมัติ: ' + tabValidators[headerName].msg);
  }
}

function lockHeaderRow_(sheet) {
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var p = 0; p < protections.length; p++) {
    var prot = protections[p];
    var range = prot.getRange();
    if (range.getRow() === 1 && range.getNumRows() === 1) prot.remove();
  }
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
  var protection = headerRow.protect().setDescription('Header — owner only');
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}

// ─── Validation Runner ────────────────────────────────────────────────────────

var COLOR_RED    = '#FFCDD2';
var COLOR_YELLOW = '#FFF9C4';
var COLOR_GREEN  = '#C8E6C9';
var COLOR_HEADER = '#E8EAF6';

function applyHighlights(sheet, dataRowCount, errors, warnings, rawData) {
  if (dataRowCount <= 0) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return;

  sheet.getRange(2, 1, dataRowCount, lastCol).setBackground(null).clearNote();

  var cellMap = {};
  for (var w = 0; w < warnings.length; w++) {
    var wr = warnings[w];
    var wKey = wr.row + ':' + wr.col;
    if (!cellMap[wKey]) cellMap[wKey] = { status: 'warning', message: wr.message };
  }
  for (var e = 0; e < errors.length; e++) {
    var er = errors[e];
    var eKey = er.row + ':' + er.col;
    cellMap[eKey] = { status: 'error', message: er.message };
  }

  var rowHasIssue = {};
  for (var key in cellMap) {
    rowHasIssue[parseInt(key.split(':')[0], 10)] = true;
  }

  var sheetName = sheet.getName().trim();
  var tabDef = null;
  for (var d = 0; d < TAB_DEFS.length; d++) {
    var aliases = TAB_ALIASES[TAB_DEFS[d].name] || [];
    for (var a = 0; a < aliases.length; a++) {
      if (aliases[a] === sheetName) { tabDef = TAB_DEFS[d]; break; }
    }
    if (tabDef) break;
  }

  for (var cellKey in cellMap) {
    var parts = cellKey.split(':');
    var cellRow = parseInt(parts[0], 10);
    var cellCol = parseInt(parts[1], 10);
    var info = cellMap[cellKey];
    if (cellCol < 1 || cellCol > lastCol) continue;
    var color = (info.status === 'error') ? COLOR_RED : COLOR_YELLOW;
    sheet.getRange(cellRow, cellCol).setBackground(color).setNote('⚠ ' + info.message);
  }

  for (var dr = 2; dr <= dataRowCount + 1; dr++) {
    var rowData = rawData[dr - 1];
    if (!rowData) continue;
    if (_isEmptyRow(rowData)) continue;
    if (isMarkerRow(rowData)) continue;
    if (tabDef && isExampleRow_(tabDef, rowData)) continue;
    if (!rowHasIssue[dr]) sheet.getRange(dr, 1).setBackground(COLOR_GREEN);
  }
}

function _isEmptyRow(row) {
  return row.every(function(c) { return !sanitize(c); });
}

function runValidation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var resultSheet = ss.getSheetByName('Validation Results');
  if (!resultSheet) resultSheet = ss.insertSheet('Validation Results');
  resultSheet.clearContents();
  resultSheet.clearFormats();

  resultSheet.getRange(1, 1, 1, 3).setValues([['Tab', 'Status', 'Issues']]);
  resultSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground(COLOR_HEADER);
  resultSheet.setFrozenRows(1);

  var resultRow = 2;
  var allValid = true;
  var totalErrors = 0, totalWarnings = 0;
  var allData = {}, sheets = {}, structuralResults = {};

  var tabNames = Object.keys(TAB_VALIDATORS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var sheet = getSheetByAliases(ss, tabName);
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

  var lookups = buildGASLookups(allData);

  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var structural = structuralResults[tabName];
    var sheet = sheets[tabName];

    if (!sheet) {
      if (tabName === 'constraints') {
        resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'SKIPPED', 'Optional tab not found.']]);
        resultSheet.getRange(resultRow, 2).setBackground(COLOR_YELLOW).setFontColor('#F57F17');
      } else {
        resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'MISSING', 'Tab not found.']]);
        resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
        allValid = false; totalErrors++;
      }
      resultRow++;
      continue;
    }

    var errors = structural.errors;
    var warnings = structural.warnings;

    if (REF_VALIDATORS[tabName]) {
      var refResult = REF_VALIDATORS[tabName](allData[tabName], lookups);
      errors = errors.concat(refResult.errors);
      warnings = warnings.concat(refResult.warnings);
    }

    var data = allData[tabName];
    applyHighlights(sheet, data.length - 1, errors, warnings, data);

    var errCount = errors.length, warnCount = warnings.length;
    var issueText = '';
    if (errCount > 0) issueText += 'ERRORS:\n' + errors.map(function(e) { return '  Row ' + e.row + ': ' + e.message; }).join('\n');
    if (warnCount > 0) {
      if (issueText) issueText += '\n\n';
      issueText += 'WARNINGS:\n' + warnings.map(function(w) { return '  Row ' + w.row + ': ' + w.message; }).join('\n');
    }

    if (errCount === 0 && warnCount === 0) {
      resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'PASSED', '']]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_GREEN).setFontColor('#1B5E20');
    } else if (errCount === 0) {
      resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'WARNINGS (' + warnCount + ')', issueText]]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_YELLOW).setFontColor('#F57F17');
    } else {
      resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'ERRORS (' + errCount + ')', issueText]]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
      allValid = false;
    }
    totalErrors += errCount; totalWarnings += warnCount;
    resultRow++;
  }

  resultSheet.autoResizeColumn(1);
  resultSheet.autoResizeColumn(2);
  resultSheet.setColumnWidth(3, 600);
  resultSheet.getRange(2, 3, Math.max(resultRow - 2, 1), 1).setWrap(true);
  ss.setActiveSheet(resultSheet);

  if (allValid && totalWarnings === 0) {
    ui.alert('Validation Passed', 'All tabs are valid.', ui.ButtonSet.OK);
  } else if (allValid) {
    ui.alert('Validation Passed with Warnings', totalWarnings + ' warning(s) found.', ui.ButtonSet.OK);
  } else {
    ui.alert('Validation Failed', totalErrors + ' error(s) found.', ui.ButtonSet.OK);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fixCurriculumHeaders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheetByAliases(ss, 'curriculum');
  if (!sheet) { ui.alert('Fix Curriculum Headers', 'ไม่พบแท็บ curriculum', ui.ButtonSet.OK); return; }

  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) { ui.alert('Fix Curriculum Headers', 'แท็บ curriculum ว่างเปล่า', ui.ButtonSet.OK); return; }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var RENAMES = { 'รหัสวิชา 2': 'คาบเรียน' };
  var fixed = 0;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (RENAMES[h]) { sheet.getRange(1, i + 1).setValue(RENAMES[h]); fixed++; }
  }
  ui.alert('Fix Curriculum Headers', fixed > 0 ? 'แก้ไข ' + fixed + ' คอลัมน์เรียบร้อยแล้ว' : 'ไม่พบคอลัมน์ที่ต้องแก้ไข', ui.ButtonSet.OK);
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
  SpreadsheetApp.getUi().alert('Tab names:\n\n' + lines.join('\n'));
}
