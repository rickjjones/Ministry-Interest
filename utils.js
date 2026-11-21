// Pure helpers with no DOM access. Loaded before app.js in the browser
// and required directly by the Node unit tests in tests/.

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Date inputs produce "YYYY-MM-DD". `new Date("YYYY-MM-DD")` parses that as UTC
// midnight, which shows as the previous day west of UTC, so build a local date instead.
function parseLocalDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(value) {
  const date = parseLocalDate(value);
  if (!date) return value || '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const CSV_HEADER = ['id', 'name', 'contact', 'notes', 'followUp', 'location', 'createdAt', 'updatedAt', 'visits'];

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// RFC 4180 parser: handles quoted fields containing commas, quotes and line breaks.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

// Visits are exported as JSON. Older backups used "date:… | notes:… | location:…" joined by " || ".
function parseVisits(value) {
  if (!value) return [];
  const trimmed = value.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((visit) => visit && typeof visit === 'object')
          .map((visit) => {
            const clean = { date: String(visit.date || ''), notes: String(visit.notes || '') };
            if (visit.location) clean.location = String(visit.location);
            return clean;
          });
      }
    } catch (error) {
      console.warn('Could not parse visits JSON, trying legacy format:', error);
    }
  }

  return trimmed.split(' || ').map((chunk) => {
    const visit = { date: '', notes: '' };
    chunk.split(' | ').forEach((part) => {
      const match = /^(date|notes|location):([\s\S]*)$/.exec(part);
      if (match) visit[match[1]] = match[2];
    });
    return visit;
  }).filter((visit) => visit.date || visit.notes || visit.location);
}

function personKey(person) {
  return `${person.name}|${person.contact}|${person.createdAt}`.toLowerCase();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CSV_HEADER,
    generateId,
    parseLocalDate,
    formatLocalDate,
    todayLocalIso,
    escapeCsvValue,
    parseCsv,
    parseVisits,
    personKey,
  };
}
