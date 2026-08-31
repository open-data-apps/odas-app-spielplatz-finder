# Changelog

## 1.30.0 - 2026-09-01
- **FIX:** 14 Container-IDs ohne Uid gescoped (`sp-search`, `sp-ortsteil`, `sp-art`, `sp-map`, `sp-map-status`, `sp-count`, `sp-data-spinner`, `sp-tbody`, `sp-page-info`, `sp-prev`/`next`, `sp-datenstand-wrap`, `sp-methodik-wrap`, `sp-weitere-infos-wrap` → `-${spUid}`/`-${uid}`) — `probe --all` jetzt `0 sonstige Duplikate` statt `HINWEIS 14` (F-71-Rest, gelb → grün).

## 1.29.0 - 2026-09-01
- **FIX:** B3-Datenschutz auf `proxyAktiv: ja` korrigiert (`über den ODAS-Proxy geladen`) in `app-package.json`/`odas-config/config.json` — `doku-check` B3 grün.

## 1.28.0 - 2026-08-27
- **CHG:** `proxyAktiv` Default auf `ja` (www.berlin.de ohne CORS, Live-Audit 2026-08-27: ja ✅138 / nein ❌Failed to fetch).

## 1.27.0 - 2026-08-25
- **CHG:** `proxyAktiv`-Schalter wiedereingeführt (Default `nein`). Der ODAS-Proxy erlaubt seit Plattform-Update 2026-08-24 Datenabrufe für jede in den `apiurls` konfigurierte Quelle-Origin.


## 1.26.0 - 2026-08-25
- **CHG:** Proxy-Aufruf sendet die vollständige Ziel-URL statt nur Pfad+Query, damit die neue Origin-Allowlist-Prüfung der ODAS-Plattform greift (bisher implizite Auflösung gegen den ersten konfigurierten `apiurl`).
- **FIX:** Tote Anbieter-Shortcodes in Kontakt/Impressum ersetzt (`{{odp.anbieter.url-extern}}` → `{{odp.anbieter.url}}`, `tel:{{odp.anbieter.telcode}}` → `tel:{{odp.anbieter.tel}}`).


## 1.25.0 - 2026-08-22
- **CHG:** `version` in `app-package.json` zu `app-version` umbenannt.
- **ENH:** Top-Level-Feld `app-package-version` ergänzt (Wert `"2"`: mehrere benannte API-URLs über `instanz-config.apiurls`).

## 1.24.0 - 2026-08-21
- **CHG:** Skalares `apiurl` durch das Array-Feld `apiurls` ersetzt (`typ: "array"`, Eintrag `spielplaetze`). Neuer Standard portfolioweit; `apiurl` entfällt. `app.js` liest die Datenquelle jetzt über `getOdasApiUrl(configdata, "spielplaetze")`.

## 1.23.0 - 2026-08-20
- Markdown-Metadaten: Paketbeschreibungen auf echtes Markdown umgestellt, exakte Identität Top-Level/Instanz hergestellt, lokale HTML-Fixture semantisch gespiegelt.

## 1.22.0 - 2026-08-20
- FIX: Dispose-/Race-Guard ergänzt — bislang fehlte jeglicher Schutz gegen überholte asynchrone Fortsetzungen (F-70)

## 1.21.0 - 2026-08-18
- `proxyAktiv`-Schalter entfernt (`app-package.json`, `odas-config/config.json`): Der ODAS-Proxy wird umgebaut und funktioniert nach der aktuellen Host-Regel nicht mit `www.berlin.de`; das Feld wird bis zum Abschluss des Umbaus bewusst nicht angeboten. Die App lief bereits im Direktmodus (`proxyAktiv: "nein"`), das Verhalten ändert sich nicht.

## 1.20.0 - 2026-08-17
- `fetchOdasJson()` wirft jetzt bei nicht-JSON-Antworten (CSV, HTML, leerer Body) eine sprechende Konfigurationsfehlermeldung statt der rohen `JSON.parse`-Parserfehlermeldung (F-66)
- `urlDaten` zeigte auf einen nicht mehr existierenden Host (`offenedaten.esslingen.de`/`open-data-esslingen.de`, NXDOMAIN) bzw. auf den Platzhalter `.../testdaten` (HTTP 404) — jetzt auf die reale Datensatz-Landingpage der tatsächlich konfigurierten `apiurl`-Quelle verweisend, live per HTTP-Abruf verifiziert (F-67)

## 1.19.0 - 2026-08-17
- **CHG:** `instanz-config`-`category`-Vokabular auf Deutsch umgestellt (`allgemein`, `beschreibung`, `datenherkunft`, `kontakt-rechtliches`, `sonstiges`); die entfallenen Kategorien `metrics` und `advanced` wurden auf `beschreibung` bzw. `sonstiges` verteilt

## 1.18.0 - 2026-08-12
- FIX: `app/index.html` auf den Template-Stand (F-47): Datei byte-gleich aus `oda-generic` übernommen — gültiges HTML, deutsche ARIA-Labels, Footer im Body; Titel und Fußzeile bleiben Platzhalter und werden zur Laufzeit aus der Instanz-Config überschrieben

## 1.17.0 - 2026-08-12
- FIX: Laufzeitressourcen einer Leaflet-Instanz werden beim Seitenwechsel freigegeben (F-51): neue Registry `spTeardowns` (Container -> Teardown-Callback) mit Modul-Hook `onPageLeave`; `initApp()` registriert die Abbaufunktion der Karte mit dem App-Container als Schluessel, sodass beim Verlassen der Seite keine Leaflet-Instanz samt Resize-Handlern zurueckbleibt

## 1.16.0 - 2026-08-11
- FIX: XSS- und URL-Vertrag geschlossen; Nominatim offengelegt (F-35, F-36)

## 1.15.0 - 2026-08-07
- FIX: Bootstrap-Ziele instanzeindeutig machen (F-32): `data-bs-target`, `aria-controls` und die div-IDs der Methodik-Box (`sp-methodik-body`) und der Box „Weitere Informationen" (`sp-weitere-infos-body`) werden pro App-Instanz mit einer UID versehen (`sp-methodik-body-i1`, `-i2`, …), damit mehrere Instanzen der App auf einer Seite nicht kollidieren
- FIX: Leaflet-Karte wird über den App-Container statt über die dokumentweite ID gesucht (`L.map(container.querySelector("#sp-map"))`), damit bei mehreren Instanzen jede Instanz ihre eigene Karte initialisiert

## 1.14.0 - 2026-08-06
- CHG: DOM-Zugriffe auf den App-Container gescopt (F-25, Tranche 3): alle Elemente der App werden über den App-Container (container.querySelector) angesprochen statt über document; unpräfixierte ID `data-spinner` mit `sp-`-Präfix versehen (`data-spinner` → `sp-data-spinner`); die Helper-`forEach`-Schleifen über `sp-search`/`sp-ortsteil`/`sp-art` bzw. `sp-barrierefrei`/`sp-ballspielen` scopen ihre Zugriffe an jeweils einer Stelle

## 1.13.0 - 2026-08-06
- FIX: Datenschutzangabe beschreibt den tatsaechlichen Stand nach dem Vendoring (Welle G)

## 1.12.0 - 2026-08-06
- FIX: Drittanbietersektion nennt keine Beim-Aufruf-Behauptung mehr (Welle G)

## 1.11.0 - 2026-08-06
- FIX: Base auf Template oda-generic 1.6.0 vereinheitlicht (Hook renderPageOverride)

## 1.10.0 - 2026-08-04
- FIX: Datenschutzhinweis "Beim Aufruf kontaktierte Drittanbieter" an das Vendoring angepasst — jetzt lokal ausgelieferte Bibliotheken (Bootstrap/Leaflet/Chart.js) sind aus der Liste entfernt, weiterhin extern geladene Dienste (Kartenkacheln, Zusatzbibliotheken) bleiben genannt

## 1.9.0 - 2026-08-04
- FIX: Bootstrap, Leaflet vendored in `app/vendor/` statt von CDN geladen (F-07 Teil 2) — Standalone-Betrieb laedt diese Bibliotheken nicht mehr extern

## 1.8.0 - 2026-08-04
- FIX: Drittanbieter (CDN, Kartendienste) in `datenschutz`-Default und README dokumentiert (F-07 Teil 1)
- FIX: Bootstrap CSS/JS auf einheitlich 5.3.8 gezogen (vorher gemischt 5.3.0/5.3.1 bzw. 5.3.0/5.3.0) (F-31)

## 1.7.0 - 2026-07-31
- CHG: Platzhalter-Titel in der lokalen Konfiguration durch den echten App-Titel ersetzt

## 1.6.0 - 2026-07-31
- FIX: Quelldaten und string-Config-Werte werden vor der HTML-Ausgabe maskiert (F-08)
- CHG: toter Konfigurationsschlüssel lizenz entfernt (F-17)
- CHG: brandingCSS und brandingCSSFile als Base-Abhängigkeiten deklariert und lokal gespiegelt (F-17)
- CHG: format.typ von "String" auf v1-sicheres "string" korrigiert (F-18)
- CHG: dropdown-Default auf Feldebene verschoben statt in format (F-18)
- CHG: daten.schema auf assets/schema.json gesetzt (F-20)

## 1.5.0 - 2026-07-30

- **FIX:** Laufzeitfehler nach dem Laden der Konfiguration werden jetzt sichtbar gemeldet; `handleRouting()` wird `await`et und besitzt einen Fehlerpfad. Bisher blieb die Seite bei einem Fehler im Seitenaufbau stumm leer
- **FIX:** `getConfigUrl()` schneidet bei einer URL ohne abschliessenden Schraegstrich nicht mehr das letzte Verzeichnis ab; die Konfiguration wird auch unter `.../app` gefunden
- **FIX:** Klick auf einen Hash-Link, der bereits die aktive Seite bezeichnet, rendert die Seite neu (`setupSamePageLinks()`) - das Logo fuehrt damit aus Unteransichten zurueck zur Startseite
- **ENH:** `app/app-base.js` ist wieder byte-identisch zum Template `oda-generic` 1.4.0; app-spezifisches Aufraeumen laeuft ueber den neuen Hook `onPageLeave(page)` in `app/app.js`
- **FIX:** Der Pfad zur Branding-CSS wird jetzt relativ zum App-Verzeichnis aufgeloest (`../assets/branding.css`); bisher wurde die Datei beim lokalen Test unterhalb von `app/` gesucht und deshalb nicht gefunden

## 1.4.0 - 2026-07-24

- **FIX:** Laufzeit-Fehlermeldung wird vor der Anzeige HTML-maskiert (`escapeHtmlForBase`); ein Fehlertext kann kein Markup mehr in die Seite einschleusen (XSS)
- **FIX:** Startseiten-Renderer wird nun `await`et; bei asynchronen Apps erscheint kein kurzzeitiges `[object Promise]` in `#main-content`

## 1.3.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Raten-Schleife über Proxy-Kandidaten durch den eindeutigen Schalter ersetzt
- **FIX:** Liefer-ZIP enthält nur noch `app/`, `assets/`, `app-package.json` und `CHANGELOG.md`; `odas-config/`, `README.md` und `Makefile` sind lokal und gehören nicht in die Auslieferung
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## 1.1.0 - 2026-04-16

- App-Logik auf Spielplatz-Finder fokussiert und Metadaten entsprechend aktualisiert.
- Datenabruf auf lokalen Proxy (`/odp-data?path=...`) umgestellt, inklusive URL-Encoding und Fallback auf allorigins.
- CSV-Parsing robust gemacht (quote-sicher, Delimiter-Erkennung fuer `;` und `,`, Escaped-Quotes).
- Neues ODAS-App-Icon (`assets/odas-app-icon.svg`) mit Spielplatzmotiv integriert.
- `app-package.json`, `CHANGELOG.md` und `Makefile` auf neuen Funktionsstand abgestimmt.
