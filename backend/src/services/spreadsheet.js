import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { isValidEmail, normalizeEmail } from '../utils/email.js';

export const ACCEPTED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.tsv', '.txt'];

const EMAIL_HEADER_HINTS = [
  'email',
  'e-mail',
  'email address',
  'emailaddress',
  'email_id',
  'emailid',
  'mail',
  'mail id',
  'mailid',
  'recipient',
  'to',
  'work email',
  'personal email',
];

const NAME_HEADER_HINTS = ['name', 'full name', 'fullname', 'first name', 'firstname', 'contact', 'contact name'];

const extensionOf = (filename) => {
  const match = String(filename || '').match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
};

/** Strip BOM, collapse whitespace, keep the author's original casing. */
const cleanHeader = (value, index) => {
  const header = String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return header || `column_${index + 1}`;
};

const cleanCell = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, ' ').trim();
};

/** CSV files in the wild arrive comma, semicolon, tab or pipe delimited. */
function sniffDelimiter(sample) {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim().length) || '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function parseDelimited(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const records = parseCsv(text, {
    delimiter: sniffDelimiter(text.slice(0, 4000)),
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  });
  return records;
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });
}

/**
 * Turn an uploaded buffer into { columns, rows } where every row is a plain
 * object keyed by the detected header names.
 */
export function parseSpreadsheet(buffer, filename) {
  const ext = extensionOf(filename);
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw Object.assign(
      new Error(`Unsupported file type "${ext || 'unknown'}". Upload a .csv, .xls or .xlsx file.`),
      { status: 400 },
    );
  }

  const matrix = ext === '.xls' || ext === '.xlsx' ? parseWorkbook(buffer) : parseDelimited(buffer);

  // Skip leading blank lines some exporters prepend.
  const firstFilled = matrix.findIndex((row) =>
    Array.isArray(row) && row.some((cell) => cleanCell(cell) !== ''),
  );
  if (firstFilled === -1) {
    throw Object.assign(new Error('The file appears to be empty.'), { status: 400 });
  }

  const headerRow = matrix[firstFilled];
  const columns = [];
  const seen = new Map();
  headerRow.forEach((cell, index) => {
    let header = cleanHeader(cell, index);
    if (seen.has(header)) {
      const next = seen.get(header) + 1;
      seen.set(header, next);
      header = `${header}_${next}`;
    } else {
      seen.set(header, 1);
    }
    columns.push(header);
  });

  const rows = [];
  for (let i = firstFilled + 1; i < matrix.length; i += 1) {
    const raw = matrix[i];
    if (!Array.isArray(raw)) continue;
    const row = {};
    let hasValue = false;
    columns.forEach((column, index) => {
      const value = cleanCell(raw[index]);
      row[column] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return { columns, rows, extension: ext };
}

/** Pick the column that holds addresses: header hint first, then content. */
export function detectEmailColumn(columns, rows) {
  const lowered = columns.map((column) => column.toLowerCase());

  for (const hint of EMAIL_HEADER_HINTS) {
    const index = lowered.findIndex((column) => column === hint);
    if (index !== -1) return columns[index];
  }
  for (const hint of EMAIL_HEADER_HINTS) {
    const index = lowered.findIndex((column) => column.includes(hint));
    if (index !== -1) return columns[index];
  }

  // No usable header: score each column by how many cells look like addresses.
  const sample = rows.slice(0, 50);
  let best = null;
  let bestScore = 0;
  for (const column of columns) {
    const hits = sample.filter((row) => isValidEmail(row[column])).length;
    const score = sample.length ? hits / sample.length : 0;
    if (score > bestScore) {
      bestScore = score;
      best = column;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

export function detectNameColumn(columns) {
  const lowered = columns.map((column) => column.toLowerCase());
  for (const hint of NAME_HEADER_HINTS) {
    const index = lowered.findIndex((column) => column === hint);
    if (index !== -1) return columns[index];
  }
  for (const hint of NAME_HEADER_HINTS) {
    const index = lowered.findIndex((column) => column.includes(hint));
    if (index !== -1) return columns[index];
  }
  return null;
}

/**
 * Validate + dedupe rows into contact candidates.
 * Returns { contacts, invalid, duplicates } so the UI can report exactly what
 * happened to every row of the upload.
 */
export function buildContacts(rows, columns, emailColumn, nameColumn) {
  const contacts = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for zero-index, +1 for the header row
    const email = normalizeEmail(row[emailColumn]);

    if (!email) {
      invalid.push({ rowNumber, value: '', reason: 'missing email' });
      return;
    }
    if (!isValidEmail(email)) {
      invalid.push({ rowNumber, value: email, reason: 'invalid format' });
      return;
    }
    if (seen.has(email)) {
      duplicates.push({ rowNumber, value: email, reason: 'duplicate in file' });
      return;
    }
    seen.add(email);

    const data = {};
    columns.forEach((column) => {
      data[column] = row[column] ?? '';
    });

    contacts.push({
      email,
      name: nameColumn ? row[nameColumn] || '' : '',
      data,
      rowNumber,
    });
  });

  return { contacts, invalid, duplicates };
}

export default { parseSpreadsheet, detectEmailColumn, detectNameColumn, buildContacts, ACCEPTED_EXTENSIONS };
