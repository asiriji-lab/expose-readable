// ─── Code.gs (Web App) ───────────────────────────────────────────────────────
// Deployed as Web App (Execute as: Me, Access: Anyone).
// Handles only two responsibilities:
//   1. Copy template spreadsheet for a new user (doPost without action)
//   2. Read a spreadsheet's data on behalf of the frontend (doPost action=read_sheet)
// All validation logic lives in appscript/lib/ (SchedoolLib).
// All in-sheet tooling lives in appscript/template/ (template-bound script).
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.action === 'read_sheet') {
      return _handleReadSheet(body.spreadsheetId);
    }

    var userEmail = body.userEmail || body.email;
    var title = body.title || 'Schedool Workspace';

    if (!userEmail) {
      return _jsonResponse({ success: false, error: 'userEmail is required' });
    }

    var templateId = PropertiesService.getScriptProperties().getProperty('TEMPLATE_ID')
      || '14hgR1XI-RgqPjc6pKhfdPxR7DbX8Gejrbl4P68PrOgE';

    var template = DriveApp.getFileById(templateId);
    var copy = _withRetry(function() {
      return template.makeCopy(title, DriveApp.getRootFolder());
    });

    _withRetry(function() { copy.addEditor(userEmail); });
    _withRetry(function() { copy.addEditor('sheet-bot@absolute-runner-331411.iam.gserviceaccount.com'); });
    _withRetry(function() { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); });

    var spreadsheetId = copy.getId();
    var spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';

    return _jsonResponse({
      success: true,
      spreadsheetId: spreadsheetId,
      url: spreadsheetUrl,
    });

  } catch (err) {
    return _jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  return _jsonResponse({ status: 'ok', message: 'Schedool GAS Web App is running.' });
}

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _withRetry(fn, maxAttempts) {
  maxAttempts = maxAttempts || 3;
  for (var i = 0; i < maxAttempts; i++) {
    try {
      return fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      Utilities.sleep((Math.pow(2, i) * 1000) + Math.floor(Math.random() * 500));
    }
  }
}

function _handleReadSheet(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheets = ss.getSheets();
    var result = {};
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();
      var data = sheet.getDataRange().getValues();
      result[name] = data;
    }
    return _jsonResponse({ success: true, data: result });
  } catch (err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}
