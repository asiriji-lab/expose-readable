// ─── parsers.gs ──────────────────────────────────────────────────────────────
// Ported from: app/(admin)/validators/utils/parsers.ts
// Keep in sync with the TypeScript version.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Strips zero-width characters (BOM, ZWSP, etc.) and trims whitespace.
 * Also strips trailing punctuation left by mistake (commas, semicolons).
 */
function sanitize(val) {
  if (val == null) return '';
  var s = String(val).trim();
  // BOM U+FEFF, ZWSP U+200B, NBSP U+00A0, etc.
  s = s.replace(/[\u0000-\u001F\u00A0\u200B\u200C\u200D\u2060\uFEFF]/g, '');
  // Strip trailing punctuation
  s = s.replace(/[,;]+$/, '');
  return s.trim();
}

/**
 * Splits a string into an array of sanitized strings.
 * Splits by comma, semicolon, newline, or a slash surrounded by spaces.
 */
function splitAndSanitize(input) {
  if (!input) return [];
  // GAS regex needs slightly different handling for newlines in some contexts
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

function isValidSlotToken(token) {
  return /^(MON|TUE|WED|THU|FRI)_.+$/.test(token.trim());
}

function getInvalidSlotTokens(value) {
  if (!value.trim()) return [];
  return value.split(',').map(function(t) { return t.trim(); })
    .filter(function(t) { return t && !isValidSlotToken(t); });
}

function isValidPreplaceSlotToken(token) {
  var t = token.trim();
  if (/^Everyday_\d+$/.test(t)) return true;
  if (/^(MON|TUE|WED|THU|FRI)_\d+$/.test(t)) return true;
  if (/^(MON|TUE|WED|THU|FRI)_\d+-(MON|TUE|WED|THU|FRI)_\d+$/.test(t)) return true;
  return false;
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

/**
 * Returns true if this row is a "Marker Cell" — a human-readability section
 * divider that should not be included in validation or data export.
 */
function isMarkerRow(row) {
  if (!row || row.length === 0) return false;
  var first = sanitize(row[0]);
  if (!first) return false;

  // All non-first cells must be empty for this to be a marker row
  var restEmpty = true;
  for (var i = 1; i < row.length; i++) {
    if (sanitize(row[i])) { restEmpty = false; break; }
  }
  if (!restEmpty) return false;

  // Grade-header style: ม.1 – ม.6
  if (isGradeHeader(first)) return true;

  // Label ending with colon convention: e.g. "กลุ่มสาระ:"
  if (/:\s*$/.test(first)) return true;

  return false;
}

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

/**
 * Simple Levenshtein distance implementation for fuzzy matching names.
 */
function levenshtein(a, b) {
  var matrix = [];
  for (var i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (var j = 1; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (var i = 1; i <= a.length; i++) {
    for (var j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Suggests a close match for a teacher name if it doesn't exist.
 * Returns the best match string or null.
 */
function fuzzyMatchTeacher(name, validNames) {
  var normalizedInput = sanitize(name).toLowerCase();
  if (!normalizedInput) return null;

  var bestMatch = null;
  var minDistance = 3; // Max threshold for "closeness"

  for (var i = 0; i < validNames.length; i++) {
    var validName = validNames[i];
    var normalizedValid = sanitize(validName).toLowerCase();
    
    // Check for exact substring match first (e.g. "สมชาย" in "สมชาย แซ่ดี")
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

// ─── apply_to ────────────────────────────────────────────────────────────────

function isValidApplyTo(value) {
  var v = value.trim();
  if (v === 'All' || v === 'all') return true;
  if (/^ม\.[1-6]$/.test(v)) return true;
  var parts = v.split(',').map(function(p) { return p.trim(); });
  return parts.every(function(p) { return /^ม\.[1-6]$/.test(p); });
}

// ─── Student class string parser (for curriculum CU-4) ────────────────────────

/**
 * Parses a ห้อง (นักเรียน) ที่สอน string like "/1, /3-5" into section numbers [1, 3, 4, 5].
 * Supports:
 *   /N       → single section
 *   /N-M     → range inclusive
 *   mixed    → comma-separated combination
 */
function parseStudentClassString(value) {
  if (!value || !value.trim()) return [];
  var sections = {};
  var elements = value.replace(/\s/g, '').split(',').filter(Boolean);
  
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var rangeMatch = el.match(/^\/(\d+)-(\d+)$/);
    if (rangeMatch) {
      var start = parseInt(rangeMatch[1], 10);
      var end = parseInt(rangeMatch[2], 10);
      for (var s = start; s <= end; s++) sections[s] = true;
      continue;
    }
    var singleMatch = el.match(/^\/(\d+)$/);
    if (singleMatch) {
      sections[parseInt(singleMatch[1], 10)] = true;
    }
  }
  
  var result = [];
  for (var key in sections) {
    result.push(parseInt(key, 10));
  }
  return result.sort(function(a, b) { return a - b; });
}
