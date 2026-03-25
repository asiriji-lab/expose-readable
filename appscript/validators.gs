// ─── validators.gs ───────────────────────────────────────────────────────────
// Ported from: app/(admin)/validators/structural/*.ts
// Column names match the actual example CSVs in public/example_csv/
// Each function takes a 2D array and returns { valid: boolean, errors: string[] }
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _str(val) {
  return (val == null ? '' : String(val)).trim();
}

function _isEmptyRow(row) {
  return row.every(function(c) { return !_str(c); });
}

function _checkRequiredHeaders(headers, required) {
  var errors = [];
  for (var i = 0; i < required.length; i++) {
    if (headers.indexOf(required[i]) === -1) {
      errors.push('Missing required column: "' + required[i] + '"');
    }
  }
  return errors;
}

// ─── 1. Period (PR) ──────────────────────────────────────────────────────────
// Headers: period_label, period_time

function validatePeriod(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "period" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['period_label', 'period_time']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var periodIdx = headers.indexOf('period_label');
  var timeIdx   = headers.indexOf('period_time');

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var period = _str(row[periodIdx]);
    var time   = _str(row[timeIdx]);
    if (!period && !time) continue;
    if (!period) errors.push('Row ' + (r+1) + ', period_label: Period label is required.');
    if (time && !isValidTimeFormat(time))
      errors.push('Row ' + (r+1) + ', period_time: Expected HH.MM-HH.MM or a number — got "' + time + '"');
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 2. Room (RM) ────────────────────────────────────────────────────────────
// Headers: room_id, note, tag

function validateRoom(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "room" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['room_id', 'note', 'tag']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var roomIdx = headers.indexOf('room_id');
  var seen = {};

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var roomId = _str(row[roomIdx]);
    if (!roomId && _isEmptyRow(row)) continue;
    if (!roomId) { errors.push('Row ' + (r+1) + ', room_id: Room ID is required.'); continue; }
    if (seen[roomId]) {
      errors.push('Row ' + (r+1) + ', room_id: Duplicate room ID "' + roomId + '" (also row ' + seen[roomId] + ').');
    } else {
      seen[roomId] = r + 1;
    }
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 3. Teacher (TC) ─────────────────────────────────────────────────────────
// Headers: teacher_id, teacher_name, available_slots, unavailable_slots, constraint

function validateTeacher(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "teacher" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['teacher_id', 'teacher_name']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var idIdx      = headers.indexOf('teacher_id');
  var nameIdx    = headers.indexOf('teacher_name');
  var availIdx   = headers.indexOf('available_slots');
  var unavailIdx = headers.indexOf('unavailable_slots');
  var seen = {};

  for (var r = 1; r < data.length; r++) {
    var row    = data[r];
    var rowNum = r + 1;
    var idVal  = _str(row[idIdx]);
    var nameVal= _str(row[nameIdx]);

    if (_isEmptyRow(row)) continue;
    if (isSkipRow(idVal)) continue;

    // TC-3: ID format
    if (!isValidTeacherId(idVal))
      errors.push('Row ' + rowNum + ', teacher_id: Must be T### or E### — got "' + idVal + '"');

    // TC-4: name required
    if (!nameVal)
      errors.push('Row ' + rowNum + ', teacher_name: Teacher name is required.');

    // TC-5: duplicate
    if (seen[idVal]) {
      errors.push('Row ' + rowNum + ', teacher_id: Duplicate ID "' + idVal + '" (also row ' + seen[idVal] + ').');
    } else if (idVal) {
      seen[idVal] = rowNum;
    }

    // TC-6: slot tokens
    var slotCols = [[availIdx, 'available_slots'], [unavailIdx, 'unavailable_slots']];
    for (var s = 0; s < slotCols.length; s++) {
      var colIdx  = slotCols[s][0];
      var colName = slotCols[s][1];
      if (colIdx === -1) continue;
      var slotVal = _str(row[colIdx]);
      if (!slotVal) continue;
      var invalid = getInvalidSlotTokens(slotVal);
      for (var t = 0; t < invalid.length; t++) {
        errors.push('Row ' + rowNum + ', ' + colName + ': Invalid slot token "' + invalid[t] + '".');
      }
    }
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 4. Student (ST) ─────────────────────────────────────────────────────────
// Headers: class_id, grade, section, default_room, curriculum

function validateStudent(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "student" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['class_id', 'grade', 'section']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var classIdx   = headers.indexOf('class_id');
  var gradeIdx   = headers.indexOf('grade');
  var sectionIdx = headers.indexOf('section');

  for (var r = 1; r < data.length; r++) {
    var row     = data[r];
    var rowNum  = r + 1;
    var classId = _str(row[classIdx]);
    var grade   = _str(row[gradeIdx]);
    var section = _str(row[sectionIdx]);

    if (_isEmptyRow(row)) continue;

    if (classId && !isValidClassId(classId))
      errors.push('Row ' + rowNum + ', class_id: Must be G/S format (e.g. 1/1) — got "' + classId + '"');
    if (grade && !/^ม\.[1-6]$/.test(grade))
      errors.push('Row ' + rowNum + ', grade: Must be ม.1–ม.6 — got "' + grade + '"');
    if (section && (!/^\d+$/.test(section) || parseInt(section) <= 0))
      errors.push('Row ' + rowNum + ', section: Must be a positive integer — got "' + section + '"');
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 5. Preplace (PP) ────────────────────────────────────────────────────────
// Headers: slot_name, periods, apply_to

function validatePreplace(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "preplace" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['slot_name', 'periods', 'apply_to']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var nameIdx  = headers.indexOf('slot_name');
  var slotIdx  = headers.indexOf('periods');
  var applyIdx = headers.indexOf('apply_to');

  for (var r = 1; r < data.length; r++) {
    var row     = data[r];
    var rowNum  = r + 1;
    if (_isEmptyRow(row)) continue;

    var slotName = _str(row[nameIdx]);
    var period   = _str(row[slotIdx]);
    var applyTo  = _str(row[applyIdx]);

    if (!slotName) errors.push('Row ' + rowNum + ', slot_name: Slot name is required.');
    if (period) {
      var invalid = getInvalidPreplaceSlotTokens(period);
      for (var t = 0; t < invalid.length; t++) {
        errors.push('Row ' + rowNum + ', periods: Invalid slot token "' + invalid[t] + '".');
      }
    }
    if (applyTo && !isValidApplyTo(applyTo))
      errors.push('Row ' + rowNum + ', apply_to: Must be "All", "ม.X", or comma-list — got "' + applyTo + '"');
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 6. Scout (SC) ───────────────────────────────────────────────────────────
// Headers: ลูกเสือม.1, ลูกเสือม.2, ลูกเสือม.3 (flexible group names)
// No structural validation — referential checks only.

function validateScout(data) {
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "scout" is empty.'] };
  return { valid: true, errors: [] };
}

// ─── 7. Elective (EL) ───────────────────────────────────────────────────────
// Headers: subject_id, subject_name, teacher, room, [slot columns...]

function validateElective(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "elective" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['subject_id', 'subject_name', 'teacher', 'room']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  return { valid: true, errors: [] };
}

// ─── 8. Curriculum (CU) ─────────────────────────────────────────────────────
// Headers: subject_id, subject_name, periods_per_week, teacher, block_pattern,
//          student_class, constraint, room, fixed_period

function validateCurriculum(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "curriculum" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['subject_id', 'teacher', 'periods_per_week']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var subjectIdx = headers.indexOf('subject_id');
  var periodsIdx = headers.indexOf('periods_per_week');

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (_isEmptyRow(row)) continue;
    var firstCell = _str(row[0]);
    if (isGradeHeader(firstCell)) continue;
    var subject = _str(row[subjectIdx]);
    var periods = _str(row[periodsIdx]);
    if (!subject) continue;
    if (periods && (!/^\d+(\.\d+)?$/.test(periods) || parseFloat(periods) <= 0))
      errors.push('Row ' + (r+1) + ', periods_per_week: Must be a positive number — got "' + periods + '"');
  }
  return { valid: errors.length === 0, errors: errors };
}

// ─── 9. Constraints (CN) ────────────────────────────────────────────────────
// Headers: slot_name, periods, apply_to
// Same validation logic as preplace.

function validateConstraints(data) {
  var errors = [];
  if (!data || data.length === 0) return { valid: false, errors: ['Tab "constraints" is empty.'] };

  var headers = data[0].map(function(h) { return _str(h); });
  var headerErrors = _checkRequiredHeaders(headers, ['slot_name', 'periods', 'apply_to']);
  if (headerErrors.length) return { valid: false, errors: headerErrors };

  var nameIdx  = headers.indexOf('slot_name');
  var slotIdx  = headers.indexOf('periods');
  var applyIdx = headers.indexOf('apply_to');

  for (var r = 1; r < data.length; r++) {
    var row    = data[r];
    var rowNum = r + 1;
    if (_isEmptyRow(row)) continue;

    var slotName = _str(row[nameIdx]);
    var period   = _str(row[slotIdx]);
    var applyTo  = _str(row[applyIdx]);

    if (!slotName) errors.push('Row ' + rowNum + ', slot_name: Slot name is required.');
    if (period) {
      var invalid = getInvalidPreplaceSlotTokens(period);
      for (var t = 0; t < invalid.length; t++) {
        errors.push('Row ' + rowNum + ', periods: Invalid slot token "' + invalid[t] + '".');
      }
    }
    if (applyTo && !isValidApplyTo(applyTo))
      errors.push('Row ' + rowNum + ', apply_to: Must be "All", "ม.X", or comma-list — got "' + applyTo + '"');
  }
  return { valid: errors.length === 0, errors: errors };
}
