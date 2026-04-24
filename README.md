# Spielplätze – App für den Open Data App-Store (ODAS)

Interaktive Visualisierung von Spielplatzdaten für den [Open Data App Store](https://open-data-app-store.de/). Entspricht der [Open Data App-Spezifikation](https://open-data-apps.github.io/open-data-app-docs/open-data-app-spezifikation/). Mehr unter https://github.com/open-data-apps

---

## Funktionen

![Screenshot Desktop](assets/Desktop_Screenshot.png)

![Screenshot Mobile](assets/Desktop_Screenshot_2.png)

Single Page Application mit Logo, Menü, Impressum/Datenschutz/Kontakt-Seiten und Fußzeile. Die Konfiguration wird vom ODAS geladen. Inhalte:

- Interaktive Kartenansicht mit Leaflet.js/OpenStreetMap
- Tabellenansicht der gefilterten Spielplätze
- Volltextsuche nach Name und Adresse
- Filter nach Ortsteil und Art
- Zusatzfilter für Barrierefreiheit und Ballspielen
- Ergebniszähler und Marker-Popups mit Kerndaten

---

## Datenformat

Unterstützt CSV aus Open-Data-Quellen.

- Delimiter-Erkennung für Semikolon und Komma
- Quote-sicheres Parsing inklusive Escaped-Quotes
- Verarbeitung von Proxy-Antworten als Rohtext oder JSON-Wrapper mit content-Feld

---

## Kompatible Datensätze

Spielplatz-Datensätze mit Geokoordinaten und optional variierenden Feldnamen. Die App normalisiert gängige Varianten automatisch.

| App-Feld       | Erwartete Inhalte | Unterstützte Feldnamen (Auszug)                      |
| -------------- | ----------------- | ---------------------------------------------------- |
| name           | Name/Adresse      | name, bezeichnung, adresse, strasse                  |
| ortsteil       | Ortsteil/Bezirk   | ortsteil, bezirk                                     |
| plz            | Postleitzahl      | plz, postleitzahl                                    |
| art            | Typ/Art           | art, spielplatzart, anlagenart                       |
| flaeche        | Fläche            | groesse, flaeche, größe                              |
| barrierefrei   | Barrierefrei-Flag | behindertengerecht, barrierefrei                     |
| ballspielen    | Ballspielen-Flag  | ballspielen, bolzen                                  |
| tischtennis    | Tischtennis-Flag  | tischtennis, tischtennis_anzahl                      |
| schliesszeiten | Zeiten            | schliesszeiten, öffnungszeiten                       |
| lat/lon        | Geokoordinaten    | lat/lon, latitude/longitude, breitengrad/laengengrad |

Hinweis: Boolesche Felder werden aktuell mit J als positiv ausgewertet.

---

## Entwicklung

Voraussetzungen: Docker / Docker Compose, Make

```bash
make build up
```

App läuft lokal auf http://localhost:8090.

Konfiguration wird bei lokaler Entwicklung aus [odas-config/config.json](odas-config/config.json) geladen.

### Wichtige Dateien

| Datei                                                | Beschreibung                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [app/app.js](app/app.js)                             | Hauptlogik: Datenladen über Proxy/Fallback, CSV-Parsing, Filter, Tabelle und Leaflet-Karte |
| [app-package.json](app-package.json)                 | App-Metadaten und Instanz-Konfigurationsfelder für den ODAS                                |
| [assets/odas-app-icon.svg](assets/odas-app-icon.svg) | App-Icon                                                                                   |
| [odas-config/config.json](odas-config/config.json)   | Lokale Konfiguration für die Entwicklung                                                   |
| [docker-compose.yml](docker-compose.yml)             | Lokale Container-Orchestrierung (Nginx + Volumes)                                          |

---

## Konfiguration (Instanz)

| Parameter    | Beschreibung                               | Pflicht |
| ------------ | ------------------------------------------ | ------- |
| apiurl       | Direkte URL zur CSV-Ressource              | ja      |
| urlDaten     | URL zur Datensatzseite im Open Data Portal | ja      |
| titel        | Titel in der App-Kopfzeile                 | ja      |
| seitentitel  | Browser-Tab-Titel                          | ja      |
| icon         | Icon in der Titelzeile                     | ja      |
| kontakt      | Inhalt der Kontaktseite (Markdown)         | ja      |
| beschreibung | Inhalt der Seite Über diese App (Markdown) | ja      |
| impressum    | Inhalt der Impressumsseite (Markdown)      | ja      |
| datenschutz  | Inhalt der Datenschutzseite (Markdown)     | ja      |
| fusszeile    | Text in der Fußzeile                       | ja      |
| sprache      | App-Sprache (de)                           | ja      |

---

## Technische Hinweise

- Primärer Datenabruf über lokalen Proxy-Endpunkt /odp-data?path=...
- Der path-Parameter wird URL-kodiert übertragen
- Fallback auf allorigins, falls Proxy nicht verfügbar ist

---

## Autor

© 2026, Ondics GmbH
