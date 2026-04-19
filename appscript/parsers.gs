// ─── parsers.gs ──────────────────────────────────────────────────────────────
// Ported from: app/(admin)/validators/utils/parsers.ts
// Keep in sync with the TypeScript version.
// ─────────────────────────────────────────────────────────────────────────────

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
 *
 * A marker row is identified as a row where:
 *   - Only the first cell has content (all other cells are empty), AND
 *   - The first cell does not look like a normal data value (it is a grade header
 *     like ม.1–ม.6, or a text label ending with ":").
 *
 * Extend this function as needed for additional marker conventions.
 */
function isMarkerRow(row) {
  if (!row || row.length === 0) return false;
  var first = _str(row[0]);
  if (!first) return false;

  // All non-first cells must be empty for this to be a marker row
  var restEmpty = true;
  for (var i = 1; i < row.length; i++) {
    if (_str(row[i])) { restEmpty = false; break; }
  }
  if (!restEmpty) return false;

  // Grade-header style: ม.1 – ม.6
  if (isGradeHeader(first)) return true;

  // Label ending with colon convention: e.g. "กลุ่มสาระ:"
  if (/:\s*$/.test(first)) return true;

  return false;
}

// ─── apply_to ────────────────────────────────────────────────────────────────

function isValidApplyTo(value) {
  var v = value.trim();
  if (v === 'All' || v === 'all') return true;
  if (/^ม\.[1-6]$/.test(v)) return true;
  var parts = v.split(',').map(function(p) { return p.trim(); });
  return parts.every(function(p) { return /^ม\.[1-6]$/.test(p); });
}
