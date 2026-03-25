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

// ─── apply_to ────────────────────────────────────────────────────────────────

function isValidApplyTo(value) {
  var v = value.trim();
  if (v === 'All' || v === 'all') return true;
  if (/^ม\.[1-6]$/.test(v)) return true;
  var parts = v.split(',').map(function(p) { return p.trim(); });
  return parts.every(function(p) { return /^ม\.[1-6]$/.test(p); });
}
