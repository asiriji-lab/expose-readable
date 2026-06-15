// ─── validators.gs ───────────────────────────────────────────────────────────
// Each function takes a 2D string array and returns:
//   { valid: boolean,
//     errors:   [{ row: number, col: number, message: string, suggestion: string }],
//     warnings: [{ row: number, col: number, message: string }] }
// row/col are 1-based sheet coordinates (row 1 = header row).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _isEmptyRow(row) {
  return row.every(function(c) { return !sanitize(c); });
}

function _checkRequiredHeaders(headers, required) {
  var errors = [];
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

function _err(row, col, message, suggestion) {
  return { row: row, col: col, message: message, suggestion: suggestion || '' };
}
function _warn(row, col, message) {
  return { row: row, col: col, message: message };
}

// ─── 1. Period ───────────────────────────────────────────────────────────────

function validatePeriod(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "period" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['คาบ', 'เวลา']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var periodIdx = headers.indexOf('คาบ');
  var timeIdx   = headers.indexOf('เวลา');

  var schedulableCount = 0;
  var seenLabels = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var period   = sanitize(row[periodIdx]);
    var time     = sanitize(row[timeIdx]);
    if (!period && !time) continue;
    if (isMarkerRow(row)) continue;

    if (!period) {
      errors.push(_err(sheetRow, periodIdx + 1, 'คาบ: ต้องระบุชื่อคาบ'));
    } else {
      if (seenLabels[period]) {
        errors.push(_err(sheetRow, periodIdx + 1, 'คาบ: ชื่อซ้ำ "' + period + '" (แถว ' + seenLabels[period] + ')'));
      } else {
        seenLabels[period] = sheetRow;
      }
    }

    if (time && !isValidTimeFormat(time)) {
      errors.push(_err(sheetRow, timeIdx + 1, 'เวลา: ต้องเป็น HH.MM-HH.MM หรือตัวเลข (นาที) — ได้รับ "' + time + '"'));
    } else if (time && /^\d{2}\.\d{2}-\d{2}\.\d{2}$/.test(time)) {
      schedulableCount++;
    }
  }

  if (schedulableCount === 0 && errors.length === 0) {
    warnings.push(_warn(1, 1, 'period: ไม่พบคาบเรียนจริง (ทุกแถวเป็นพักหรือว่างเปล่า)'));
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 2. Room ─────────────────────────────────────────────────────────────────

function validateRoom(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "room" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['room_id']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var roomIdx = headers.indexOf('room_id');
  var tagsIdx = headers.indexOf('tags');
  if (tagsIdx === -1) tagsIdx = headers.indexOf('ประเภท'); // backward compat
  var seenIds = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var roomId   = sanitize(row[roomIdx]);
    if (!roomId && _isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    if (!roomId) {
      errors.push(_err(sheetRow, roomIdx + 1, 'room_id: ต้องระบุ room_id'));
      continue;
    }
    if (seenIds[roomId]) {
      errors.push(_err(sheetRow, roomIdx + 1, 'room_id: รหัสซ้ำ "' + roomId + '" (แถว ' + seenIds[roomId] + ')'));
    } else {
      seenIds[roomId] = sheetRow;
    }

    if (tagsIdx === -1) continue;
    var tagsVal = sanitize(row[tagsIdx]);
    if (!tagsVal) continue;

    var tagList = tagsVal.split(',').map(function(t) { return sanitize(t); }).filter(Boolean);
    var seenTags = {}, hasHomeroom = false, hasExclude = false;

    for (var t = 0; t < tagList.length; t++) {
      var tag = tagList[t];
      if (seenTags[tag]) {
        warnings.push(_warn(sheetRow, tagsIdx + 1, 'tags: แท็กซ้ำ "' + tag + '"'));
      }
      seenTags[tag] = true;
      if (tag === 'homeroom') hasHomeroom = true;
      if (tag === 'exclude')  hasExclude  = true;
    }

    if (hasHomeroom && hasExclude) {
      errors.push(_err(sheetRow, tagsIdx + 1, 'tags: แท็ก "homeroom" และ "exclude" ไม่สามารถใช้ร่วมกันได้'));
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 3. Teacher ──────────────────────────────────────────────────────────────

function validateTeacher(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "teacher" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['teacher_id', 'ชื่อ', 'กลุ่มสาระ']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var idIdx       = headers.indexOf('teacher_id');
  var nameIdx     = headers.indexOf('ชื่อ');
  var deptIdx     = headers.indexOf('กลุ่มสาระ');
  var availIdx    = headers.indexOf('available_slots');
  var hcIdx       = headers.indexOf('homeroom_class');

  var seenIds   = {};
  var seenNames = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var idVal    = sanitize(row[idIdx]);
    var nameVal  = sanitize(row[nameIdx]);

    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;
    if (isSkipRow(idVal)) continue;

    // teacher_id format
    if (!isValidTeacherId(idVal)) {
      errors.push(_err(sheetRow, idIdx + 1, 'teacher_id: ต้องเป็น T### หรือ E### — ได้รับ "' + idVal + '"'));
    }

    // teacher_id uniqueness
    if (idVal) {
      if (seenIds[idVal]) {
        errors.push(_err(sheetRow, idIdx + 1, 'teacher_id: รหัสซ้ำ "' + idVal + '" (แถว ' + seenIds[idVal] + ')'));
      } else {
        seenIds[idVal] = sheetRow;
      }
    }

    // name required
    if (!nameVal) {
      errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ต้องระบุชื่อครู'));
    } else {
      // name uniqueness
      if (seenNames[nameVal]) {
        errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ชื่อซ้ำ "' + nameVal + '" (แถว ' + seenNames[nameVal] + ')'));
      } else {
        seenNames[nameVal] = sheetRow;
      }
    }

    // department required
    var deptVal = deptIdx !== -1 ? sanitize(row[deptIdx]) : '';
    if (!deptVal) {
      errors.push(_err(sheetRow, deptIdx + 1, 'กลุ่มสาระ: ต้องระบุกลุ่มสาระ'));
    }

    var prefix = idVal ? idVal.charAt(0) : '';

    // available_slots: T-prefixed → warn if non-empty; E-prefixed → error if invalid format
    if (availIdx !== -1) {
      var availVal = sanitize(row[availIdx]);
      if (availVal) {
        if (prefix === 'T') {
          warnings.push(_warn(sheetRow, availIdx + 1, 'available_slots: ครูประจำ (T-prefix) ปกติไม่ต้องระบุ available_slots'));
        } else if (prefix === 'E') {
          var invalid = getInvalidSlotTokens(availVal);
          for (var t = 0; t < invalid.length; t++) {
            errors.push(_err(sheetRow, availIdx + 1, 'available_slots: รูปแบบ slot ไม่ถูกต้อง "' + invalid[t] + '"'));
          }
        }
      }
    }

    // homeroom_class: single value, digit/digit format; E-prefix → warn if non-empty
    if (hcIdx !== -1) {
      var hcVal = sanitize(row[hcIdx]);
      if (hcVal) {
        if (hcVal.indexOf(',') !== -1) {
          errors.push(_err(sheetRow, hcIdx + 1, 'homeroom_class: ต้องเป็นค่าเดียว ไม่มีจุลภาค — ได้รับ "' + hcVal + '"'));
        } else if (!isValidClassId(hcVal)) {
          errors.push(_err(sheetRow, hcIdx + 1, 'homeroom_class: ต้องเป็นรูปแบบ G/S เช่น 1/1 — ได้รับ "' + hcVal + '"'));
        } else if (prefix === 'E') {
          warnings.push(_warn(sheetRow, hcIdx + 1, 'homeroom_class: ครูภายนอก (E-prefix) ปกติไม่มีห้องประจำ'));
        }
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

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['class_id']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var classIdx  = headers.indexOf('class_id');
  var hrRoomIdx = headers.indexOf('homeroom_room');

  var seenClassIds = {};
  var seenHrRooms  = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    var classId = sanitize(row[classIdx]);
    if (!classId) {
      errors.push(_err(sheetRow, classIdx + 1, 'class_id: ต้องระบุรหัสห้อง'));
      continue;
    }
    if (!isValidClassId(classId)) {
      errors.push(_err(sheetRow, classIdx + 1, 'class_id: ต้องเป็นรูปแบบ G/S เช่น 1/1 — ได้รับ "' + classId + '"'));
    }
    if (seenClassIds[classId]) {
      errors.push(_err(sheetRow, classIdx + 1, 'class_id: รหัสซ้ำ "' + classId + '" (แถว ' + seenClassIds[classId] + ')'));
    } else {
      seenClassIds[classId] = sheetRow;
    }

    if (hrRoomIdx !== -1) {
      var hrRoom = sanitize(row[hrRoomIdx]);
      if (hrRoom) {
        if (seenHrRooms[hrRoom]) {
          errors.push(_err(sheetRow, hrRoomIdx + 1, 'homeroom_room: ห้อง "' + hrRoom + '" ถูกใช้แล้วโดยแถว ' + seenHrRooms[hrRoom]));
        } else {
          seenHrRooms[hrRoom] = sheetRow;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 5. Preplace ─────────────────────────────────────────────────────────────

function validatePreplace(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "preplace" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['ชื่อ', 'คาบ']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var nameIdx     = headers.indexOf('ชื่อ');
  var slotIdx     = headers.indexOf('คาบ');
  var studentsIdx = headers.indexOf('students');
  var teachersIdx = headers.indexOf('teachers');

  var seenNames = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    var slotName = sanitize(row[nameIdx]);
    var period   = sanitize(row[slotIdx]);

    // name: required, no commas, unique
    if (!slotName) {
      errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ต้องระบุชื่อ slot'));
    } else {
      if (slotName.indexOf(',') !== -1) {
        errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ไม่อนุญาตให้ใช้จุลภาคในชื่อ slot'));
      }
      if (seenNames[slotName]) {
        errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อ: ชื่อซ้ำ "' + slotName + '" (แถว ' + seenNames[slotName] + ')'));
      } else {
        seenNames[slotName] = sheetRow;
      }
    }

    // periods: new timeslot format
    if (period) {
      var invalid = getInvalidPreplaceSlotTokens(period);
      for (var t = 0; t < invalid.length; t++) {
        errors.push(_err(sheetRow, slotIdx + 1, 'คาบ: รูปแบบ slot ไม่ถูกต้อง "' + invalid[t] + '" — ใช้ DAILY_1, MON_1 หรือ MON_1-3'));
      }
    }

    // students: each token must be valid
    var studentsVal = studentsIdx !== -1 ? sanitize(row[studentsIdx]) : '';
    if (studentsVal) {
      var studentTokens = splitAndSanitize(studentsVal);
      for (var i = 0; i < studentTokens.length; i++) {
        if (!isValidStudentsToken(studentTokens[i])) {
          errors.push(_err(sheetRow, studentsIdx + 1, 'students: token ไม่ถูกต้อง "' + studentTokens[i] + '" — ใช้ ALL, student_grade:N หรือ class_id'));
        }
      }
    }

    // teachers: each token must be valid; homeroom_teacher requires non-empty students
    var teachersVal = teachersIdx !== -1 ? sanitize(row[teachersIdx]) : '';
    if (teachersVal) {
      var teacherTokens = splitAndSanitize(teachersVal);
      for (var i = 0; i < teacherTokens.length; i++) {
        if (!isValidTeachersToken(teacherTokens[i])) {
          errors.push(_err(sheetRow, teachersIdx + 1, 'teachers: token ไม่ถูกต้อง "' + teacherTokens[i] + '" — ใช้ ALL, department:X, homeroom_grade:N, homeroom_teacher หรือ teacher_id'));
        } else if (teacherTokens[i] === 'homeroom_teacher' && !studentsVal) {
          errors.push(_err(sheetRow, teachersIdx + 1, 'teachers: "homeroom_teacher" ต้องระบุ students ด้วย'));
        }
      }
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 6. Scout (deprecated — absorbed into preplace) ──────────────────────────

function validateScout(data) {
  return { valid: true, errors: [], warnings: [_warn(1, 1, 'scout tab is deprecated — use preplace.teachers instead')] };
}

// ─── 7. Elective ─────────────────────────────────────────────────────────────

function validateElective(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "elective" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  var required = ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน', 'elective_slot'];
  errors = errors.concat(_checkRequiredHeaders(headers, required));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var subjectIdx  = headers.indexOf('รหัสวิชา');
  var nameIdx     = headers.indexOf('ชื่อวิชา (เสรี)');
  var teacherIdx  = headers.indexOf('ครูผู้สอน');
  var roomIdx     = headers.indexOf('ห้องเรียน');
  var slotIdx     = headers.indexOf('elective_slot');

  var seenSubjectIds = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    var subjectId   = sanitize(row[subjectIdx]);
    var subjectName = sanitize(row[nameIdx]);
    var teacherVal  = sanitize(row[teacherIdx]);
    var roomVal     = sanitize(row[roomIdx]);
    var slotVal     = sanitize(row[slotIdx]);

    // subject_id required + unique
    if (!subjectId) {
      errors.push(_err(sheetRow, subjectIdx + 1, 'รหัสวิชา: ต้องระบุรหัสวิชา'));
    } else if (seenSubjectIds[subjectId]) {
      errors.push(_err(sheetRow, subjectIdx + 1, 'รหัสวิชา: รหัสซ้ำ "' + subjectId + '" (แถว ' + seenSubjectIds[subjectId] + ')'));
    } else {
      seenSubjectIds[subjectId] = sheetRow;
    }

    // subject_name required
    if (!subjectName) {
      errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อวิชา (เสรี): ต้องระบุชื่อวิชา'));
    }

    // teacher required, single value (no pipe/comma multi)
    if (!teacherVal) {
      errors.push(_err(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ต้องระบุครูผู้สอน'));
    } else if (teacherVal.indexOf(',') !== -1 || teacherVal.indexOf('|') !== -1) {
      errors.push(_err(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ต้องระบุครูคนเดียว ไม่อนุญาตให้ใช้จุลภาคหรือ "|"'));
    }

    // room required
    if (!roomVal) {
      errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ต้องระบุห้องเรียน'));
    }

    // elective_slot required
    if (!slotVal) {
      errors.push(_err(sheetRow, slotIdx + 1, 'elective_slot: ต้องระบุ slot'));
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 8. Curriculum ───────────────────────────────────────────────────────────

function validateCurriculum(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "curriculum" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['รหัสวิชา', 'ชื่อวิชา', 'คาบ/สัปดาห์', 'ครู']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var subjectIdx    = headers.indexOf('รหัสวิชา');
  var nameIdx       = headers.indexOf('ชื่อวิชา');
  var periodsIdx    = headers.indexOf('คาบ/สัปดาห์');
  var teacherIdx    = headers.indexOf('ครู');
  var blockIdx      = headers.indexOf('การแบ่งคาบสอน');
  var constraintIdx = headers.indexOf('constraint');
  var roomIdx       = headers.indexOf('ห้องเรียน');
  var classRangeIdx = headers.indexOf('ห้อง (นักเรียน) ที่สอน');

  var currentGrade    = '';
  var gradeSubjectIds = {}; // grade → { subject_id → sheetRow }
  var currentGroup    = null;

  function _finalizeGroup() {
    if (!currentGroup) return;
    var groupRows      = currentGroup.rows;
    var anchorPeriods  = currentGroup.anchorPeriods;
    var constraintType = currentGroup.constraintType;
    var anchor         = currentGroup.anchor;

    // Same periods_per_week across all rows
    for (var g = 0; g < groupRows.length; g++) {
      var gr = groupRows[g];
      if (gr.periods && gr.periods !== anchorPeriods) {
        errors.push(_err(gr.sheetRow, periodsIdx + 1,
          'คาบ/สัปดาห์: ต้องเท่ากันทุกแถวในกลุ่มเดียวกัน (anchor: ' + anchorPeriods + ')'));
      }
    }

    // MULTI_CLASS_TEAM: all rows share same teacher list
    if (constraintType === 'MULTI_CLASS_TEAM' && groupRows.length > 1) {
      for (var g = 1; g < groupRows.length; g++) {
        var gr = groupRows[g];
        if (gr.teacher && gr.teacher !== currentGroup.anchorTeacher) {
          warnings.push(_warn(gr.sheetRow, teacherIdx + 1,
            'ครู: MULTI_CLASS_TEAM ทุกแถวในกลุ่มต้องมีรายชื่อครูเดียวกับ anchor'));
        }
      }
    }

    // TEACHER_SPLIT: teacher count equals block count
    if (constraintType === 'TEACHER_SPLIT') {
      var bp = anchor.blockPattern;
      var tl = anchor.teacherList;
      if (bp && tl && tl.length !== bp.length) {
        errors.push(_err(anchor.sheetRow, teacherIdx + 1,
          'ครู: TEACHER_SPLIT จำนวนครู (' + tl.length + ') ต้องเท่ากับจำนวนบล็อก (' + bp.length + ')'));
      }
    }

    // TEAM: multiple teachers required
    if (constraintType === 'TEAM') {
      var tl = anchor.teacherList;
      if (!tl || tl.length < 2) {
        errors.push(_err(anchor.sheetRow, teacherIdx + 1,
          'ครู: TEAM ต้องระบุครูมากกว่า 1 คน'));
      }
    }

    // SUB_GROUP: same section not repeated across group rows
    if (constraintType === 'SUB_GROUP' && classRangeIdx !== -1) {
      var seenSections = {};
      for (var g = 0; g < groupRows.length; g++) {
        var gr = groupRows[g];
        if (!gr.studentClass) continue;
        var secs = parsePipeSegments(gr.studentClass);
        for (var s = 0; s < secs.length; s++) {
          var sec = secs[s];
          if (seenSections[sec]) {
            errors.push(_err(gr.sheetRow, classRangeIdx + 1,
              'ห้อง (นักเรียน) ที่สอน: SUB_GROUP ห้อง "' + sec + '" ซ้ำกับแถว ' + seenSections[sec]));
          } else {
            seenSections[sec] = gr.sheetRow;
          }
        }
      }
    }

    currentGroup = null;
  }

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;

    if (_isEmptyRow(row)) { _finalizeGroup(); continue; }
    if (isMarkerRow(row)) {
      _finalizeGroup();
      var firstCell = sanitize(row[0]);
      if (isGradeHeader(firstCell)) {
        currentGrade = firstCell;
        if (!gradeSubjectIds[currentGrade]) gradeSubjectIds[currentGrade] = {};
      }
      continue;
    }

    var subjectId   = sanitize(row[subjectIdx]);
    var subjectName = sanitize(row[nameIdx]);
    var periods     = sanitize(row[periodsIdx]);
    var teacherVal  = teacherIdx !== -1 ? sanitize(row[teacherIdx]) : '';
    var blockVal    = blockIdx !== -1   ? sanitize(row[blockIdx])    : '';
    var constraintVal = constraintIdx !== -1 ? sanitize(row[constraintIdx]) : '';
    var studentClass  = classRangeIdx !== -1 ? sanitize(row[classRangeIdx]) : '';

    var isAnchor       = !!subjectId;
    var isContinuation = !subjectId && !subjectName;

    // Continuation before any anchor in this grade block → error
    if (isContinuation && !currentGroup) {
      errors.push(_err(sheetRow, subjectIdx + 1, 'รหัสวิชา: แถวต่อเนื่องปรากฏก่อนแถวหลัก (anchor)'));
      continue;
    }

    // Validate periods_per_week (must be positive integer if present)
    var periodsNum = null;
    if (periods) {
      if (!/^\d+$/.test(periods) || parseInt(periods, 10) <= 0) {
        errors.push(_err(sheetRow, periodsIdx + 1, 'คาบ/สัปดาห์: ต้องเป็นจำนวนเต็มบวก — ได้รับ "' + periods + '"'));
      } else {
        periodsNum = parseInt(periods, 10);
      }
    }

    // Validate block_pattern
    var blockPattern = null;
    if (blockVal) {
      blockPattern = parseBlockPattern(blockVal);
      if (!blockPattern) {
        errors.push(_err(sheetRow, blockIdx + 1,
          'การแบ่งคาบสอน: ต้องเป็นตัวเลขคั่นด้วย "-" เช่น 1-1-1 — ได้รับ "' + blockVal + '"'));
      } else if (periodsNum !== null) {
        var blockSum = blockPattern.reduce(function(a, b) { return a + b; }, 0);
        if (blockSum !== periodsNum) {
          errors.push(_err(sheetRow, blockIdx + 1,
            'การแบ่งคาบสอน: ผลรวม (' + blockSum + ') ต้องเท่ากับ คาบ/สัปดาห์ (' + periodsNum + ')'));
        }
      }
    }

    // Validate constraint
    var constraintType = null;
    if (constraintVal) {
      var typeMatches = constraintVal.match(/\btype=\S+/g);
      if (typeMatches && typeMatches.length > 1) {
        errors.push(_err(sheetRow, constraintIdx + 1, 'constraint: มี type= มากกว่า 1 รายการ'));
      }
      var ct = parseConstraintType(constraintVal);
      if (ct && !ct.valid) {
        errors.push(_err(sheetRow, constraintIdx + 1,
          'constraint: type= ไม่ถูกต้อง "' + ct.value + '" — ต้องเป็น TEAM, MULTI_CLASS_TEAM, SUB_GROUP, TEACHER_SPLIT, หรือ SEPARATE_SLOT'));
      } else if (ct) {
        constraintType = ct.value;
      }
    }

    // SUB_GROUP: pipe count must match across teacher, room, student_class
    if (constraintType === 'SUB_GROUP') {
      var tSegs = parsePipeSegments(teacherVal).length;
      var rSegs = (roomIdx !== -1 && sanitize(row[roomIdx])) ? parsePipeSegments(sanitize(row[roomIdx])).length : 0;
      var cSegs = studentClass ? parsePipeSegments(studentClass).length : 0;
      var maxSegs = Math.max(tSegs, rSegs, cSegs);
      if (maxSegs > 1 && (tSegs !== maxSegs || (rSegs > 1 && rSegs !== maxSegs) || (cSegs > 1 && cSegs !== maxSegs))) {
        errors.push(_err(sheetRow, teacherIdx + 1,
          'constraint SUB_GROUP: จำนวน segments ("|") ต้องเท่ากันใน ครู, ห้องเรียน, ห้อง (นักเรียน) ที่สอน'));
      }
    }

    if (isAnchor) {
      _finalizeGroup();

      // subject_id uniqueness per grade
      if (currentGrade) {
        if (!gradeSubjectIds[currentGrade]) gradeSubjectIds[currentGrade] = {};
        if (gradeSubjectIds[currentGrade][subjectId]) {
          errors.push(_err(sheetRow, subjectIdx + 1,
            'รหัสวิชา: รหัสซ้ำ "' + subjectId + '" ในชั้น ' + currentGrade + ' (แถว ' + gradeSubjectIds[currentGrade][subjectId] + ')'));
        } else {
          gradeSubjectIds[currentGrade][subjectId] = sheetRow;
        }
      }

      // anchor required fields
      if (!subjectName) {
        errors.push(_err(sheetRow, nameIdx + 1, 'ชื่อวิชา: ต้องระบุชื่อวิชา'));
      }
      if (!teacherVal) {
        errors.push(_err(sheetRow, teacherIdx + 1, 'ครู: ต้องระบุครูผู้สอน'));
      }

      var teacherList = teacherVal ? splitAndSanitize(teacherVal) : [];

      currentGroup = {
        anchor:         { sheetRow: sheetRow, blockPattern: blockPattern, teacherList: teacherList },
        anchorPeriods:  periods,
        anchorTeacher:  teacherVal,
        constraintType: constraintType,
        rows:           [{ sheetRow: sheetRow, periods: periods, teacher: teacherVal, studentClass: studentClass }]
      };

    } else if (isContinuation && currentGroup) {
      currentGroup.rows.push({ sheetRow: sheetRow, periods: periods, teacher: teacherVal, studentClass: studentClass });
    }
    // activity rows (subject_id empty, subject_name present) pass through without group tracking
  }

  _finalizeGroup();

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 9. Constraints ──────────────────────────────────────────────────────────

function validateConstraints(data) {
  return { valid: true, errors: [], warnings: [] };
}

// ─── Phase 2: Referential Validation ─────────────────────────────────────────

function buildGASLookups(allData) {
  var lookups = {
    roomIds:           {},
    roomNotes:         {},
    roomCapabilityTags:{},
    homeroomTaggedRooms: {},
    roomTypes:         {}, // kept for backward compat with _resolveRoom
    teacherNames:      [],
    teacherIds:        {},
    departments:       {},
    homeroomClasses:   {}, // teacher_id → homeroom_class
    homeroomRooms:     {}, // room_id → student class_id
    gradeToSections:   {}, // 'ม.N' → { section → true }
    classIds:          {},
    preplaceNames:     {},
    curriculumRoomRefs:{}
  };

  // 1. Room lookups
  var roomData = allData['room'];
  if (roomData && roomData.length > 1) {
    var h = roomData[0].map(function(c) { return sanitize(c); });
    var idIdx   = h.indexOf('room_id');
    var nameIdx = h.indexOf('room_name');
    if (nameIdx === -1) nameIdx = h.indexOf('ชื่อห้อง');
    var tagsIdx = h.indexOf('tags');
    if (tagsIdx === -1) tagsIdx = h.indexOf('ประเภท');

    for (var r = 1; r < roomData.length; r++) {
      if (_isEmptyRow(roomData[r]) || isMarkerRow(roomData[r])) continue;
      var rid = idIdx !== -1 ? sanitize(roomData[r][idIdx]) : '';
      if (rid) lookups.roomIds[rid] = true;
      var rname = nameIdx !== -1 ? sanitize(roomData[r][nameIdx]) : '';
      if (rname) lookups.roomNotes[rname] = true;
      if (tagsIdx !== -1) {
        var tagsRaw = sanitize(roomData[r][tagsIdx]);
        if (tagsRaw) {
          var tagList = tagsRaw.split(',');
          for (var t = 0; t < tagList.length; t++) {
            var tag = sanitize(tagList[t]);
            if (!tag) continue;
            if (tag.toLowerCase() === 'homeroom') {
              if (rid) lookups.homeroomTaggedRooms[rid] = true;
            } else if (tag.toLowerCase() !== 'exclude') {
              lookups.roomCapabilityTags[tag] = true;
              lookups.roomTypes[tag] = true; // backward compat
            }
          }
        }
      }
    }
  }

  // 2. Teacher lookups
  var teacherData = allData['teacher'];
  if (teacherData && teacherData.length > 1) {
    var h = teacherData[0].map(function(c) { return sanitize(c); });
    var tidIdx  = h.indexOf('teacher_id');
    var nameIdx = h.indexOf('ชื่อ');
    var deptIdx = h.indexOf('กลุ่มสาระ');
    var hcIdx   = h.indexOf('homeroom_class');

    for (var r = 1; r < teacherData.length; r++) {
      if (_isEmptyRow(teacherData[r]) || isMarkerRow(teacherData[r])) continue;
      var firstCell = tidIdx !== -1 ? sanitize(teacherData[r][tidIdx]) : '';
      if (isSkipRow(firstCell)) continue;

      var tid   = tidIdx  !== -1 ? sanitize(teacherData[r][tidIdx])  : '';
      var tname = nameIdx !== -1 ? sanitize(teacherData[r][nameIdx]) : '';
      var dept  = deptIdx !== -1 ? sanitize(teacherData[r][deptIdx]) : '';
      var hc    = hcIdx   !== -1 ? sanitize(teacherData[r][hcIdx])   : '';

      if (tid)   lookups.teacherIds[tid] = true;
      if (tname) lookups.teacherNames.push(tname);
      if (dept)  lookups.departments[dept] = true;
      if (tid && hc) lookups.homeroomClasses[tid] = hc;
    }
  }

  // 3. Student lookups (v2: class_id column, derive grade from G/S format)
  var studentData = allData['student'];
  if (studentData && studentData.length > 1) {
    var h = studentData[0].map(function(c) { return sanitize(c); });
    var classColIdx  = h.indexOf('class_id');
    var hrRoomIdx    = h.indexOf('homeroom_room');
    // backward compat: old column name was 'นักเรียน'
    if (classColIdx === -1) classColIdx = h.indexOf('นักเรียน');

    for (var r = 1; r < studentData.length; r++) {
      if (_isEmptyRow(studentData[r]) || isMarkerRow(studentData[r])) continue;
      var cid = classColIdx !== -1 ? sanitize(studentData[r][classColIdx]) : '';
      if (cid && isValidClassId(cid)) {
        lookups.classIds[cid] = true;
        var cidParts = cid.split('/');
        var gradeNum = parseInt(cidParts[0], 10);
        var sectNum  = parseInt(cidParts[1], 10);
        if (!isNaN(gradeNum) && !isNaN(sectNum)) {
          var grade = 'ม.' + gradeNum;
          if (!lookups.gradeToSections[grade]) lookups.gradeToSections[grade] = {};
          lookups.gradeToSections[grade][sectNum] = true;
        }
      }
      if (hrRoomIdx !== -1) {
        var hrRoom = sanitize(studentData[r][hrRoomIdx]);
        if (hrRoom && cid) lookups.homeroomRooms[hrRoom] = cid;
      }
    }
  }

  // 4. Preplace name lookups
  var preplaceData = allData['preplace'];
  if (preplaceData && preplaceData.length > 1) {
    var h = preplaceData[0].map(function(c) { return sanitize(c); });
    var pnameIdx = h.indexOf('ชื่อ');
    if (pnameIdx !== -1) {
      for (var r = 1; r < preplaceData.length; r++) {
        if (_isEmptyRow(preplaceData[r]) || isMarkerRow(preplaceData[r])) continue;
        var pname = sanitize(preplaceData[r][pnameIdx]);
        if (pname) lookups.preplaceNames[pname] = true;
      }
    }
  }

  // 5. Curriculum room reference lookups (for capability tag warning)
  var curriculumData = allData['curriculum'];
  if (curriculumData && curriculumData.length > 1) {
    var ch = curriculumData[0].map(function(c) { return sanitize(c); });
    var roomColIdx = ch.indexOf('ห้องเรียน');
    if (roomColIdx !== -1) {
      for (var r = 1; r < curriculumData.length; r++) {
        if (_isEmptyRow(curriculumData[r]) || isMarkerRow(curriculumData[r])) continue;
        var roomVal = sanitize(curriculumData[r][roomColIdx]);
        if (!roomVal) continue;
        var segs = parsePipeSegments(roomVal);
        if (segs.length > 1) {
          for (var s = 0; s < segs.length; s++) {
            var refs = splitAndSanitize(segs[s]);
            for (var ri = 0; ri < refs.length; ri++) {
              if (refs[ri]) lookups.curriculumRoomRefs[refs[ri]] = true;
            }
          }
        } else {
          var refs = splitAndSanitize(roomVal);
          for (var ri = 0; ri < refs.length; ri++) {
            if (refs[ri]) lookups.curriculumRoomRefs[refs[ri]] = true;
          }
        }
      }
    }
  }

  return lookups;
}

// Resolves a curriculum room ref against room_id or capability tag (not homeroom/exclude).
function _resolveRoom(ref, lookups) {
  var v = sanitize(ref);
  return lookups.roomIds[v] || lookups.roomCapabilityTags[v];
}

// ─── Teacher refs ────────────────────────────────────────────────────────────

function validateTeacherRefs(data, lookups) {
  var errors = [], warnings = [];
  if (!data || data.length < 2) return { valid: true, errors: [], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  var idIdx = headers.indexOf('teacher_id');
  var hcIdx = headers.indexOf('homeroom_class');
  if (hcIdx === -1) return { valid: true, errors: [], warnings: [] };

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;
    var idVal = idIdx !== -1 ? sanitize(row[idIdx]) : '';
    if (isSkipRow(idVal)) continue;

    var hcVal = sanitize(row[hcIdx]);
    if (!hcVal) continue;

    // T-type: homeroom_class must exist in student.class_id
    if (idVal && idVal.charAt(0) === 'T') {
      if (!lookups.classIds[hcVal]) {
        errors.push(_err(sheetRow, hcIdx + 1,
          'homeroom_class: ไม่พบ class_id "' + hcVal + '" ในแท็บ student'));
      }
    }
    // E-type: structural validator already warned — no further ref check needed
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── Student refs ────────────────────────────────────────────────────────────

function validateStudentRefs(data, lookups) {
  var errors = [], warnings = [];
  if (!data || data.length < 2) return { valid: true, errors: [], warnings: [] };

  var headers   = data[0].map(function(h) { return sanitize(h); });
  var hrRoomIdx = headers.indexOf('homeroom_room');
  if (hrRoomIdx === -1) return { valid: true, errors: [], warnings: [] };

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    var hrRoom = sanitize(row[hrRoomIdx]);
    if (!hrRoom) continue;

    if (!lookups.roomIds[hrRoom]) {
      errors.push(_err(sheetRow, hrRoomIdx + 1,
        'homeroom_room: ไม่พบ room_id "' + hrRoom + '" ในแท็บ room'));
    }
  }

  // Every homeroom-tagged room must be referenced by exactly one student
  for (var rid in lookups.homeroomTaggedRooms) {
    if (!lookups.homeroomRooms[rid]) {
      warnings.push(_warn(1, 1,
        'room "' + rid + '" มีแท็ก homeroom แต่ไม่มีนักเรียนใดอ้างอิงใน homeroom_room'));
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── Room refs ───────────────────────────────────────────────────────────────

function validateRoomRefs(data, lookups) {
  var errors = [], warnings = [];

  // Capability tags not referenced by any curriculum.room → warning
  for (var tag in lookups.roomCapabilityTags) {
    if (!lookups.curriculumRoomRefs[tag]) {
      warnings.push(_warn(1, 1,
        'tags: room tag "' + tag + '" ไม่ถูกอ้างอิงในแท็บ curriculum (ห้องเรียน)'));
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── Curriculum refs ─────────────────────────────────────────────────────────

function validateCurriculumRefs(data, lookups) {
  var errors = [], warnings = [];
  var headers      = data[0].map(function(h) { return sanitize(h); });
  var teacherIdx   = headers.indexOf('ครู');
  var roomIdx      = headers.indexOf('ห้องเรียน');
  var classRangeIdx = headers.indexOf('ห้อง (นักเรียน) ที่สอน');

  var currentGrade = '';

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;

    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) {
      var firstCell = sanitize(row[0]);
      if (isGradeHeader(firstCell)) currentGrade = firstCell;
      continue;
    }

    // ── Teachers ──────────────────────────────────────────────────────────
    if (teacherIdx !== -1) {
      var teacherRaw = sanitize(row[teacherIdx]);
      if (teacherRaw) {
        var tSegs = parsePipeSegments(teacherRaw);
        if (tSegs.length > 1) {
          // SUB_GROUP pipe segments
          for (var p = 0; p < tSegs.length; p++) {
            var tItems = splitAndSanitize(tSegs[p]);
            for (var ti = 0; ti < tItems.length; ti++) {
              if (lookups.teacherNames.indexOf(tItems[ti]) === -1) {
                var sug = fuzzyMatchTeacher(tItems[ti], lookups.teacherNames);
                errors.push(_err(sheetRow, teacherIdx + 1,
                  'ครู (segment ' + (p + 1) + '): ไม่พบ "' + tItems[ti] + '"', sug));
              }
            }
          }
        } else {
          var tItems = splitAndSanitize(teacherRaw);
          for (var ti = 0; ti < tItems.length; ti++) {
            if (lookups.teacherNames.indexOf(tItems[ti]) === -1) {
              var sug = fuzzyMatchTeacher(tItems[ti], lookups.teacherNames);
              errors.push(_err(sheetRow, teacherIdx + 1,
                'ครู: ไม่พบ "' + tItems[ti] + '"', sug));
            }
          }
        }
      }
    }

    // ── Rooms ─────────────────────────────────────────────────────────────
    if (roomIdx !== -1) {
      var roomRaw = sanitize(row[roomIdx]);
      if (roomRaw) {
        var rSegs = parsePipeSegments(roomRaw);
        if (rSegs.length > 1) {
          for (var p = 0; p < rSegs.length; p++) {
            var rItems = splitAndSanitize(rSegs[p]);
            for (var ri = 0; ri < rItems.length; ri++) {
              if (rItems[ri].toLowerCase() === 'exclude') {
                errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่สามารถใช้แท็ก "exclude" ได้'));
              } else if (!_resolveRoom(rItems[ri], lookups)) {
                errors.push(_err(sheetRow, roomIdx + 1,
                  'ห้องเรียน (segment ' + (p + 1) + '): ไม่พบ "' + rItems[ri] + '"'));
              }
            }
          }
        } else {
          var rItems = splitAndSanitize(roomRaw);
          for (var ri = 0; ri < rItems.length; ri++) {
            if (rItems[ri].toLowerCase() === 'exclude') {
              errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่สามารถใช้แท็ก "exclude" ได้'));
            } else if (!_resolveRoom(rItems[ri], lookups)) {
              errors.push(_err(sheetRow, roomIdx + 1,
                'ห้องเรียน: ไม่พบ "' + rItems[ri] + '" — ต้องเป็น room_id หรือ capability tag'));
            }
          }
        }
      }
    }

    // ── Student class ──────────────────────────────────────────────────────
    if (classRangeIdx !== -1) {
      var classRangeStr = sanitize(row[classRangeIdx]);
      if (classRangeStr) {
        var cPipeSegs = parsePipeSegments(classRangeStr);
        if (cPipeSegs.length > 1) {
          // SUB_GROUP: absolute class IDs
          for (var p = 0; p < cPipeSegs.length; p++) {
            var seg = cPipeSegs[p].trim();
            if (!seg) continue;
            if (!isValidClassId(seg)) {
              errors.push(_err(sheetRow, classRangeIdx + 1,
                'ห้อง (นักเรียน) ที่สอน: "' + seg + '" ไม่ใช่ class_id ที่ถูกต้อง (G/S)'));
            } else if (!lookups.classIds[seg]) {
              errors.push(_err(sheetRow, classRangeIdx + 1,
                'ห้อง (นักเรียน) ที่สอน: ไม่พบ class_id "' + seg + '" ในแท็บ student'));
            }
          }
        } else {
          // Normal: /N-M relative format relative to current grade
          if (currentGrade) {
            var sections = parseStudentClassString(classRangeStr);
            var validSections = lookups.gradeToSections[currentGrade];
            if (!validSections) {
              errors.push(_err(sheetRow, classRangeIdx + 1,
                'ห้อง (นักเรียน) ที่สอน: ไม่พบข้อมูลนักเรียนชั้น ' + currentGrade + ' ในระบบ'));
            } else {
              var missing = [];
              for (var j = 0; j < sections.length; j++) {
                if (!validSections[sections[j]]) missing.push('/' + sections[j]);
              }
              if (missing.length > 0) {
                errors.push(_err(sheetRow, classRangeIdx + 1,
                  'ห้อง (นักเรียน) ที่สอน: ห้อง ' + missing.join(', ') + ' ไม่มีในชั้น ' + currentGrade));
              }
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── Elective refs ───────────────────────────────────────────────────────────

function validateElectiveRefs(data, lookups) {
  var errors = [], warnings = [];
  var headers    = data[0].map(function(h) { return sanitize(h); });
  var teacherIdx = headers.indexOf('ครูผู้สอน');
  var roomIdx    = headers.indexOf('ห้องเรียน');
  var slotIdx    = headers.indexOf('elective_slot');

  var teacherSlotMap = {}; // teacher_name → { slot_token → sheetRow }
  var roomSlotMap    = {}; // room_id → { slot_token → sheetRow }

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    var teacherVal = teacherIdx !== -1 ? sanitize(row[teacherIdx]) : '';
    var roomVal    = roomIdx !== -1    ? sanitize(row[roomIdx])    : '';
    var slotVal    = slotIdx !== -1    ? sanitize(row[slotIdx])    : '';

    // teacher: single name, must exist in teacher sheet
    if (teacherVal) {
      if (lookups.teacherNames.indexOf(teacherVal) === -1) {
        var sug = fuzzyMatchTeacher(teacherVal, lookups.teacherNames);
        errors.push(_err(sheetRow, teacherIdx + 1,
          'ครูผู้สอน: ไม่พบชื่อครู "' + teacherVal + '" ในแท็บ teacher', sug));
      }
    } else {
      warnings.push(_warn(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ไม่ได้ระบุครูผู้สอน'));
    }

    // room: must be a room_id (not a tag)
    if (roomVal) {
      if (!lookups.roomIds[roomVal]) {
        errors.push(_err(sheetRow, roomIdx + 1,
          'ห้องเรียน: "' + roomVal + '" ต้องเป็น room_id จริง ไม่ใช่ชื่อหรือแท็ก'));
      }
    } else {
      warnings.push(_warn(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่ได้ระบุห้องเรียน'));
    }

    // elective_slot: each token must exist in preplace names; cross-row conflict check
    if (slotVal) {
      var slotTokens = slotVal.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      for (var s = 0; s < slotTokens.length; s++) {
        var token = slotTokens[s];
        if (!lookups.preplaceNames[token]) {
          errors.push(_err(sheetRow, slotIdx + 1,
            'elective_slot: ไม่พบ preplace name "' + token + '" ในแท็บ preplace'));
        }
        // Teacher cross-row conflict
        if (teacherVal) {
          if (!teacherSlotMap[teacherVal]) teacherSlotMap[teacherVal] = {};
          if (teacherSlotMap[teacherVal][token]) {
            errors.push(_err(sheetRow, slotIdx + 1,
              'elective_slot: ครู "' + teacherVal + '" ถูกใช้ซ้ำที่ slot "' + token + '" (ซ้ำกับแถว ' + teacherSlotMap[teacherVal][token] + ')'));
          } else {
            teacherSlotMap[teacherVal][token] = sheetRow;
          }
        }
        // Room cross-row conflict
        if (roomVal) {
          if (!roomSlotMap[roomVal]) roomSlotMap[roomVal] = {};
          if (roomSlotMap[roomVal][token]) {
            errors.push(_err(sheetRow, slotIdx + 1,
              'elective_slot: ห้อง "' + roomVal + '" ถูกใช้ซ้ำที่ slot "' + token + '" (ซ้ำกับแถว ' + roomSlotMap[roomVal][token] + ')'));
          } else {
            roomSlotMap[roomVal][token] = sheetRow;
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── Preplace refs ───────────────────────────────────────────────────────────

function validatePreplaceRefs(data, lookups) {
  var errors = [], warnings = [];
  if (!data || data.length < 2) return { valid: true, errors: [], warnings: [] };

  var headers     = data[0].map(function(h) { return sanitize(h); });
  var nameIdx     = headers.indexOf('ชื่อ');
  var periodIdx   = headers.indexOf('คาบ');
  var studentsIdx = headers.indexOf('students');
  var teachersIdx = headers.indexOf('teachers');

  var teacherPeriodMap = {}; // teacher_id → [{name, periodTokens, sheetRow}]

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    var rowName    = nameIdx   !== -1 ? sanitize(row[nameIdx])   : '';
    var periodVal  = periodIdx !== -1 ? sanitize(row[periodIdx]) : '';
    var periodTokens = periodVal
      ? periodVal.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
      : [];

    // students cross-sheet checks
    if (studentsIdx !== -1) {
      var studentsVal = sanitize(row[studentsIdx]);
      if (studentsVal) {
        var studentTokens = splitAndSanitize(studentsVal);
        for (var i = 0; i < studentTokens.length; i++) {
          var st = studentTokens[i];
          if (!isValidStudentsToken(st)) continue; // structural already caught invalid tokens
          if (/^student_grade:(\d+)$/.test(st)) {
            var gradeNum = parseInt(st.split(':')[1], 10);
            var grade    = 'ม.' + gradeNum;
            if (!lookups.gradeToSections[grade]) {
              errors.push(_err(sheetRow, studentsIdx + 1,
                'students: ไม่พบนักเรียนชั้น ' + grade + ' ในแท็บ student'));
            }
          } else if (isValidClassId(st)) {
            if (!lookups.classIds[st]) {
              errors.push(_err(sheetRow, studentsIdx + 1,
                'students: ไม่พบ class_id "' + st + '" ในแท็บ student'));
            }
          }
        }
      }
    }

    // teachers cross-sheet checks
    if (teachersIdx !== -1) {
      var teachersVal = sanitize(row[teachersIdx]);
      if (teachersVal) {
        var teacherTokens  = splitAndSanitize(teachersVal);
        var explicitIds    = [];

        for (var i = 0; i < teacherTokens.length; i++) {
          var tt = teacherTokens[i];
          if (!isValidTeachersToken(tt)) continue; // structural already caught

          if (/^department:(.+)$/.test(tt)) {
            var dept = tt.split(':').slice(1).join(':');
            if (!lookups.departments[dept]) {
              errors.push(_err(sheetRow, teachersIdx + 1,
                'teachers: ไม่พบ department "' + dept + '" ในแท็บ teacher (กลุ่มสาระ)'));
            }

          } else if (/^homeroom_grade:(\d+)$/.test(tt)) {
            var gradeNum    = parseInt(tt.split(':')[1], 10);
            var gradePrefix = gradeNum + '/';
            var found       = false;
            for (var tid in lookups.homeroomClasses) {
              if (lookups.homeroomClasses[tid].indexOf(gradePrefix) === 0) { found = true; break; }
            }
            if (!found) {
              warnings.push(_warn(sheetRow, teachersIdx + 1,
                'teachers: ไม่พบครูที่มี homeroom_class ในชั้น ม.' + gradeNum));
            }

          } else if (isValidTeacherId(tt)) {
            if (!lookups.teacherIds[tt]) {
              errors.push(_err(sheetRow, teachersIdx + 1,
                'teachers: ไม่พบ teacher_id "' + tt + '" ในแท็บ teacher'));
            } else {
              explicitIds.push(tt);
            }
          }
          // ALL, homeroom_teacher → no cross-sheet lookup needed
        }

        // Track explicit IDs for cross-row conflict detection
        for (var i = 0; i < explicitIds.length; i++) {
          var tid = explicitIds[i];
          if (!teacherPeriodMap[tid]) teacherPeriodMap[tid] = [];
          teacherPeriodMap[tid].push({ name: rowName, periods: periodTokens, sheetRow: sheetRow });
        }
      }
    }
  }

  // Cross-row: same explicit teacher_id at same period in two preplace rows → warning
  for (var tid in teacherPeriodMap) {
    var entries = teacherPeriodMap[tid];
    if (entries.length < 2) continue;
    for (var i = 0; i < entries.length - 1; i++) {
      for (var j = i + 1; j < entries.length; j++) {
        var shared = entries[i].periods.filter(function(p) {
          return entries[j].periods.indexOf(p) !== -1;
        });
        if (shared.length > 0) {
          warnings.push(_warn(entries[j].sheetRow, 1,
            'teachers: ครู "' + tid + '" อาจถูกตรึงซ้ำที่คาบ ' + shared.join(',') +
            ' (ซ้ำกับ "' + entries[i].name + '" แถว ' + entries[i].sheetRow + ')'));
        }
      }
    }
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}
