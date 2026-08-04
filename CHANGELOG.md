# Changelog

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
