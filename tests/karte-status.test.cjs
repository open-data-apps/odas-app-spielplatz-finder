const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/app.js'), 'utf8'), app);

test('Kartenmeldung bei null Treffern nennt keine fehlenden Koordinaten (Live-Befund 27.10.2026)', () => {
  assert.equal(app.spKartenStatusText(0, 0, 0), 'Keine Spielplätze für diese Auswahl.');
});

test('Kartenmeldung mit Treffern bleibt wie bisher', () => {
  assert.equal(app.spKartenStatusText(3, 3, 0), '3 Marker auf Karte');
  assert.equal(app.spKartenStatusText(5, 2, 3), '2 Marker auf Karte · 3 Adresse(n) werden ermittelt …');
  assert.equal(app.spKartenStatusText(5, 0, 2), 'Noch keine Koordinaten vorhanden · 2 Adresse(n) werden ermittelt …');
  assert.equal(app.spKartenStatusText(5, 0, 0), 'Für diese Auswahl konnten keine Koordinaten ermittelt werden.');
});
