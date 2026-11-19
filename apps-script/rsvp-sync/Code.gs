/**
 * Automatic Google Form RSVP -> profiles synchronisation.
 * Install in the spreadsheet receiving Google Form responses.
 * Configure SETTINGS, run installFormSubmitTrigger() once, then new
 * submissions are processed automatically.
 */
const SETTINGS = {
  // Blank means profiles tab is in the Form response spreadsheet.
  DESTINATION_SPREADSHEET_ID: "",
  DESTINATION_SHEET_NAME: "profiles",
  REQUIRE_YES_ATTENDANCE: true,
  ATTENDANCE_HEADER: "Will you attend the Alumni Meet?",
  YES_VALUES: ["Yes", "Yes, I will attend", "Yes, I will attend the Alumni Meet"],
  NEW_PROFILE_STATUS: "pending",
  HEADERS: {
    timestamp: "Timestamp",
    email: "Email Address",
    name: "Full Name",
    year: "Graduation Year",
    branch: "Degree and Branch / Department",
    designation: "Designation / Role",
    company: "Current Company / Organization",
    guide: "How would you like to engage with the alumni community?",
    linkedin: "LinkedIn Profile",
    photo: "Profile Photo",
    attendance: "Will you attend the Alumni Meet?"
  }
};

// Run once manually. Re-running replaces this script's previous trigger.
function installFormSubmitTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "handleFormSubmit") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("handleFormSubmit").forSpreadsheet(ss).onFormSubmit().create();
  Logger.log("Automatic RSVP trigger installed for " + ss.getName());
}

function removeFormSubmitTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "handleFormSubmit") ScriptApp.deleteTrigger(t);
  });
}

function handleFormSubmit(e) {
  if (!e || !e.range) throw new Error("Run this via the spreadsheet form-submit trigger.");
  syncResponseRow_(e.range.getSheet(), e.range.getRow());
}

// Optional one-time import of responses already in the Form response sheet.
// Safe to rerun: matching email rows are updated, not duplicated.
function importExistingResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = findResponseSheet_(ss);
  if (!source) throw new Error("Could not find a response tab with configured name and email headers.");
  for (let row = 2; row <= source.getLastRow(); row++) syncResponseRow_(source, row);
  Logger.log("Existing response import complete.");
}

function syncResponseRow_(sourceSheet, rowNumber) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const lastCol = sourceSheet.getLastColumn();
    const headers = sourceSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(String);
    const values = sourceSheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
    const shown = sourceSheet.getRange(rowNumber, 1, 1, lastCol).getDisplayValues()[0];
    const h = SETTINGS.HEADERS;

    function indexFor(label, optional) {
      const target = normalize_(label);
      let i = headers.findIndex(x => normalize_(x) === target);
      if (i < 0) i = headers.findIndex(x => normalize_(x).startsWith(target));
      if (i < 0 && !optional) throw new Error('Required Form column not found: "' + label + '"');
      return i;
    }
    function val(label, optional) {
      if (!label) return "";
      const i = indexFor(label, optional);
      return i < 0 ? "" : (values[i] == null ? "" : values[i]);
    }
    function display(label, optional) {
      if (!label) return "";
      const i = indexFor(label, optional);
      return i < 0 ? "" : (shown[i] || "");
    }

    const name = String(val(h.name, false)).trim();
    const email = String(val(h.email, false)).trim().toLowerCase();
    if (!name || !email) throw new Error("A response is missing its name or email. Row " + rowNumber);

    if (SETTINGS.REQUIRE_YES_ATTENDANCE) {
      const answer = String(val(h.attendance || SETTINGS.ATTENDANCE_HEADER, false)).trim().toLowerCase();
      const yes = SETTINGS.YES_VALUES.map(x => String(x).trim().toLowerCase());
      if (yes.indexOf(answer) < 0) {
        Logger.log("Skipped non-YES response: " + name + " (" + answer + ")");
        return;
      }
    }

    const designation = String(val(h.designation, true) || "").trim();
    const company = String(val(h.company, true) || "").trim();
    const profile = {
      timestamp: val(h.timestamp, false) || display(h.timestamp, false),
      email: email,
      name: name,
      year: val(h.year, true),
      branch: val(h.branch, true),
      role: designation && company ? designation + " at " + company : (designation || company),
      guide: val(h.guide, true),
      linkedin: val(h.linkedin, true),
      photo: val(h.photo, true)
    };

    const dest = SETTINGS.DESTINATION_SPREADSHEET_ID
      ? SpreadsheetApp.openById(SETTINGS.DESTINATION_SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
    let sheet = dest.getSheetByName(SETTINGS.DESTINATION_SHEET_NAME);
    if (!sheet) sheet = dest.insertSheet(SETTINGS.DESTINATION_SHEET_NAME);

    ensureHeaders_(sheet, ["timestamp","status","email","name","year","branch","role","want","experience","guide","linkedin","photo"]);
    const last = sheet.getLastColumn();
    const destHeaders = sheet.getRange(1, 1, 1, last).getDisplayValues()[0].map(x => String(x).trim());
    const emailCol = destHeaders.findIndex(x => normalize_(x) === "email") + 1;
    const statusCol = destHeaders.findIndex(x => normalize_(x) === "status") + 1;

    let targetRow = 0;
    const destLastRow = sheet.getLastRow();
    if (destLastRow >= 2) {
      const emails = sheet.getRange(2, emailCol, destLastRow - 1, 1).getDisplayValues()
        .flat().map(x => String(x).trim().toLowerCase());
      const found = emails.indexOf(email);
      if (found >= 0) targetRow = found + 2;
    }
    const isNew = !targetRow;
    if (isNew) targetRow = Math.max(2, destLastRow + 1);

    const row = isNew ? new Array(last).fill("") : sheet.getRange(targetRow, 1, 1, last).getValues()[0];
    const mapped = profile;
    destHeaders.forEach(function (header, i) {
      const key = normalize_(header);
      if (Object.prototype.hasOwnProperty.call(mapped, key)) row[i] = mapped[key];
    });
    if (isNew) row[statusCol - 1] = SETTINGS.NEW_PROFILE_STATUS;
    sheet.getRange(targetRow, 1, 1, last).setValues([row]);
    Logger.log((isNew ? "Added" : "Updated") + " RSVP profile: " + name);
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaders_(sheet, required) {
  if (sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, required.length).setValues([required]);
    return;
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(x => normalize_(x));
  const missing = required.filter(x => headers.indexOf(normalize_(x)) < 0);
  if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
}

function findResponseSheet_(ss) {
  const h = SETTINGS.HEADERS;
  return ss.getSheets().find(function (sheet) {
    const n = sheet.getLastColumn();
    if (n < 2) return false;
    const headers = sheet.getRange(1, 1, 1, n).getDisplayValues()[0].map(normalize_);
    return headers.indexOf(normalize_(h.name)) >= 0 && headers.indexOf(normalize_(h.email)) >= 0;
  }) || null;
}

function normalize_(x) {
  return String(x == null ? "" : x).toLowerCase().replace(/[^a-z0-9]/g, "");
}
