// ─── Code.gs (Template-bound script) ─────────────────────────────────────────
// Attached to the Schedool template spreadsheet.
// Copied automatically when a user creates a new workspace via the web app.
// Imports ScheDoolLib (appscript/lib/) for all validation/parser logic.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Library Wrappers ────────────────────────────────────────────────────────

function sanitize(v)                      { return ScheDoolLib.sanitize(v); }
function splitAndSanitize(v)              { return ScheDoolLib.splitAndSanitize(v); }
function isMarkerRow(r)                   { return ScheDoolLib.isMarkerRow(r); }
function isGradeHeader(v)                 { return ScheDoolLib.isGradeHeader(v); }
function isSkipRow(v)                     { return ScheDoolLib.isSkipRow(v); }
function isValidTeacherId(v)              { return ScheDoolLib.isValidTeacherId(v); }
function isValidClassId(v)                { return ScheDoolLib.isValidClassId(v); }
function isValidTimeFormat(v)             { return ScheDoolLib.isValidTimeFormat(v); }
function isValidStudentsToken(v)          { return ScheDoolLib.isValidStudentsToken(v); }
function isValidTeachersToken(v)          { return ScheDoolLib.isValidTeachersToken(v); }
function getInvalidSlotTokens(v)          { return ScheDoolLib.getInvalidSlotTokens(v); }
function getInvalidPreplaceSlotTokens(v)  { return ScheDoolLib.getInvalidPreplaceSlotTokens(v); }
function fuzzyMatchTeacher(name, list)    { return ScheDoolLib.fuzzyMatchTeacher(name, list); }
function parseStudentClassString(s)       { return ScheDoolLib.parseStudentClassString(s); }
function parsePipeSegments(v)             { return ScheDoolLib.parsePipeSegments(v); }
function parseBlockPattern(v)             { return ScheDoolLib.parseBlockPattern(v); }
function parseConstraintType(v)           { return ScheDoolLib.parseConstraintType(v); }

function validatePeriod(d)                { return ScheDoolLib.validatePeriod(d); }
function validateRoom(d)                  { return ScheDoolLib.validateRoom(d); }
function validateTeacher(d)               { return ScheDoolLib.validateTeacher(d); }
function validateStudent(d)               { return ScheDoolLib.validateStudent(d); }
function validatePreplace(d)              { return ScheDoolLib.validatePreplace(d); }
function validateElective(d)              { return ScheDoolLib.validateElective(d); }
function validateCurriculum(d)            { return ScheDoolLib.validateCurriculum(d); }
function buildGASLookups(d)               { return ScheDoolLib.buildGASLookups(d); }
function validateRoomRefs(d, l)           { return ScheDoolLib.validateRoomRefs(d, l); }
function validateCurriculumRefs(d, l)     { return ScheDoolLib.validateCurriculumRefs(d, l); }
function validateElectiveRefs(d, l)       { return ScheDoolLib.validateElectiveRefs(d, l); }
function validateStudentRefs(d, l)        { return ScheDoolLib.validateStudentRefs(d, l); }
function validateTeacherRefs(d, l)        { return ScheDoolLib.validateTeacherRefs(d, l); }
function validatePreplaceRefs(d, l)       { return ScheDoolLib.validatePreplaceRefs(d, l); }

// ─────────────────────────────────────────────────────────────────────────────

var TAB_VALIDATORS = {
  'curriculum': validateCurriculum,
  'elective':   validateElective,
  'preplace':   validatePreplace,
  'period':     validatePeriod,
  'teacher':    validateTeacher,
  'student':    validateStudent,
  'room':       validateRoom,
};

var REF_VALIDATORS = {
  'room':       validateRoomRefs,
  'curriculum': validateCurriculumRefs,
  'elective':   validateElectiveRefs,
  'student':    validateStudentRefs,
  'teacher':    validateTeacherRefs,
  'preplace':   validatePreplaceRefs,
};

var TAB_ALIASES = {
  'curriculum': ['curriculum', 'Curriculum', 'หลักสูตร'],
  'elective':   ['elective',   'Elective',   'วิชาเสรี'],
  'preplace':   ['preplace',   'Preplace',   'ตรึงคาบ'],
  'period':     ['period',     'Period',     'คาบ'],
  'teacher':    ['teacher',    'Teacher',    'ครู'],
  'student':    ['student',    'Student',    'นักเรียน'],
  'room':       ['room',       'Room',       'ห้อง'],
};

// Tab order matches left-to-right sheet order: curriculum → elective → preplace → period → teacher → student → room
var TAB_DEFS = [
  {
    name: 'curriculum',
    headers: ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'ครูผู้สอน', 'การแบ่งคาบสอน', 'ห้อง (นักเรียน) ที่สอน', 'เงื่อนไขพิเศษ', 'ห้องเรียน', 'คาบเรียน'],
  },
  {
    name: 'elective',
    headers: ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'คาบ'],
  },
  {
    name: 'preplace',
    headers: ['ชื่อ', 'คาบ', 'นักเรียน', 'ครู'],
  },
  {
    name: 'period',
    headers: ['คาบ', 'เวลา'],
  },
  {
    name: 'teacher',
    headers: ['teacher_id', 'คำนำหน้า', 'ชื่อ', 'กลุ่มสาระ', 'available_slots', 'homeroom_class', 'หมายเหตุ'],
  },
  {
    name: 'student',
    headers: ['class_id', 'homeroom_room'],
  },
  {
    name: 'room',
    headers: ['room_id', 'ชื่อห้อง', 'ประเภท'],
  },
];

var TAB_VALIDATIONS = {
  'room': [
    { column: 'ประเภท', values: ['homeroom', 'exclude'] },
  ],
};

var TAB_FORMAT_RULES = {
  'teacher': [
    { column: 'teacher_id',     formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^[TE]\\d{3,}$")))' },
    { column: 'ชื่อ',           formula: '=AND(ROW()>1,ISBLANK({COL}2),NOT(ISBLANK($A2)))' },
    { column: 'homeroom_class', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+/\\d+$")))' },
  ],
  'student': [
    { column: 'class_id', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+/\\d+$")))' },
  ],
  'period': [
    { column: 'เวลา', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d{2}\\.\\d{2}-\\d{2}\\.\\d{2}$")),NOT(REGEXMATCH({COL}2,"^\\d+$")))' },
  ],
  'curriculum': [
    { column: 'คาบ/สัปดาห์',      formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+$")))' },
    { column: 'การแบ่งคาบสอน',    formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^\\d+(-\\d+)*$")))' },
    { column: 'เงื่อนไขพิเศษ',    formula: '=AND(NOT(ISBLANK({COL}2)),REGEXMATCH({COL}2,"type="),NOT(REGEXMATCH({COL}2,"type=(TEAM|MULTI_CLASS_TEAM|SUB_GROUP|TEACHER_SPLIT|SEPARATE_SLOT)")))' },
  ],
  'preplace': [
    { column: 'คาบ', formula: '=AND(NOT(ISBLANK({COL}2)),NOT(REGEXMATCH({COL}2,"^(DAILY_\\d+(-\\d+)?|(MON|TUE|WED|THU|FRI)_\\d+(-\\d+)?)(,(DAILY_\\d+(-\\d+)?|(MON|TUE|WED|THU|FRI)_\\d+(-\\d+)?))*$")))' },
  ],
};

var CELL_VALIDATORS = {
  'teacher': {
    'teacher_id':     { check: function(v) { return isValidTeacherId(v); },       msg: 'ต้องเป็น T### หรือ E### (อย่างน้อย 3 หลัก) เช่น T001' },
    'ชื่อ':           { check: function(v) { return v.length > 0; },              msg: 'ต้องระบุชื่อครู' },
    'กลุ่มสาระ':      { check: function(v) { return v.length > 0; },              msg: 'ต้องระบุกลุ่มสาระ' },
    'homeroom_class': { check: function(v) { return !v || (isValidClassId(v) && v.indexOf(',') === -1); }, msg: 'ต้องเป็นรูปแบบ G/S ค่าเดียว เช่น 1/1' },
  },
  'student': {
    'class_id': { check: function(v) { return isValidClassId(v); }, msg: 'ต้องเป็นรูปแบบ G/S เช่น 1/1' },
  },
  'period': {
    'คาบ':  { check: function(v) { return v.length > 0; },         msg: 'ต้องระบุชื่อคาบ' },
    'เวลา': { check: function(v) { return isValidTimeFormat(v); }, msg: 'ต้องเป็น HH.MM-HH.MM หรือตัวเลข (นาที) เช่น 08.30-09.20' },
  },
  'preplace': {
    'ชื่อ':     { check: function(v) { return v.length > 0 && v.indexOf(',') === -1; }, msg: 'ต้องระบุชื่อ slot และห้ามมีจุลภาค' },
    'คาบ':      { check: function(v) { return getInvalidPreplaceSlotTokens(v).length === 0; }, msg: 'รูปแบบ slot ไม่ถูกต้อง — ใช้ DAILY_1, MON_1 หรือ MON_1-3' },
    'นักเรียน': { check: function(v) { return splitAndSanitize(v).every(function(t) { return isValidStudentsToken(t); }); }, msg: 'ใช้ ALL, student_grade:N หรือ class_id เช่น 1/1' },
    'ครู':      { check: function(v) { return splitAndSanitize(v).every(function(t) { return isValidTeachersToken(t); }); }, msg: 'ใช้ ALL, department:X, homeroom_grade:N, homeroom_teacher หรือ teacher_id' },
  },
  'curriculum': {
    'คาบ/สัปดาห์':    { check: function(v) { return /^\d+$/.test(v) && parseInt(v, 10) > 0; }, msg: 'ต้องเป็นจำนวนเต็มบวก เช่น 3' },
    'การแบ่งคาบสอน':  { check: function(v) { return !v || parseBlockPattern(v) !== null; }, msg: 'ต้องเป็นตัวเลขคั่นด้วย "-" เช่น 1-1-1' },
    'เงื่อนไขพิเศษ':  { check: function(v) {
      if (!v) return true;
      var ct = parseConstraintType(v);
      if (ct && !ct.valid) return false;
      return true;
    }, msg: 'type= ต้องเป็น TEAM, MULTI_CLASS_TEAM, SUB_GROUP, TEACHER_SPLIT, หรือ SEPARATE_SLOT' },
  },
  'room': {
    'room_id':  { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุรหัสห้อง' },
    'ประเภท':   { check: function(v) {
      if (!v) return true;
      var tags = v.split(',').map(function(t) { return t.trim().toLowerCase(); });
      return !(tags.indexOf('homeroom') !== -1 && tags.indexOf('exclude') !== -1);
    }, msg: 'แท็ก "homeroom" และ "exclude" ไม่สามารถใช้ร่วมกันได้' },
  },
  'elective': {
    'รหัสวิชา':        { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุรหัสวิชา' },
    'ชื่อวิชา (เสรี)': { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุชื่อวิชา' },
    'ครูผู้สอน':       { check: function(v) { return v.length > 0 && v.indexOf(',') === -1 && v.indexOf('|') === -1; }, msg: 'ต้องระบุครูคนเดียว ไม่มีจุลภาค/"|"' },
    'ห้องเรียน':       { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุห้องเรียน' },
    'คาบ':             { check: function(v) { return v.length > 0; }, msg: 'ต้องระบุคาบเสรี' },
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
    .addItem('Validate All Tabs',      'runValidation')
    .addItem('Generate Skeleton',      'generateSkeleton')
    .addSeparator()
    .addItem('Open Slot Picker',       'showSlotPicker')
    .addItem('Pick Preplace Names',    'showPreplaceNamePicker')
    .addSeparator()
    .addItem('Debug: Show Tab Names',  'debugTabNames')
    .addToUi();

  createTriggerIfNeeded_();
}

function createTriggerIfNeeded_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getUserTriggers(ss);
  var hasOpen = false, hasEdit = false, hasTimer = false;

  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getEventType() === ScriptApp.EventType.ON_OPEN) hasOpen  = true;
    if (t.getEventType() === ScriptApp.EventType.ON_EDIT) hasEdit  = true;
    if (t.getEventType() === ScriptApp.EventType.CLOCK)   hasTimer = true;
  }

  if (!hasOpen)  ScriptApp.newTrigger('onOpen').forSpreadsheet(ss).onOpen().create();
  if (!hasEdit)  ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  if (!hasTimer) ScriptApp.newTrigger('backgroundValidationTick').timeBased().everyMinutes(1).create();
}

// ─── onEdit ──────────────────────────────────────────────────────────────────

function onEdit(e) {
  // no-op — installable trigger handles it
}

function onEditInstallable(e) {
  try {
    _handleEdit(e);
    var props = PropertiesService.getScriptProperties();
    props.setProperties({ dirty: 'true', lastEdit: String(Date.now()) });
  } catch (err) {}
}

// Cross-sheet checks run in onEdit via 60s-cached lookup snapshot.
var _CROSS_SHEET_CHECKS_ = {
  'teacher': {
    'homeroom_class': function(v, lu) {
      if (!v) return null;
      return lu.classIds[v] ? null : 'homeroom_class: ไม่พบ class_id "' + v + '" ในแท็บ student';
    }
  },
  'student': {
    'homeroom_room': function(v, lu) {
      if (!v) return null;
      return lu.roomIds[v] ? null : 'homeroom_room: ไม่พบ room_id "' + v + '" ในแท็บ room';
    }
  },
  'curriculum': {
    'ห้องเรียน': function(v, lu) {
      if (!v) return null;
      var segs  = parsePipeSegments(v);
      var items = segs.length > 1 ? segs : splitAndSanitize(v);
      for (var i = 0; i < items.length; i++) {
        if (items[i].toLowerCase() === 'exclude') return 'ห้องเรียน: ไม่สามารถใช้แท็ก "exclude" ได้';
        if (!lu.roomIds[items[i]] && !lu.roomCapabilityTags[items[i]])
          return 'ห้องเรียน: ไม่พบ "' + items[i] + '"';
      }
      return null;
    },
    'ห้อง (นักเรียน) ที่สอน': function(v, lu) {
      if (!v) return null;
      var segs = parsePipeSegments(v);
      if (segs.length > 1) {
        for (var i = 0; i < segs.length; i++) {
          if (segs[i] && !lu.classIds[segs[i]])
            return 'ห้อง (นักเรียน) ที่สอน: ไม่พบ class_id "' + segs[i] + '"';
        }
      }
      return null;
    }
  },
  'elective': {
    'ครูผู้สอน': function(v, lu) {
      if (!v) return null;
      return lu.teacherNames.indexOf(v) !== -1 ? null : 'ครูผู้สอน: ไม่พบชื่อครู "' + v + '"';
    },
    'ห้องเรียน': function(v, lu) {
      if (!v) return null;
      return lu.roomIds[v] ? null : 'ห้องเรียน: "' + v + '" ต้องเป็น room_id จริง';
    },
    'คาบ': function(v, lu) {
      if (!v) return null;
      var tokens  = v.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      var missing = tokens.filter(function(t) { return !lu.preplaceNames[t]; });
      return missing.length > 0 ? 'คาบ: ไม่พบ preplace name "' + missing[0] + '"' : null;
    }
  },
  'preplace': {
    'นักเรียน': function(v, lu) {
      if (!v) return null;
      var tokens = splitAndSanitize(v);
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (/^student_grade:(\d+)$/.test(t)) {
          var gn = parseInt(t.split(':')[1], 10);
          if (!lu.gradeToSections['ม.' + gn]) return 'นักเรียน: ไม่พบนักเรียนชั้น ม.' + gn;
        } else if (isValidClassId(t)) {
          if (!lu.classIds[t]) return 'นักเรียน: ไม่พบ class_id "' + t + '"';
        }
      }
      return null;
    },
    'ครู': function(v, lu) {
      if (!v) return null;
      var tokens = splitAndSanitize(v);
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (/^department:(.+)$/.test(t)) {
          var dept = t.split(':').slice(1).join(':');
          if (!lu.departments[dept]) return 'ครู: ไม่พบ department "' + dept + '"';
        } else if (isValidTeacherId(t)) {
          if (!lu.teacherIds[t]) return 'ครู: ไม่พบ teacher_id "' + t + '"';
        }
      }
      return null;
    }
  }
};

function _handleEdit(e) {
  if (!e || !e.range) return;
  var range      = e.range;
  var sheet      = range.getSheet();
  var editedRow  = range.getRow();
  var editedCol  = range.getColumn();
  if (editedRow === 1) return;

  var sheetName = sheet.getName().trim();
  var tabName   = null;
  var canonicalNames = Object.keys(TAB_ALIASES);
  for (var i = 0; i < canonicalNames.length; i++) {
    var aliases = TAB_ALIASES[canonicalNames[i]];
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] === sheetName) { tabName = canonicalNames[i]; break; }
    }
    if (tabName) break;
  }
  if (!tabName) return;

  var headerName = sanitize(sheet.getRange(1, editedCol).getValue());
  if (!headerName) return;

  var rawValue   = e.value !== undefined ? e.value : range.getValue();
  var cleanValue = sanitize(String(rawValue));
  var cell       = sheet.getRange(editedRow, editedCol);

  if (!cleanValue) {
    cell.setBackground(null);
    cell.clearNote();
    return;
  }

  // Teacher name check (ครูผู้สอน columns) — uses cached lookup
  var isTeacherNameCol = (headerName === 'ครูผู้สอน');
  if (isTeacherNameCol) {
    var validNames = _getCachedTeacherNames();
    if (validNames.length > 0) {
      var items = splitAndSanitize(cleanValue);
      var missing = [], suggestion = '';
      for (var k = 0; k < items.length; k++) {
        if (validNames.indexOf(items[k]) === -1) {
          missing.push(items[k]);
          if (!suggestion) suggestion = fuzzyMatchTeacher(items[k], validNames);
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

  // Structural CELL_VALIDATORS check
  var tabValidators = CELL_VALIDATORS[tabName];
  if (tabValidators && tabValidators[headerName]) {
    var validator = tabValidators[headerName];
    if (validator.check(cleanValue)) {
      cell.setBackground(null);
      cell.clearNote();
    } else {
      cell.setBackground(COLOR_RED);
      cell.setNote('⚠ ' + validator.msg);
    }
    return;
  }

  // Cross-sheet checks via cached lookups
  var crossTabChecks = _CROSS_SHEET_CHECKS_[tabName];
  if (crossTabChecks && crossTabChecks[headerName]) {
    try {
      var lookups = _getCachedLookups();
      var errMsg  = crossTabChecks[headerName](cleanValue, lookups);
      if (errMsg) {
        cell.setBackground(COLOR_RED);
        cell.setNote('⚠ ' + errMsg);
        return;
      }
    } catch (_) {}
  }

  // Clear stale highlights if no error found
  var currentBg = cell.getBackground();
  if (currentBg === COLOR_RED || currentBg === COLOR_YELLOW) {
    cell.setBackground(null);
    cell.clearNote();
  }
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

function _getCachedTeacherNames() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('onEdit_teacherNames');
  if (cached) return JSON.parse(cached);

  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var teacherSheet = getSheetByAliases(ss, 'teacher');
  if (!teacherSheet) return [];

  var tData    = teacherSheet.getDataRange().getValues();
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

function _getCachedLookups() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('gas_lookups_v2');
  if (cached) return JSON.parse(cached);

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var allData = _readAllTabData_(ss);
  var lookups = buildGASLookups(allData);
  cache.put('gas_lookups_v2', JSON.stringify(lookups), 60);
  return lookups;
}

// ─── Shared Data Reader ───────────────────────────────────────────────────────

function _readAllTabData_(ss) {
  var allData  = {};
  var tabNames = Object.keys(TAB_VALIDATORS);
  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var sheet   = getSheetByAliases(ss, tabName);
    if (!sheet) continue;
    allData[tabName] = sheet.getDataRange().getValues().map(function(r) {
      return r.map(function(c) {
        if (c instanceof Date) return (c.getMonth() + 1) + '/' + c.getDate();
        return String(c);
      });
    });
  }
  return allData;
}

// ─── Skeleton Generation ──────────────────────────────────────────────────────

function generateSkeleton() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  for (var i = 0; i < TAB_DEFS.length; i++) {
    var def   = TAB_DEFS[i];
    var sheet = getSheetByAliases(ss, def.name);
    if (!sheet) sheet = ss.insertSheet(def.name);

    var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    var existing    = headerRange.getValues()[0];
    var isEmpty     = existing.every(function(c) { return !sanitize(c); });
    if (isEmpty) headerRange.setValues([def.headers]);

    sheet.getRange(1, 1, 1, def.headers.length)
      .setFontWeight('bold').setBackground('#E8EAF6')
      .setFontStyle('normal').setFontColor('#000000');
    sheet.setFrozenRows(1);

    var headers = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0]
      .map(function(h) { return sanitize(h); });
    applyDataValidations_(sheet, def.name, headers);
    applyConditionalFormatting_(sheet, def.name, headers);
    _addValidationHints_(sheet, def.name, headers);
    lockHeaderRow_(sheet);
  }

  // Reorder sheets left-to-right: curriculum → elective → preplace → period → teacher → student → room
  _reorderTabs_(ss);

  ui.alert('Skeleton Generated',
    'All tabs are ready.\n\n' +
    '• Dropdowns guide you in cells that accept specific values.\n' +
    '• Cells turn red instantly if you type in the wrong format.\n\n' +
    'The header row of each tab is locked so only the owner can edit headers.',
    ui.ButtonSet.OK);
}

function _reorderTabs_(ss) {
  var order = ['curriculum', 'elective', 'preplace', 'period', 'teacher', 'student', 'room'];
  for (var i = 0; i < order.length; i++) {
    var sheet = getSheetByAliases(ss, order[i]);
    if (!sheet) continue;
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(i + 1);
  }
}

function applyDataValidations_(sheet, tabName, headers) {
  var rules = TAB_VALIDATIONS[tabName];
  if (!rules || rules.length === 0) return;
  var lastRow = 1000;
  for (var i = 0; i < rules.length; i++) {
    var rule   = rules[i];
    var colIdx = headers.indexOf(sanitize(rule.column));
    if (colIdx === -1) continue;
    var colRange   = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
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
    var ruleDef   = rules[i];
    var colIdx    = headers.indexOf(sanitize(ruleDef.column));
    if (colIdx === -1) continue;
    var colLetter = columnIndexToLetter_(colIdx + 1);
    var formula   = ruleDef.formula.replace(/\{COL\}/g, colLetter);
    var colRange  = sheet.getRange(2, colIdx + 1, lastRow - 1, 1);
    var cfRule    = SpreadsheetApp.newConditionalFormatRule()
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
    var prot  = protections[p];
    var range = prot.getRange();
    if (range.getRow() === 1 && range.getNumRows() === 1) prot.remove();
  }
  var headerRow  = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
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
    var wr   = warnings[w];
    var wKey = wr.row + ':' + wr.col;
    if (!cellMap[wKey]) cellMap[wKey] = { status: 'warning', message: wr.message };
  }
  for (var e = 0; e < errors.length; e++) {
    var er   = errors[e];
    var eKey = er.row + ':' + er.col;
    cellMap[eKey] = { status: 'error', message: er.message };
  }

  var rowHasIssue = {};
  for (var key in cellMap) {
    rowHasIssue[parseInt(key.split(':')[0], 10)] = true;
  }

  var sheetName = sheet.getName().trim();
  var tabDef    = null;
  for (var d = 0; d < TAB_DEFS.length; d++) {
    var aliases = TAB_ALIASES[TAB_DEFS[d].name] || [];
    for (var a = 0; a < aliases.length; a++) {
      if (aliases[a] === sheetName) { tabDef = TAB_DEFS[d]; break; }
    }
    if (tabDef) break;
  }

  for (var cellKey in cellMap) {
    var parts   = cellKey.split(':');
    var cellRow = parseInt(parts[0], 10);
    var cellCol = parseInt(parts[1], 10);
    var info    = cellMap[cellKey];
    if (cellCol < 1 || cellCol > lastCol) continue;
    var color = (info.status === 'error') ? COLOR_RED : COLOR_YELLOW;
    sheet.getRange(cellRow, cellCol).setBackground(color).setNote('⚠ ' + info.message);
  }

  for (var dr = 2; dr <= dataRowCount + 1; dr++) {
    var rowData = rawData[dr - 1];
    if (!rowData) continue;
    if (_isEmptyRow(rowData)) continue;
    if (isMarkerRow(rowData)) continue;
    if (!rowHasIssue[dr]) sheet.getRange(dr, 1).setBackground(COLOR_GREEN);
  }
}

function _isEmptyRow(row) {
  return row.every(function(c) { return !sanitize(c); });
}

function _runValidationCore_(ss, silent) {
  // Always delete and recreate Validation Results for a clean slate
  var existing = ss.getSheetByName('Validation Results');
  if (existing) ss.deleteSheet(existing);
  var resultSheet = ss.insertSheet('Validation Results');

  resultSheet.getRange(1, 1, 1, 4).setValues([['Tab', 'Status', 'Issues', 'Last checked']]);
  resultSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground(COLOR_HEADER);
  resultSheet.setFrozenRows(1);

  var resultRow   = 2;
  var allValid    = true;
  var totalErrors = 0, totalWarnings = 0;
  var sheets      = {}, structuralResults = {};

  var allData  = _readAllTabData_(ss);
  var tabNames = Object.keys(TAB_VALIDATORS);

  for (var i = 0; i < tabNames.length; i++) {
    var tabName = tabNames[i];
    var sheet   = getSheetByAliases(ss, tabName);
    if (sheet) {
      sheets[tabName]            = sheet;
      structuralResults[tabName] = TAB_VALIDATORS[tabName](allData[tabName] || []);
    }
  }

  var lookups = buildGASLookups(allData);

  for (var i = 0; i < tabNames.length; i++) {
    var tabName    = tabNames[i];
    var sheet      = sheets[tabName];
    var data       = allData[tabName];
    var structural = structuralResults[tabName];

    if (!sheet) {
      resultSheet.getRange(resultRow, 1, 1, 3).setValues([[tabName, 'MISSING', 'Tab not found.']]);
      resultSheet.getRange(resultRow, 2).setBackground(COLOR_RED).setFontColor('#B71C1C');
      allValid = false;
      totalErrors++;
      resultRow++;
      continue;
    }

    var errors   = structural ? structural.errors   : [];
    var warnings = structural ? structural.warnings : [];

    if (REF_VALIDATORS[tabName] && data) {
      var refResult = REF_VALIDATORS[tabName](data, lookups);
      errors   = errors.concat(refResult.errors);
      warnings = warnings.concat(refResult.warnings);
    }

    if (data) applyHighlights(sheet, data.length - 1, errors, warnings, data);

    var errCount  = errors.length, warnCount = warnings.length;
    var issueText = '';
    if (errCount > 0)  issueText += 'ERRORS:\n'   + errors.map(function(e) { return '  Row ' + e.row + ': ' + e.message; }).join('\n');
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
    totalErrors += errCount;
    totalWarnings += warnCount;
    resultRow++;
  }

  resultSheet.autoResizeColumn(1);
  resultSheet.autoResizeColumn(2);
  resultSheet.setColumnWidth(3, 600);
  if (resultRow > 2) resultSheet.getRange(2, 3, resultRow - 2, 1).setWrap(true);

  return { allValid: allValid, totalErrors: totalErrors, totalWarnings: totalWarnings, resultSheet: resultSheet };
}

function runValidation() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var result = _runValidationCore_(ss, false);
  result.resultSheet.getRange(1, 4).setValue('Manual check: ' + new Date().toLocaleTimeString());
  ss.setActiveSheet(result.resultSheet);

  if (result.allValid && result.totalWarnings === 0) {
    ui.alert('Validation Passed', 'All tabs are valid.', ui.ButtonSet.OK);
  } else if (result.allValid) {
    ui.alert('Validation Passed with Warnings', result.totalWarnings + ' warning(s) found.', ui.ButtonSet.OK);
  } else {
    ui.alert('Validation Failed', result.totalErrors + ' error(s) found.', ui.ButtonSet.OK);
  }
}

function runValidationSilent() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var result = _runValidationCore_(ss, true);
  var summary = 'Last auto-check: ' + new Date().toLocaleTimeString() +
    ' — ' + result.totalErrors + ' error(s), ' + result.totalWarnings + ' warning(s)';
  result.resultSheet.getRange(1, 4).setValue(summary);
}

// ─── Background Validation (Tier 2 — time trigger) ───────────────────────────

function backgroundValidationTick() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('dirty') !== 'true') return;

  var lastEdit = parseInt(props.getProperty('lastEdit') || '0', 10);
  if (Date.now() - lastEdit < 30000) return; // still editing — wait

  props.setProperty('dirty', 'false');
  try {
    runValidationSilent();
  } catch (err) {
    // swallow so the trigger is not deleted
  }
}

// ─── Slot Picker Sidebar ──────────────────────────────────────────────────────

function showSlotPicker() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var periodSheet = getSheetByAliases(ss, 'period');
  var periods     = [];

  if (periodSheet) {
    var pData     = periodSheet.getDataRange().getValues();
    var pHeaders  = pData[0].map(function(h) { return sanitize(h); });
    var pLabelIdx = pHeaders.indexOf('คาบ');
    var pTimeIdx  = pHeaders.indexOf('เวลา');
    for (var r = 1; r < pData.length; r++) {
      var label = pLabelIdx !== -1 ? sanitize(String(pData[r][pLabelIdx])) : '';
      var time  = pTimeIdx  !== -1 ? sanitize(String(pData[r][pTimeIdx]))  : '';
      if (!label && !time) continue;
      if (!time || !/^\d{2}\.\d{2}-\d{2}\.\d{2}$/.test(time)) continue; // skip breaks
      periods.push({ label: label, time: time });
    }
  }

  var days    = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'DAILY'];
  var dayThai = { MON: 'จ', TUE: 'อ', WED: 'พ', THU: 'พฤ', FRI: 'ศ', DAILY: 'ทุกวัน' };

  var rows = '';
  for (var p = 0; p < periods.length; p++) {
    var period = periods[p];
    rows += '<tr><td class="label">' + period.label + '<br><small>' + period.time + '</small></td>';
    for (var d = 0; d < days.length; d++) {
      var val = days[d] + '_' + period.label;
      rows += '<td><input type="checkbox" class="slot-cb" value="' + val + '"></td>';
    }
    rows += '</tr>';
  }

  var html = '<!DOCTYPE html><html><head><style>' +
    'body{font-family:sans-serif;font-size:12px;margin:8px}' +
    'table{border-collapse:collapse;width:100%}' +
    'th,td{border:1px solid #ccc;padding:4px;text-align:center}' +
    'th{background:#E8EAF6;font-weight:bold}' +
    'td.label{text-align:left;background:#f9f9f9;white-space:nowrap}' +
    '.slot-cb{cursor:pointer;width:16px;height:16px}' +
    '#output{width:100%;margin-top:8px;padding:4px;font-size:11px;font-family:monospace}' +
    '#insert{margin-top:6px;padding:6px 12px;background:#3F51B5;color:#fff;border:none;cursor:pointer;border-radius:4px}' +
    '#insert:hover{background:#303F9F}' +
    '#status{color:green;margin-top:4px;font-size:11px}' +
    '</style></head><body>' +
    '<p style="margin:0 0 6px;color:#555">เลือกคาบที่ต้องการ แล้วกด "แทรกลงเซลล์"</p>' +
    (periods.length === 0 ? '<p style="color:red">ไม่พบแท็บ period หรือไม่มีคาบเรียนที่กำหนด</p>' : '') +
    '<table><thead><tr><th>คาบ</th>' +
    days.map(function(d) { return '<th>' + dayThai[d] + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<input id="output" type="text" readonly placeholder="ผลลัพธ์จะปรากฏที่นี่">' +
    '<br><button id="insert" onclick="insert()">แทรกลงเซลล์</button>' +
    '<div id="status"></div>' +
    '<script>' +
    'var cbs=document.querySelectorAll(".slot-cb");' +
    'for(var i=0;i<cbs.length;i++){cbs[i].addEventListener("change",updateOutput);}' +
    'function updateOutput(){' +
    '  var sel=[];var checked=document.querySelectorAll(".slot-cb:checked");' +
    '  for(var i=0;i<checked.length;i++){sel.push(checked[i].value);}' +
    '  document.getElementById("output").value=sel.join(",");' +
    '}' +
    'function insert(){' +
    '  var val=document.getElementById("output").value;' +
    '  if(!val){document.getElementById("status").textContent="ยังไม่ได้เลือกคาบ";return;}' +
    '  google.script.run.withSuccessHandler(function(){' +
    '    document.getElementById("status").textContent="แทรกเรียบร้อยแล้ว";' +
    '  }).insertSlotIntoActiveCell(val);' +
    '}' +
    '</script></body></html>';

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('Slot Picker'));
}

function showPreplaceNamePicker() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var preplaceSheet = getSheetByAliases(ss, 'preplace');
  var names         = [];

  if (preplaceSheet) {
    var pData    = preplaceSheet.getDataRange().getValues();
    var pHeaders = pData[0].map(function(h) { return sanitize(h); });
    var nIdx     = pHeaders.indexOf('ชื่อ');
    if (nIdx !== -1) {
      for (var r = 1; r < pData.length; r++) {
        var n = sanitize(String(pData[r][nIdx]));
        if (n && n.indexOf(',') === -1) names.push(n);
      }
    }
  }

  var checkboxes = '';
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    var escapedName = n.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    checkboxes += '<label style="display:block;padding:3px 0;cursor:pointer">' +
      '<input type="checkbox" class="name-cb" value="' + escapedName + '"> ' + escapedName + '</label>';
  }

  var html = '<!DOCTYPE html><html><head><style>' +
    'body{font-family:sans-serif;font-size:12px;margin:8px}' +
    '#output{width:100%;margin-top:8px;padding:4px;font-size:11px;font-family:monospace}' +
    '#insert{margin-top:6px;padding:6px 12px;background:#3F51B5;color:#fff;border:none;cursor:pointer;border-radius:4px}' +
    '#insert:hover{background:#303F9F}' +
    '#status{color:green;margin-top:4px;font-size:11px}' +
    '</style></head><body>' +
    '<p style="margin:0 0 6px;color:#555">เลือก preplace name สำหรับคอลัมน์คาบ</p>' +
    (names.length === 0 ? '<p style="color:red">ไม่พบชื่อใน preplace sheet</p>' : '') +
    '<div style="max-height:300px;overflow-y:auto;border:1px solid #ddd;padding:6px">' +
    checkboxes + '</div>' +
    '<input id="output" type="text" readonly placeholder="ผลลัพธ์จะปรากฏที่นี่">' +
    '<br><button id="insert" onclick="insert()">แทรกลงเซลล์</button>' +
    '<div id="status"></div>' +
    '<script>' +
    'var cbs=document.querySelectorAll(".name-cb");' +
    'for(var i=0;i<cbs.length;i++){cbs[i].addEventListener("change",updateOutput);}' +
    'function updateOutput(){' +
    '  var sel=[];var checked=document.querySelectorAll(".name-cb:checked");' +
    '  for(var i=0;i<checked.length;i++){sel.push(checked[i].value);}' +
    '  document.getElementById("output").value=sel.join(",");' +
    '}' +
    'function insert(){' +
    '  var val=document.getElementById("output").value;' +
    '  if(!val){document.getElementById("status").textContent="ยังไม่ได้เลือก";return;}' +
    '  google.script.run.withSuccessHandler(function(){' +
    '    document.getElementById("status").textContent="แทรกเรียบร้อยแล้ว";' +
    '  }).insertSlotIntoActiveCell(val);' +
    '}' +
    '</script></body></html>';

  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(html).setTitle('Preplace Name Picker'));
}

function insertSlotIntoActiveCell(text) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell  = sheet.getActiveCell();
  if (cell) cell.setValue(text);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function debugTabNames() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var lines  = sheets.map(function(s) {
    var name  = s.getName();
    var codes = [];
    for (var i = 0; i < name.length; i++) {
      codes.push('U+' + name.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'));
    }
    return '"' + name + '"  [' + codes.join(' ') + ']';
  });
  SpreadsheetApp.getUi().alert('Tab names:\n\n' + lines.join('\n'));
}
