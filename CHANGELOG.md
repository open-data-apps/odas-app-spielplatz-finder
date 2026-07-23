# Changelog

## 1.3.0 - 2026-07-23

- **ENH:** Datenabruf auf den Schalter `proxyAktiv` umgestellt; direkte Abrufe sind der Standard, der ODAS-Proxy wird nur noch bei `ja` verwendet
- **ENH:** Einfachen Standalone-Betrieb hinter Traefik mit derselben `odas-config/config.json` wie in der Entwicklung ergänzt
- **ENH:** Traefik-Anbindung auf das externe Netzwerk `proxynet`, den EntryPoint `websecure` und den Zertifikatsresolver `letsencrypt` festgelegt
- **FIX:** Proxy-Basispfad funktioniert jetzt auch bei URLs mit `index.html`; der Ziel-Pfad wird URL-kodiert
- **FIX:** Raten-Schleife über Proxy-Kandidaten durch den eindeutigen Schalter ersetzt
- **DOC:** Start über `STANDALONE=true make up` dokumentiert

## 1.1.0 - 2026-04-16

- App-Logik auf Spielplatz-Finder fokussiert und Metadaten entsprechend aktualisiert.
- Datenabruf auf lokalen Proxy (`/odp-data?path=...`) umgestellt, inklusive URL-Encoding und Fallback auf allorigins.
- CSV-Parsing robust gemacht (quote-sicher, Delimiter-Erkennung fuer `;` und `,`, Escaped-Quotes).
- Neues ODAS-App-Icon (`assets/odas-app-icon.svg`) mit Spielplatzmotiv integriert.
- `app-package.json`, `CHANGELOG.md` und `Makefile` auf neuen Funktionsstand abgestimmt.
