// ─── validators.gs ───────────────────────────────────────────────────────────
// Each function takes a 2D string array and returns:
//   { valid: boolean,
//     errors:   [{ row: number, col: number, message: string }],
//     warnings: [{ row: number, col: number, message: string }] }
// row/col are 1-based sheet coordinates (row 1 = header row).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _str(val) {
  var s = (val == null ? '' : String(val)).trim();
  // Strip invisible/zero-width characters that Google Sheets sometimes inserts
  // (BOM U+FEFF, zero-width space U+200B, non-breaking space U+00A0, etc.)
  s = s.replace(/[\u0000-\u001F\u00A0\u200B\u200C\u200D\u2060\uFEFF]/g, '');
  return s.trim();
}

function _isEmptyRow(row) {
  return row.every(function(c) { return !_str(c); });
}

/** Returns structured errors for any required headers that are missing. */
function _checkRequiredHeaders(headers, required) {
  var errors = [];
  // Normalize required column names the same way as the parsed headers
  var normRequired = required.map(function(r) {
    return r.normalize ? r.normalize('NFC') : r;
  });
  for (var i = 0; i < normRequired.length; i++) {
    if (headers.indexOf(normRequired[i]) === -1) {
      errors.push({ row: 1, col: 1, message: 'Missing required column: "' + required[i] + '"' });
    }
  }
  return errors;
}

function _err(row, col, message)  { return { row: row, col: col, message: message }; }
function _warn(row, col, message) { return { row: row, col: col, message: message }; }

// ─── 1. Period ───────────────────────────────────────────────────────────────

function validatePeriod(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "period" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['คาบ', 'เวลา']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var periodIdx = headers.indexOf('คาบ');
  var timeIdx   = headers.indexOf('เวลา');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var period   = _str(row[periodIdx]);
    var time     = _str(row[timeIdx]);
    if (!period && !time) continue;
    if (!period)
      errors.push(_err(sheetRow, periodIdx + 1, 'คาบ: ต้องระบุชื่อคาบ'));
    if (time && !isValidTimeFormat(time))
      errors.push(_err(sheetRow, timeIdx + 1, 'เวลา: ต้องเป็น HH.MM-HH.MM หรือตัวเลข (นาที) — ได้รับ "' + time + '"'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 2. Room ─────────────────────────────────────────────────────────────────

function validateRoom(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "room" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['ห้องทั้งหมด']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var roomIdx = headers.indexOf('ห้องทั้งหมด');
  var noteIdx = headers.indexOf('หมายเหตุ');
  var seen = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var roomId   = _str(row[roomIdx]);
    if (!roomId && _isEmptyRow(row)) continue;
    if (!roomId) {
      errors.push(_err(sheetRow, roomIdx + 1, 'ห้องทั้งหมด: ต้องระบุรหัสห้อง'));
      continue;
    }
    if (seen[roomId]) {
      errors.push(_err(sheetRow, roomIdx + 1, 'ห้องทั้งหมด: รหัสห้องซ้ำ "' + roomId + '" (แถว ' + seen[roomId] + ')'));
    } else {
      seen[roomId] = sheetRow;
    }
    if (noteIdx !== -1 && !_str(row[noteIdx]))
      warnings.push(_warn(sheetRow, noteIdx + 1, 'หมายเหตุ: ไม่ได้ระบุหมายเหตุ'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 3. Teacher ──────────────────────────────────────────────────────────────

function validateTeacher(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "teacher" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['teacher_id', 'ชื่อ']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var idIdx      = headers.indexOf('teacher_id');
  var nameIdx    = headers.indexOf('ชื่อ');
  var availIdx   = headers.indexOf('available_slots');
  var unavailIdx = headers.indexOf('unavailable_slots');
  var seen = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var idVal    = _str(row[idIdx]);
    var nameVal  = _str(row[nameIdx]);

    if (_isEmptyRow(row)) continue;
    if (isSkipRow(idVal)) continue;

    if (!isValidTeacherId(idVal))
      errors.push(_err(sheetRow, idIdx + 1, 'teacher_id: ต้องเป็น T### หรือ E### — ได้รับ "' + idVal + '"'));
    if (!nameVal)
      errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ต้องระบุชื่อครู'));
    if (seen[idVal]) {
      errors.push(_err(sheetRow, idIdx + 1, 'teacher_id: รหัสซ้ำ "' + idVal + '" (แถว ' + seen[idVal] + ')'));
    } else if (idVal) {
      seen[idVal] = sheetRow;
    }

    var slotCols = [[availIdx, 'available_slots'], [unavailIdx, 'unavailable_slots']];
    for (var s = 0; s < slotCols.length; s++) {
      var colIdx  = slotCols[s][0];
      var colName = slotCols[s][1];
      if (colIdx === -1) continue;
      var slotVal = _str(row[colIdx]);
      if (!slotVal) {
        warnings.push(_warn(sheetRow, colIdx + 1, colName + ': ไม่ได้ระบุคาบว่าง'));
        continue;
      }
      var invalid = getInvalidSlotTokens(slotVal);
      for (var t = 0; t < invalid.length; t++) {
        errors.push(_err(sheetRow, colIdx + 1, colName + ': รูปแบบ slot ไม่ถูกต้อง "' + invalid[t] + '"'));
      }
    }
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 4. Student ──────────────────────────────────────────────────────────────

function validateStudent(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "student" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['นักเรียน', 'ชั้น', 'ห้อง']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var classIdx    = headers.indexOf('นักเรียน');
  var gradeIdx    = headers.indexOf('ชั้น');
  var sectionIdx  = headers.indexOf('ห้อง');
  var roomIdx     = headers.indexOf('ห้องประจำ');
  var currIdx     = headers.indexOf('หลักสูตร');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var classId  = _str(row[classIdx]);
    var grade    = _str(row[gradeIdx]);
    var section  = _str(row[sectionIdx]);

    if (_isEmptyRow(row)) continue;

    if (classId && !isValidClassId(classId))
      errors.push(_err(sheetRow, classIdx + 1, 'นักเรียน: ต้องเป็นรูปแบบ G/S เช่น 1/1 — ได้รับ "' + classId + '"'));
    if (grade && !/^ม\.[1-6]$/.test(grade))
      errors.push(_err(sheetRow, gradeIdx + 1, 'ชั้น: ต้องเป็น ม.1–ม.6 — ได้รับ "' + grade + '"'));
    if (section && (!/^\d+$/.test(section) || parseInt(section) <= 0))
      errors.push(_err(sheetRow, sectionIdx + 1, 'ห้อง: ต้องเป็นจำนวนเต็มบวก — ได้รับ "' + section + '"'));

    if (roomIdx !== -1 && !_str(row[roomIdx]))
      warnings.push(_warn(sheetRow, roomIdx + 1, 'ห้องประจำ: ไม่ได้ระบุห้องประจำ'));
    if (currIdx !== -1 && !_str(row[currIdx]))
      warnings.push(_warn(sheetRow, currIdx + 1, 'หลักสูตร: ไม่ได้ระบุหลักสูตร'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 5. Preplace ─────────────────────────────────────────────────────────────

function validatePreplace(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "preplace" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['ชื่อ', 'คาบ', 'apply_to']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var nameIdx  = headers.indexOf('ชื่อ');
  var slotIdx  = headers.indexOf('คาบ');
  var applyIdx = headers.indexOf('apply_to');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;

    var slotName = _str(row[nameIdx]);
    var period   = _str(row[slotIdx]);
    var applyTo  = _str(row[applyIdx]);

    if (!slotName)
      errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ต้องระบุชื่อ slot'));
    if (period) {
      var invalid = getInvalidPreplaceSlotTokens(period);
      for (var t = 0; t < invalid.length; t++)
        errors.push(_err(sheetRow, slotIdx + 1, 'คาบ: รูปแบบ slot ไม่ถูกต้อง "' + invalid[t] + '"'));
    }
    if (applyTo && !isValidApplyTo(applyTo))
      errors.push(_err(sheetRow, applyIdx + 1, 'apply_to: ต้องเป็น "All", "ม.X" หรือรายการคั่นด้วยจุลภาค — ได้รับ "' + applyTo + '"'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 6. Scout ────────────────────────────────────────────────────────────────

function validateScout(data) {
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "scout" is empty.')], warnings: [] };
  return { valid: true, errors: [], warnings: [] };
}

// ─── 7. Elective ─────────────────────────────────────────────────────────────

function validateElective(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "elective" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var teacherIdx = headers.indexOf('ครูผู้สอน');
  var roomIdx    = headers.indexOf('ห้องเรียน');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (teacherIdx !== -1 && !_str(row[teacherIdx]))
      warnings.push(_warn(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ไม่ได้ระบุครูผู้สอน'));
    if (roomIdx !== -1 && !_str(row[roomIdx]))
      warnings.push(_warn(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่ได้ระบุห้องเรียน'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 8. Curriculum ───────────────────────────────────────────────────────────

function validateCurriculum(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "curriculum" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return _str(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['รหัสวิชา', 'ครู', 'คาบ/สัปดาห์']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var subjectIdx = headers.indexOf('รหัสวิชา');
  var periodsIdx = headers.indexOf('คาบ/สัปดาห์');
  var roomIdx    = headers.indexOf('ห้องเรียน');
  var blockIdx   = headers.indexOf('การแบ่งคาบสอน');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    var firstCell = _str(row[0]);
    if (isGradeHeader(firstCell)) continue;
    var subject = _str(row[subjectIdx]);
    var periods = _str(row[periodsIdx]);
    if (!subject) continue;
    if (periods && (!/^\d+(\.\d+)?$/.test(periods) || parseFloat(periods) <= 0))
      errors.push(_err(sheetRow, periodsIdx + 1, 'คาบ/สัปดาห์: ต้องเป็นจำนวนบวก — ได้รับ "' + periods + '"'));
    if (roomIdx !== -1 && !_str(row[roomIdx]))
      warnings.push(_warn(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่ได้ระบุห้องเรียน'));
    if (blockIdx !== -1 && !_str(row[blockIdx]))
      warnings.push(_warn(sheetRow, blockIdx + 1, 'การแบ่งคาบสอน: ไม่ได้ระบุการแบ่งคาบ'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 9. Constraints ──────────────────────────────────────────────────────────
// This is a reference/documentation tab — no data validation required.

function validateConstraints(data) {
  return { valid: true, errors: [], warnings: [] };
}
