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

/** Returns structured errors for any required headers that are missing. */
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

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var period   = sanitize(row[periodIdx]);
    var time     = sanitize(row[timeIdx]);
    if (!period && !time) continue;
    if (isMarkerRow(row)) continue;
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

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['room_id']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var roomIdx  = headers.indexOf('room_id');
  var classIdx = headers.indexOf('ชั้นเรียนประจำ');
  var tagsIdx  = headers.indexOf('ประเภท');
  var seen = {};

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var roomId   = sanitize(row[roomIdx]);
    if (!roomId && _isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;
    if (!roomId) {
      errors.push(_err(sheetRow, roomIdx + 1, 'room_id: ต้องระบุroom_id'));
      continue;
    }
    if (seen[roomId]) {
      errors.push(_err(sheetRow, roomIdx + 1, 'room_id: รหัสซ้ำ "' + roomId + '" (แถว ' + seen[roomId] + ')'));
    } else {
      seen[roomId] = sheetRow;
    }

    var tagsVal  = tagsIdx  !== -1 ? sanitize(row[tagsIdx])  : '';
    var classVal = classIdx !== -1 ? sanitize(row[classIdx]) : '';

    var hasHomeroomTag = false;
    var nonHomeroomTags = [];
    if (tagsVal) {
      var tagList = tagsVal.split(',');
      for (var t = 0; t < tagList.length; t++) {
        var tag = sanitize(tagList[t]);
        if (tag.toLowerCase() === 'homeroom') {
          hasHomeroomTag = true;
        } else if (tag) {
          nonHomeroomTags.push(tag);
        }
      }
    }

    // RM-4: tag=homeroom requires class_id (error)
    if (hasHomeroomTag && !classVal) {
      errors.push(_err(sheetRow, tagsIdx + 1, 'ประเภท: แท็ก "homeroom" ต้องระบุ "ชั้นเรียนประจำ" ด้วย'));
    }

    // RM-5: homeroom room should not mix with other capability tags
    if (classVal && nonHomeroomTags.length > 0) {
      warnings.push(_warn(sheetRow, tagsIdx + 1, 'ประเภท: ห้อง homeroom ไม่ควรมีแท็กอื่น — ได้รับ "' + nonHomeroomTags.join(',') + '"'));
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
    var idVal    = sanitize(row[idIdx]);
    var nameVal  = sanitize(row[nameIdx]);

    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;
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
      var slotVal = sanitize(row[colIdx]);
      if (!slotVal) continue;
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

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['นักเรียน', 'ชั้น', 'ห้อง']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var classIdx    = headers.indexOf('นักเรียน');
  var gradeIdx    = headers.indexOf('ชั้น');
  var sectionIdx  = headers.indexOf('ห้อง');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    var classId  = sanitize(row[classIdx]);
    var grade    = sanitize(row[gradeIdx]);
    var section  = sanitize(row[sectionIdx]);

    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    if (classId && !isValidClassId(classId))
      errors.push(_err(sheetRow, classIdx + 1, 'นักเรียน: ต้องเป็นรูปแบบ G/S เช่น 1/1 — ได้รับ "' + classId + '"'));
    if (grade && !/^ม\.[1-6]$/.test(grade))
      errors.push(_err(sheetRow, gradeIdx + 1, 'ชั้น: ต้องเป็น ม.1–ม.6 — ได้รับ "' + grade + '"'));
    if (section && (!/^\d+$/.test(section) || parseInt(section) <= 0))
      errors.push(_err(sheetRow, sectionIdx + 1, 'ห้อง: ต้องเป็นจำนวนเต็มบวก — ได้รับ "' + section + '"'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 5. Preplace ─────────────────────────────────────────────────────────────

function validatePreplace(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "preplace" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['ชื่อ', 'คาบ', 'apply_to']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var nameIdx  = headers.indexOf('ชื่อ');
  var slotIdx  = headers.indexOf('คาบ');
  var applyIdx = headers.indexOf('apply_to');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;

    var slotName = sanitize(row[nameIdx]);
    var period   = sanitize(row[slotIdx]);
    var applyTo  = sanitize(row[applyIdx]);

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

var ELECTIVE_SECTION_HEADER = /^เสรีม\.(ต้น|ปลาย)$/;

function validateElective(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "elective" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['รหัสวิชา', 'ชื่อวิชา (เสรี)', 'ครูผู้สอน', 'ห้องเรียน']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var subjectIdx = headers.indexOf('รหัสวิชา');

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;
    
    var subjectId = sanitize(row[subjectIdx]);
    if (ELECTIVE_SECTION_HEADER.test(subjectId)) continue;
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 8. Curriculum ───────────────────────────────────────────────────────────

function validateCurriculum(data) {
  var errors = [], warnings = [];
  if (!data || data.length === 0)
    return { valid: false, errors: [_err(1, 1, 'Tab "curriculum" is empty.')], warnings: [] };

  var headers = data[0].map(function(h) { return sanitize(h); });
  errors = errors.concat(_checkRequiredHeaders(headers, ['รหัสวิชา', 'ครู', 'คาบ/สัปดาห์']));
  if (errors.length) return { valid: false, errors: errors, warnings: warnings };

  var subjectIdx = headers.indexOf('รหัสวิชา');
  var periodsIdx = headers.indexOf('คาบ/สัปดาห์');

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) continue;
    var subject = sanitize(row[subjectIdx]);
    var periods = sanitize(row[periodsIdx]);
    if (!subject) continue;
    if (periods && (!/^\d+(\.\d+)?$/.test(periods) || parseFloat(periods) <= 0))
      errors.push(_err(sheetRow, periodsIdx + 1, 'คาบ/สัปดาห์: ต้องเป็นจำนวนบวก — ได้รับ "' + periods + '"'));
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ─── 9. Constraints ──────────────────────────────────────────────────────────

function validateConstraints(data) {
  return { valid: true, errors: [], warnings: [] };
}

// ─── Phase 2: Referential Validation ─────────────────────────────────────────

function buildGASLookups(allData) {
  var lookups = {
    roomIds: {},
    roomNotes: {},
    roomTypes: {},
    teacherNames: [],
    gradeToSections: {}, // grade -> map of section -> true
    classIds: {}         // class_id -> true
  };

  // 1. Room Lookups
  var roomData = allData['room'];
  if (roomData && roomData.length > 1) {
    var h = roomData[0].map(function(c) { return sanitize(c); });
    var idIdx   = h.indexOf('room_id');
    var nameIdx = h.indexOf('ชื่อห้อง');
    var tagsIdx = h.indexOf('ประเภท');
    for (var r = 1; r < roomData.length; r++) {
      if (_isEmptyRow(roomData[r]) || isMarkerRow(roomData[r])) continue;
      if (idIdx !== -1) { var id = sanitize(roomData[r][idIdx]); if (id) lookups.roomIds[id] = true; }
      if (nameIdx !== -1) { var name = sanitize(roomData[r][nameIdx]); if (name) lookups.roomNotes[name] = true; }
      if (tagsIdx !== -1) {
        var tagsRaw = sanitize(roomData[r][tagsIdx]);
        if (tagsRaw) {
          var tagList = tagsRaw.split(',');
          for (var t = 0; t < tagList.length; t++) {
            var tag = sanitize(tagList[t]);
            if (tag && tag.toLowerCase() !== 'exclude') lookups.roomTypes[tag] = true;
          }
        }
      }
    }
  }

  // 2. Teacher Lookups
  var teacherData = allData['teacher'];
  if (teacherData && teacherData.length > 1) {
    var h = teacherData[0].map(function(c) { return sanitize(c); });
    var nameIdx = h.indexOf('ชื่อ');
    for (var r = 1; r < teacherData.length; r++) {
      if (_isEmptyRow(teacherData[r]) || isMarkerRow(teacherData[r]) || isSkipRow(sanitize(teacherData[r][0]))) continue;
      if (nameIdx !== -1) { 
        var name = sanitize(teacherData[r][nameIdx]); 
        if (name) lookups.teacherNames.push(name); 
      }
    }
  }

  // 3. Student Grade + Class Lookups
  var studentData = allData['student'];
  if (studentData && studentData.length > 1) {
    var h = studentData[0].map(function(c) { return sanitize(c); });
    var classColIdx = h.indexOf('นักเรียน');
    var gradeIdx    = h.indexOf('ชั้น');
    var sectIdx     = h.indexOf('ห้อง');
    for (var r = 1; r < studentData.length; r++) {
      if (_isEmptyRow(studentData[r]) || isMarkerRow(studentData[r])) continue;
      if (classColIdx !== -1) { var cid = sanitize(studentData[r][classColIdx]); if (cid) lookups.classIds[cid] = true; }
      var g = sanitize(studentData[r][gradeIdx]);
      var s = parseInt(sanitize(studentData[r][sectIdx]), 10);
      if (g && !isNaN(s)) {
        if (!lookups.gradeToSections[g]) lookups.gradeToSections[g] = {};
        lookups.gradeToSections[g][s] = true;
      }
    }
  }
  return lookups;
}

function _resolveRoom(ref, lookups) {
  var v = sanitize(ref);
  return lookups.roomIds[v] || lookups.roomNotes[v] || lookups.roomTypes[v];
}

function validateCurriculumRefs(data, lookups) {
  var errors = [], warnings = [];
  var headers = data[0].map(function(h) { return sanitize(h); });
  var teacherIdx = headers.indexOf('ครู');
  var roomIdx    = headers.indexOf('ห้องเรียน');
  var classRangeIdx = headers.indexOf('ห้อง (นักเรียน) ที่สอน');
  
  var currentGrade = '';

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var sheetRow = r + 1;
    var firstCell = sanitize(row[0]);

    if (_isEmptyRow(row)) continue;
    if (isMarkerRow(row)) {
      if (isGradeHeader(firstCell)) {
        currentGrade = firstCell;
      }
      continue;
    }

    // 1. Teachers (Atomic + Fuzzy)
    var teachers = splitAndSanitize(row[teacherIdx]);
    for (var i = 0; i < teachers.length; i++) {
      var t = teachers[i];
      if (lookups.teacherNames.indexOf(t) === -1) {
        var suggestion = fuzzyMatchTeacher(t, lookups.teacherNames);
        errors.push(_err(sheetRow, teacherIdx + 1, 'ครู: ไม่พบชื่อครู "' + t + '" ในแท็บ teacher', suggestion));
      }
    }

    // 2. Rooms (id/name=hard, tag=soft, exclude=forbidden)
    var rooms = splitAndSanitize(row[roomIdx]);
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].toLowerCase() === 'exclude') {
        errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่สามารถใช้แท็ก "exclude" เป็นห้องเรียนได้ — ระบุรหัสห้องตรงๆ แทน'));
      } else if (!_resolveRoom(rooms[i], lookups)) {
        errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่พบ "' + rooms[i] + '" — ต้องเป็น room_id, ชื่อห้อง, หรือแท็กที่มีอยู่ในแท็บ room'));
      }
    }

    // 3. Class Range Check (CU-4)
    if (classRangeIdx !== -1 && currentGrade) {
      var classRangeStr = sanitize(row[classRangeIdx]);
      if (classRangeStr) {
        var sections = parseStudentClassString(classRangeStr);
        var validSections = lookups.gradeToSections[currentGrade];
        
        if (!validSections) {
          errors.push(_err(sheetRow, classRangeIdx + 1, 'ห้อง (นักเรียน) ที่สอน: ไม่พบข้อมูลนักเรียนชั้น ' + currentGrade + ' ในระบบ'));
        } else {
          var missing = [];
          for (var j = 0; j < sections.length; j++) {
            if (!validSections[sections[j]]) {
              missing.push('/' + sections[j]);
            }
          }
          if (missing.length > 0) {
            errors.push(_err(sheetRow, classRangeIdx + 1, 'ห้อง (นักเรียน) ที่สอน: ห้อง ' + missing.join(', ') + ' ไม่มีอยู่ในชั้น ' + currentGrade));
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

function validateElectiveRefs(data, lookups) {
  var errors = [], warnings = [];
  var headers = data[0].map(function(h) { return sanitize(h); });
  var subjectIdx = headers.indexOf('รหัสวิชา');
  var teacherIdx = headers.indexOf('ครูผู้สอน');
  var roomIdx    = headers.indexOf('ห้องเรียน');

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    var subjectId = sanitize(row[subjectIdx]);
    if (ELECTIVE_SECTION_HEADER.test(subjectId)) continue;

    var teachers = splitAndSanitize(row[teacherIdx]);
    if (teachers.length === 0) {
      warnings.push(_warn(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ไม่ได้ระบุครูผู้สอน'));
    } else {
      for (var i = 0; i < teachers.length; i++) {
        var t = teachers[i];
        if (lookups.teacherNames.indexOf(t) === -1) {
          var suggestion = fuzzyMatchTeacher(t, lookups.teacherNames);
          errors.push(_err(sheetRow, teacherIdx + 1, 'ครูผู้สอน: ไม่พบชื่อครู "' + t + '" ในแท็บ teacher', suggestion));
        }
      }
    }

    var rooms = splitAndSanitize(row[roomIdx]);
    if (rooms.length === 0) {
      warnings.push(_warn(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่ได้ระบุห้องเรียน'));
    } else {
      for (var i = 0; i < rooms.length; i++) {
        if (!_resolveRoom(rooms[i], lookups)) {
          errors.push(_err(sheetRow, roomIdx + 1, 'ห้องเรียน: ไม่พบห้อง "' + rooms[i] + '" ในแท็บ room'));
        }
      }
    }
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ห้องประจำ removed from student sheet — no referential room checks needed
function validateStudentRefs(data, lookups) {
  return { valid: true, errors: [], warnings: [] };
}

function validateRoomRefs(data, lookups) {
  var errors = [], warnings = [];
  if (!data || data.length < 2) return { valid: true, errors: [], warnings: [] };

  var headers  = data[0].map(function(h) { return sanitize(h); });
  var classIdx = headers.indexOf('ชั้นเรียนประจำ');
  if (classIdx === -1) return { valid: true, errors: [], warnings: [] };

  for (var r = 1; r < data.length; r++) {
    var row      = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    var classId = sanitize(row[classIdx]);
    if (classId && !lookups.classIds[classId]) {
      errors.push(_err(sheetRow, classIdx + 1, 'ชั้นเรียนประจำ: ไม่พบ "' + classId + '" ในแท็บ student'));
    }
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

function validateScoutRefs(data, lookups) {
  var errors = [], warnings = [];
  var headers = data[0].map(function(h) { return sanitize(h); });

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var sheetRow = r + 1;
    if (_isEmptyRow(row) || isMarkerRow(row)) continue;

    for (var c = 0; c < row.length; c++) {
      var teachers = splitAndSanitize(row[c]);
      for (var i = 0; i < teachers.length; i++) {
        var t = teachers[i];
        if (lookups.teacherNames.indexOf(t) === -1) {
          var suggestion = fuzzyMatchTeacher(t, lookups.teacherNames);
          errors.push(_err(sheetRow, c + 1, headers[c] + ': ไม่พบชื่อครู "' + t + '" ในแท็บ teacher', suggestion));
        }
      }
    }
  }
  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}
