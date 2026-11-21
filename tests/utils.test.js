const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CSV_HEADER,
  generateId,
  parseLocalDate,
  todayLocalIso,
  escapeCsvValue,
  parseCsv,
  parseVisits,
  personKey,
} = require('../utils.js');

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

test('parseLocalDate keeps the calendar day in every time zone', () => {
  const date = parseLocalDate('2026-11-21');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 10);
  assert.equal(date.getDate(), 21);
});

test('parseLocalDate handles empty and invalid input', () => {
  assert.equal(parseLocalDate(''), null);
  assert.equal(parseLocalDate(undefined), null);
  assert.equal(parseLocalDate('not a date'), null);
});

test('todayLocalIso uses local date parts', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(todayLocalIso(), expected);
});

test('escapeCsvValue quotes only when needed', () => {
  assert.equal(escapeCsvValue('plain'), 'plain');
  assert.equal(escapeCsvValue('a,b'), '"a,b"');
  assert.equal(escapeCsvValue('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvValue('line1\nline2'), '"line1\nline2"');
  assert.equal(escapeCsvValue(null), '');
  assert.equal(escapeCsvValue(0), '0');
});

test('parseCsv round-trips commas, quotes and line breaks', () => {
  const rows = [
    ['name', 'notes'],
    ['Dave, Jr.', 'multi\nline "quoted", text'],
    ['Eve', ''],
  ];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});

test('parseCsv handles LF and CRLF endings and skips blank lines', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n\n3,4\n'), [['a', 'b'], ['1', '2'], ['3', '4']]);
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('parseVisits reads the JSON format', () => {
  const visits = [{ date: '2026-11-20', notes: 'Talked, a lot | really', location: '12 Main St' }, { date: '2026-11-01', notes: 'first' }];
  assert.deepEqual(parseVisits(JSON.stringify(visits)), visits);
});

test('parseVisits reads the legacy " || " format', () => {
  assert.deepEqual(parseVisits('date:2026-11-20 | notes:hello | location:12 Main St || date:2026-11-01 | notes:first'), [
    { date: '2026-11-20', notes: 'hello', location: '12 Main St' },
    { date: '2026-11-01', notes: 'first' },
  ]);
});

test('parseVisits ignores empty and junk input', () => {
  assert.deepEqual(parseVisits(''), []);
  assert.deepEqual(parseVisits('[1, null, "x"]'), []);
});

test('a full backup row survives export and import', () => {
  const person = {
    id: 'abc', name: 'Alice', contact: '555-1', notes: 'Met at park, said "hi"\nsecond line', followUp: '2026-11-21',
    location: '1 Elm St, Town', createdAt: 1, updatedAt: 2, visits: [{ date: '2026-11-20', notes: 'ok, sure' }],
  };
  const row = [person.id, person.name, person.contact, person.notes, person.followUp, person.location, person.createdAt, person.updatedAt, JSON.stringify(person.visits)];
  const [header, parsed] = parseCsv(toCsv([CSV_HEADER, row]));
  assert.deepEqual(header, CSV_HEADER);
  assert.equal(parsed[3], person.notes);
  assert.deepEqual(parseVisits(parsed[8]), person.visits);
});

test('personKey ignores case and generateId is unique', () => {
  assert.equal(personKey({ name: 'Bob', contact: 'X', createdAt: 1 }), personKey({ name: 'bob', contact: 'x', createdAt: 1 }));
  assert.notEqual(generateId(), generateId());
});
