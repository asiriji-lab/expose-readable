// ─── parsers.gs ──────────────────────────────────────────────────────────────
// Ported from: app/(admin)/validators/utils/parsers.ts
// Keep in sync with the TypeScript version.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Sanitization ─────────────────────────────────────────────────────────────

function sanitize(val) {
  if (val == null) return '';
  var s = String(val).trim();
  // Remove BOM, zero-width chars, NBSP, C0 controls
  s = s.replace(/\uFEFF|\u200B|\u200C|\u200D|\u2060|\u00A0|[\u0000-\u001F]/g, '');
  s = s.replace(/[,;]+$/, '');
  return s.trim();
}

function splitAndSanitize(input) {
  if (!input) return [];
  var parts = String(input).split(/[,;\n\r]|\s+\/\s+/);
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var s = sanitize(parts[i]);
    if (s.length > 0) result.push(s);
  }
  return result;
}

// ─── Time / Period ───────────────────────────────────────────────────────────

function isValidTimeFormat(value) {
  var trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return true;
  return /^\d{2}\.\d{2}-\d{2}\.\d{2}$/.test(trimmed);
}

// ─── Slot Tokens ─────────────────────────────────────────────────────────────

// Used by teacher.available_slots — supports DAY_p and DAY_p-q range within a day.
function isValidSlotToken(token) {
  return /^(MON|TUE|WED|THU|FRI)_\d+(-\d+)?$/.test(token.trim());
}

function getInvalidSlotTokens(value) {
  if (!value.trim()) return [];
  return value.split(',').map(function(t) { return t.trim(); })
    .filter(function(t) { return t && !isValidSlotToken(t); });
}

// Used by preplace.periods — DAILY_N, DAILY_N-M (every day), DAY_N, DAY_N-M (single day).
function isValidPreplaceSlotToken(token) {
  return /^(DAILY_\d+(-\d+)?|(MON|TUE|WED|THU|FRI)_\d+(-\d+)?)$/.test(token.trim());
}

function getInvalidPreplaceSlotTokens(value) {
  if (!value.trim()) return [];
  return value.split(',').map(function(t) { return t.trim(); })
    .filter(function(t) { return t && !isValidPreplaceSlotToken(t); });
}

// ─── ID / Code ───────────────────────────────────────────────────────────────

function isValidTeacherId(value) {
  return /^[TE]\d{3,}$/.test(value.trim());
}

function isValidClassId(value) {
  return /^\d+\/\d+$/.test(value.trim());
}

// ─── Grade ───────────────────────────────────────────────────────────────────

function isGradeHeader(value) {
  return /^ม\.([1-6])$/.test(value.trim());
}

// ─── Skip-row Markers ────────────────────────────────────────────────────────

var TEACHER_SKIP_MARKERS_ = ['ครูในโรงเรียน', 'อาจารย์นอก', 'teacher_id', ''];

function isSkipRow(firstCellValue) {
  return TEACHER_SKIP_MARKERS_.indexOf(firstCellValue.trim()) !== -1;
}

function isMarkerRow(row) {
  if (!row || row.length === 0) return false;
  var first = sanitize(row[0]);
  if (!first) return false;

  var restEmpty = true;
  for (var i = 1; i < row.length; i++) {
    if (sanitize(row[i])) { restEmpty = false; break; }
  }
  if (!restEmpty) return false;

  if (isGradeHeader(first)) return true;
  if (/:\s*$/.test(first)) return true;

  return false;
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

function levenshtein(a, b) {
  var matrix = [];
  for (var i = 0; i <= a.length; i++) { matrix[i] = [i]; }
  for (var j = 1; j <= b.length; j++) { matrix[0][j] = j; }

  for (var i = 1; i <= a.length; i++) {
    for (var j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

function fuzzyMatchTeacher(name, validNames) {
  var normalizedInput = sanitize(name).toLowerCase();
  if (!normalizedInput) return null;

  var bestMatch = null;
  var minDistance = 3;

  for (var i = 0; i < validNames.length; i++) {
    var validName = validNames[i];
    var normalizedValid = sanitize(validName).toLowerCase();

    if (normalizedValid.indexOf(normalizedInput) !== -1 || normalizedInput.indexOf(normalizedValid) !== -1) {
      return validName;
    }

    var dist = levenshtein(normalizedInput, normalizedValid);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = validName;
    }
  }

  return bestMatch;
}

// ─── Students token (replaces apply_to) ──────────────────────────────────────
// Accepts: ALL | student_grade:N | class_id (digit/digit)

function isValidStudentsToken(token) {
  var t = token.trim();
  if (t === 'ALL') return true;
  if (/^student_grade:\d+$/.test(t)) return true;
  if (isValidClassId(t)) return true;
  return false;
}

// ─── Teachers token ───────────────────────────────────────────────────────────
// Accepts: ALL | department:X | homeroom_grade:N | homeroom_teacher | teacher_id

function isValidTeachersToken(token) {
  var t = token.trim();
  if (t === 'ALL') return true;
  if (/^department:.+$/.test(t)) return true;
  if (/^homeroom_grade:\d+$/.test(t)) return true;
  if (t === 'homeroom_teacher') return true;
  if (isValidTeacherId(t)) return true;
  return false;
}

// ─── Pipe segment parser ──────────────────────────────────────────────────────
// Splits on "|" (pipe) for SUB_GROUP curriculum rows.

function parsePipeSegments(value) {
  if (!value || !value.trim()) return [];
  return value.split('|').map(function(s) { return s.trim(); }).filter(Boolean);
}

// ─── Block pattern parser ────────────────────────────────────────────────────
// "1-1-1" -> [1, 1, 1]. Returns null if any part is not a positive integer.

function parseBlockPattern(value) {
  if (!value || !value.trim()) return null;
  var parts = value.trim().split('-');
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var n = parseInt(parts[i].trim(), 10);
    if (isNaN(n) || n < 1) return null;
    result.push(n);
  }
  return result.length > 0 ? result : null;
}

// ─── Constraint type extractor ────────────────────────────────────────────────
// Returns { value: string, valid: bool } if "type=X" found, or null if absent.

var VALID_CONSTRAINT_TYPES_ = ['TEAM', 'MULTI_CLASS_TEAM', 'SUB_GROUP', 'TEACHER_SPLIT', 'SEPARATE_SLOT'];

function parseConstraintType(value) {
  if (!value || !value.trim()) return null;
  var match = value.match(/\btype=(\S+)/);
  if (!match) return null;
  var typeName = match[1];
  if (VALID_CONSTRAINT_TYPES_.indexOf(typeName) === -1) return { value: typeName, valid: false };
  return { value: typeName, valid: true };
}

// ─── apply_to (legacy -- kept for backward compatibility) ─────────────────────

function isValidApplyTo(value) {
  var v = value.trim();
  if (v === 'All' || v === 'all') return true;
  if (/^ม\.[1-6]$/.test(v)) return true;
  var parts = v.split(',').map(function(p) { return p.trim(); });
  return parts.every(function(p) { return /^ม\.[1-6]$/.test(p); });
}

// ─── Student class string parser (/N-M relative format for curriculum) ────────

function parseStudentClassString(value) {
  if (!value || !value.trim()) return [];
  var sections = {};
  var elements = value.replace(/\s/g, '').split(',').filter(Boolean);

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var rangeMatch = el.match(/^\/(\d+)-(\d+)$/);
    if (rangeMatch) {
      var start = parseInt(rangeMatch[1], 10);
      var end   = parseInt(rangeMatch[2], 10);
      for (var s = start; s <= end; s++) sections[s] = true;
      continue;
    }
    var singleMatch = el.match(/^\/(\d+)$/);
    if (singleMatch) {
      sections[parseInt(singleMatch[1], 10)] = true;
    }
  }

  var result = [];
  for (var key in sections) { result.push(parseInt(key, 10)); }
  return result.sort(function(a, b) { return a - b; });
}
