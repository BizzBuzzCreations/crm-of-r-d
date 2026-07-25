'use strict';
// Mirrors a Todo into the shared "Assignment tracker" Google Sheet, into the
// specific tab the todo's owner is mapped to (User.assignmentSheetTab).
// One-way sync: CRM -> Sheet only. Never blocks or fails the actual Todo
// CRUD request — every call site wraps this in a fire-and-forget with its
// own try/catch, and every function in here already swallows its own errors
// down to a console.warn/error, so a Sheets outage or bad credentials never
// takes the CRM down with it.
//
// Row tracking uses Sheets API Developer Metadata (an invisible, per-row tag
// holding the Todo's Mongo _id) rather than a visible helper column — so a
// second save on the same todo updates the row it already created instead
// of appending a duplicate, without disturbing the sheet's existing layout.
//
// Columns are resolved by matching the literal header text ("Subject",
// "Assignment", "Status", "Start date", "Due on", "Additional Details") in
// whichever row actually contains them, not by assuming fixed column
// letters — the sheet's exact column layout was never fully certain from a
// screenshot, and hardcoding letters would silently write into the wrong
// column the moment a real column position differs from what was guessed.
const User = require('../models/User');
const { getSheetsClient, isConfigured } = require('./googleSheetsClient');

// pending -> Not started, in-progress/sent-for-approval -> In progress
// (sent-for-approval has no direct sheet equivalent, closest honest match),
// completed -> Done. "Skipped" is sheet-only, a human sets it manually; the
// sync never writes it (see the Skipped guard below for why an existing
// "Skipped" row is left untouched entirely).
const STATUS_MAP = {
  pending: 'Not started',
  'in-progress': 'In progress',
  'sent-for-approval': 'In progress',
  completed: 'Done',
};

const COLUMN_ALIASES = {
  subject:    ['subject'],
  assignment: ['assignment'],
  status:     ['status'],
  startDate:  ['start date'],
  dueDate:    ['due on', 'due date'],
  details:    ['additional details', 'additional detail', 'details'],
};

function colLetter(index) {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Todo.startDate/dueDate are stored as plain "YYYY-MM-DD" strings (native
// <input type="date"> format) — the sheet displays DD/MM/YYYY.
function formatSheetDate(isoDateStr) {
  if (!isoDateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDateStr);
  if (!m) return isoDateStr; // unexpected format — pass through rather than mangling it
  return `${m[3]}/${m[2]}/${m[1]}`;
}

async function resolveSheetId(sheets, spreadsheetId, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const match = (meta.data.sheets || []).find((s) => s.properties.title === tabName);
  return match ? match.properties.sheetId : null;
}

// Header is usually row 3 in the existing sheet, but scanned defensively —
// look for whichever of the first 10 rows actually contains "Subject".
async function findHeaderRow(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'!A1:Z10` });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => String(c).trim().toLowerCase() === 'subject')) {
      return { rowIndex: i, headerRow: rows[i] }; // 0-based
    }
  }
  return null;
}

function mapColumns(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const norm = String(cell).trim().toLowerCase();
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(norm)) map[key] = idx;
    }
  });
  return map;
}

async function findTrackedRow(sheets, spreadsheetId, sheetId, todoId) {
  const res = await sheets.spreadsheets.developerMetadata.search({
    spreadsheetId,
    requestBody: {
      dataFilters: [{
        developerMetadataLookup: { metadataKey: 'todoId', metadataValue: String(todoId), locationType: 'ROW' },
      }],
    },
  });
  const matches = res.data.matchedDeveloperMetadata || [];
  const onThisSheet = matches.find((m) => m.developerMetadata.location?.dimensionRange?.sheetId === sheetId);
  if (!onThisSheet) return null;
  return onThisSheet.developerMetadata.location.dimensionRange.startIndex; // 0-based row index
}

// Counts existing entries in one reliably-filled column (Status) to compute
// the next free row explicitly, rather than trusting values.append's own
// table-boundary detection — see the comment at its call site for why that
// matters here specifically.
//
// The row immediately after the header is always left blank, matching the
// spacer/divider convention other tabs already use (e.g. the black month
// bar under Kushmal's header) — so a first-ever entry on an empty tab
// starts one row lower than the header, not directly beneath it, even on a
// tab that doesn't have that divider formatted in yet.
async function findNextEmptyRow(sheets, spreadsheetId, tabName, headerRowIndex, anchorColIndex) {
  const firstDataRow = headerRowIndex + 3; // 1-based: header row, +1 blank spacer, +1 = first real data row
  const colLetterStr = colLetter(anchorColIndex);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `'${tabName}'!${colLetterStr}${firstDataRow}:${colLetterStr}`,
  });
  const values = res.data.values || [];
  return (firstDataRow - 1) + values.length; // 0-based next free row
}

async function tagRowWithTodoId(sheets, spreadsheetId, sheetId, rowIndex, todoId) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        createDeveloperMetadata: {
          developerMetadata: {
            metadataKey: 'todoId',
            metadataValue: String(todoId),
            location: { dimensionRange: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } },
            visibility: 'DOCUMENT',
          },
        },
      }],
    },
  });
}

// Patches only the mapped cells in an existing row, individually — never
// blindly overwrites the whole row, since a human may have added extra
// notes/formatting in columns this sync doesn't own.
async function patchRow(sheets, spreadsheetId, tabName, rowIndex, cols, values) {
  const rowNum = rowIndex + 1; // 1-based for A1 notation
  const data = [];
  const push = (key, val) => {
    if (cols[key] == null) return;
    data.push({ range: `'${tabName}'!${colLetter(cols[key])}${rowNum}`, values: [[val]] });
  };
  push('subject', values.subject);
  push('assignment', values.assignment);
  push('status', values.status);
  push('startDate', values.startDate);
  push('dueDate', values.dueDate);
  push('details', values.details);
  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });
}

async function syncTodoToSheet(todo) {
  if (!isConfigured()) return;
  try {
    const user = await User.findById(todo.userId).select('position assignmentSheetTab').lean();
    if (!user?.assignmentSheetTab) return; // not mapped to a tab — nothing to do

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_ASSIGNMENT_SHEET_ID;
    const tabName = user.assignmentSheetTab;

    const sheetId = await resolveSheetId(sheets, spreadsheetId, tabName);
    if (sheetId == null) { console.warn(`[AssignmentSheet] Tab "${tabName}" not found in the spreadsheet`); return; }

    const header = await findHeaderRow(sheets, spreadsheetId, tabName);
    if (!header) { console.warn(`[AssignmentSheet] No header row found (looking for "Subject") in tab "${tabName}"`); return; }
    const cols = mapColumns(header.headerRow);

    const values = {
      subject:    user.position || '',
      assignment: todo.title || '',
      status:     STATUS_MAP[todo.status] || 'Not started',
      startDate:  formatSheetDate(todo.startDate),
      dueDate:    formatSheetDate(todo.dueDate),
      details:    todo.description || '',
    };

    const trackedRow = await findTrackedRow(sheets, spreadsheetId, sheetId, todo._id);

    if (trackedRow != null) {
      // Existing row — a human may have manually set Status to "Skipped" as
      // an override (no CRM equivalent, sheet-only). Once that's set, never
      // touch this row again regardless of what the CRM's status becomes.
      if (cols.status != null) {
        const cell = await sheets.spreadsheets.values.get({
          spreadsheetId, range: `'${tabName}'!${colLetter(cols.status)}${trackedRow + 1}`,
        });
        const current = String(cell.data.values?.[0]?.[0] || '').trim().toLowerCase();
        if (current === 'skipped') return;
      }
      await patchRow(sheets, spreadsheetId, tabName, trackedRow, cols, values);
      return;
    }

    // No tracked row yet. Deliberately NOT using values.append here — it
    // tries to auto-detect which column the "real" table starts at based on
    // existing data, and since column A is always left blank (a spacer,
    // never written to), it can decide the table actually starts at column
    // B and silently shift the whole row one column right on the second+
    // append. values.update has no such heuristic: it writes exactly the
    // range you give it, so the target row is computed explicitly instead.
    const knownCols = Object.values(cols).filter((v) => v != null);
    if (!knownCols.length) return;
    const maxCol = Math.max(...knownCols);
    const anchorCol = cols.status ?? knownCols[0]; // any consistently-filled column works as the "how many rows used" probe
    const nextRowIndex = await findNextEmptyRow(sheets, spreadsheetId, tabName, header.rowIndex, anchorCol);

    const rowArray = new Array(maxCol + 1).fill('');
    if (cols.subject != null)    rowArray[cols.subject]    = values.subject;
    if (cols.assignment != null) rowArray[cols.assignment] = values.assignment;
    if (cols.status != null)     rowArray[cols.status]     = values.status;
    if (cols.startDate != null)  rowArray[cols.startDate]  = values.startDate;
    if (cols.dueDate != null)    rowArray[cols.dueDate]    = values.dueDate;
    if (cols.details != null)    rowArray[cols.details]    = values.details;

    const rowNum = nextRowIndex + 1; // 1-based for A1 notation
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${rowNum}:${colLetter(maxCol)}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowArray] },
    });
    await tagRowWithTodoId(sheets, spreadsheetId, sheetId, nextRowIndex, todo._id);
  } catch (err) {
    console.error('[AssignmentSheet] sync failed:', err.message);
  }
}

// Removes a todo's row from the sheet entirely (real row deletion, not just
// clearing the cells) when it's deleted in the CRM. Developer Metadata is
// anchored to the row itself, not a fixed index — Sheets re-flows every
// other row's metadata automatically when a row above it is deleted via the
// API, the same way a cell comment stays attached to its cell after an
// insert/delete elsewhere on the sheet. That's precisely why row tracking
// uses Developer Metadata instead of a hardcoded row number: this deletion
// would otherwise desync every other already-synced todo's tracked row.
async function deleteTodoFromSheet(todo) {
  if (!isConfigured()) return;
  try {
    const user = await User.findById(todo.userId).select('assignmentSheetTab').lean();
    if (!user?.assignmentSheetTab) return;

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_ASSIGNMENT_SHEET_ID;
    const tabName = user.assignmentSheetTab;

    const sheetId = await resolveSheetId(sheets, spreadsheetId, tabName);
    if (sheetId == null) return;

    const trackedRow = await findTrackedRow(sheets, spreadsheetId, sheetId, todo._id);
    if (trackedRow == null) return; // never synced (or already removed) — nothing to delete

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: trackedRow, endIndex: trackedRow + 1 },
          },
        }],
      },
    });
  } catch (err) {
    console.error('[AssignmentSheet] delete sync failed:', err.message);
  }
}

module.exports = { syncTodoToSheet, deleteTodoFromSheet, STATUS_MAP, formatSheetDate };
