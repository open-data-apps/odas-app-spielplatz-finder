const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8'), app);
for (const newline of ['\n', '\r\n']) {
  test('F-135 Spielplatz-CSV: Feldgrenzen bei Quotes und ' + JSON.stringify(newline), () => {
    const rows = app.parseCSV('name;ortsteil;lat;lon;oeffnungszeiten' + newline +
      '"Spiel; Platz ""A""";West;52.43;13.32;"Mo' + newline + 'Di"');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Spiel; Platz "A"');
    assert.equal(rows[0].ortsteil, 'West');
    assert.equal(rows[0].lat, '52.43');
    assert.equal(rows[0].lon, '13.32');
    assert.equal(rows[0].oeffnungszeiten, 'Mo' + newline + 'Di');
  });
}
test('F-135 offene Quotes werden sichtbar abgelehnt', () => {
  assert.throws(() => app.parseCSV('name;lat;lon\n"Offen;52.43;13.32'), /CSV|Anführungszeichen/);
});
