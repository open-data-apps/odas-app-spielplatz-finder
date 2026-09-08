/*
 * - @param {Object} configdata             - Konfigurationsdaten, enthält apiurls
 * - @param {HTMLElement} enclosingHtmlDivElement - Container für den Content
 * - @returns {null}
 */

let spInstanzZaehler = 0;

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

function renderWeitereInfos(configdata, uid) {
  const links = String(configdata.weiterfuehrendeLinks || "").trim();
  if (!links) return "";
  return (
    '<section class="sp-weitere-infos mt-4">' +
    '<button class="sp-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#sp-weitere-infos-body-' + uid + '" ' +
    'aria-expanded="false" aria-controls="sp-weitere-infos-body-' + uid + '">' +
    '<h2 class="h5 mb-0">Weitere Informationen</h2>' +
    '<span class="sp-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="sp-weitere-infos-body-' + uid + '" class="collapse sp-weitere-infos-content">' +
    links +
    "</div></section>"
  );
}

function renderMethodikbox(configdata, uid) {
  const methodik = String(configdata.datenquelleHinweis || "").trim();
  const datenStand = String(configdata.datenStand || "").trim();
  if (!methodik && !datenStand) return "";
  let content = "";
  if (datenStand) {
    content += '<p><strong>Datenstand:</strong> ' + escapeHtml(datenStand) + "</p>";
  }
  if (methodik) {
    content += methodik;
  }
  return (
    '<section class="sp-methodik mt-4">' +
    '<button class="sp-toggle btn btn-link text-decoration-none d-flex w-100 justify-content-between align-items-center p-0 collapsed" type="button" ' +
    'data-bs-toggle="collapse" data-bs-target="#sp-methodik-body-' + uid + '" ' +
    'aria-expanded="false" aria-controls="sp-methodik-body-' + uid + '">' +
    '<h2 class="h5 mb-0">Methodik / Datenquelle</h2>' +
    '<span class="sp-chevron" aria-hidden="true">&#9662;</span>' +
    "</button>" +
    '<div id="sp-methodik-body-' + uid + '" class="collapse sp-methodik-content">' +
    content +
    "</div></section>"
  );
}

function isOdasProxyEnabled(configdata = {}) {
  return String(configdata.proxyAktiv || "").trim().toLowerCase() === "ja";
}

function extractPathFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (_error) {
    return String(url || "");
  }
}

function getOdasAppBasePath(pathname) {
  let appPath =
    pathname === undefined
      ? typeof window !== "undefined"
        ? window.location.pathname
        : "/"
      : String(pathname || "/");

  if (!appPath.endsWith("/")) {
    const lastSlashIndex = appPath.lastIndexOf("/");
    const lastSegment = appPath.substring(lastSlashIndex + 1);
    if (lastSegment.includes(".")) {
      appPath = appPath.substring(0, lastSlashIndex + 1);
    }
  }

  return appPath.replace(/\/+$/, "");
}

function getOdasProxyEndpoint(targetUrl, pathname) {
  const appPath = getOdasAppBasePath(pathname);
  return `${appPath}/odp-data?path=${encodeURIComponent(targetUrl)}`;
}

async function fetchViaOdasProxy(targetUrl, options = {}) {
  if (typeof isKeineDatenquelleKonfiguriert === "function" && isKeineDatenquelleKonfiguriert(targetUrl)) {
    throw new Error("Keine Datenquelle konfiguriert.");
  } else if (typeof isKeineDatenquelleKonfiguriert !== "function") {
    const v = String(targetUrl || "").trim();
    if (!v || /^\{\{.*\}\}$/.test(v) || /^<.*>$/.test(v)) throw new Error("Keine Datenquelle konfiguriert.");
  }

  const response = await fetch(getOdasProxyEndpoint(targetUrl), {
    method: "POST",
    signal: options && options.signal ? options.signal : undefined,
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch (_e) {}
    const originHint = /origin not allowed/i.test(body) ? " – URL origin not allowed" : "";
    throw new Error(`ODAS-Proxy-Fehler: HTTP ${response.status}${originHint}`);
  }

  const proxyData = await response.json();
  if (!proxyData || typeof proxyData.content !== "string") {
    throw new Error("ODAS-Proxy-Antwort enthält keinen content-String.");
  }

  return proxyData.content;
}

async function fetchOdasResource(targetUrl, configdata = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl);
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    throw new Error(
      `Direkter Datenabruf fehlgeschlagen (${error.message}). Bitte prüfen Sie die Daten-URL und die CORS-Freigabe der Datenquelle.`,
    );
  }
}

/**
 * Löst eine benannte Datenressource aus configdata.apiurls auf.
 * Neue apiurls-Form (typ: "array"); das frühere skalare apiurl wird nicht mehr gelesen.
 * @returns {string} getrimmte URL, oder "" für den Zustand "keine Quelle konfiguriert"
 */
function getOdasApiUrl(configdata, name) {
  const liste = Array.isArray(configdata && configdata.apiurls) ? configdata.apiurls : [];
  const treffer = liste.find((eintrag) => eintrag && eintrag.name === name);
  return String((treffer && treffer.url) || "").trim();
}

async function fetchOdasJson(targetUrl, configdata = {}) {
  const rawContent = await fetchOdasResource(targetUrl, configdata);
  try {
    return JSON.parse(rawContent);
  } catch (_error) {
    throw new Error(
      `Die konfigurierte Daten-URL liefert kein JSON, sondern ${describeNonJsonPayload(rawContent)}. ` +
        "Bitte in der Instanzkonfiguration den API-Endpunkt der Datenquelle eintragen, " +
        "nicht den Datensatz- oder Download-Link.",
    );
  }
}

function describeNonJsonPayload(rawContent) {
  const text = String(rawContent == null ? "" : rawContent).trim();
  if (!text) return "eine leere Antwort";
  if (text.startsWith("<")) return "eine HTML-Seite";
  const firstLine = text.split(/\r?\n/, 1)[0];
  if (/[,;]/.test(firstLine)) return "eine CSV- oder Textdatei";
  return "unlesbaren Inhalt";
}

function isKeineDatenquelleKonfiguriert(targetUrl) {
  const quelle = String(targetUrl || "").trim();
  return !quelle || /^\{\{.*\}\}$/.test(quelle) || /^<.*>$/.test(quelle);
}


const TYP_BEZEICHNUNG = {
  "ckan-dkan-ds": "Tabellen-API mit Daten-ID",
  "ckan-ps": "Datensatz-API",
  "ckan-dl": "Datei-Download",
  "ods21": "Open-Data-Suche (API v2.1)",
  "wfs": "Kartendienst (WFS)",
  "sparql": "Wissensdatenbank (SPARQL)",
  "csv-zip": "Statische Datei"
};

function validateUrlTypErwartung(url, erwarteterTyp) {
  const u = String(url || "");
  if (!erwarteterTyp || isKeineDatenquelleKonfiguriert(u)) return null;
  const checks = {
    "ckan-dkan-ds": /\/api\/3\/action\/datastore_search\?resource_id=/i,
    "ckan-ps": /\/api\/3\/action\/package_show\?id=/i,
    "ckan-dl": /\/dataset\/.*\/resource\/.*\/download\//i,
    "ods21": /\/api\/explore\/v2\.1\//i,
    "wfs": /service=WFS/i,
    "sparql": /\/api\/ts\/v1\/kg\/sparql/i,
    "csv-zip": /\.(csv|json|zip)(\?|$)/i
  };
  const re = checks[erwarteterTyp];
  if (!re) return null;
  if (!re.test(u)) {
    const soll = TYP_BEZEICHNUNG[erwarteterTyp] || erwarteterTyp;
    return `Typ passt nicht: erwartet „${soll}", erhalten „${u.slice(0, 60)}…". Prüfen Sie den Hilfe-Tooltip bei „URLs zu Datenressourcen".`;
  }
  return null;
}

function classifyOdasFehler(error, kontext = {}) {
  const msg = String((error && error.message) || error || "");
  const url = String(kontext.url || "");
  const label = String(kontext.label || "Datenressource");
  const typLabel = String(kontext.typLabel || TYP_BEZEICHNUNG[kontext.erwarteterTyp] || "Datenquelle");
  if (/Keine Datenquelle konfiguriert/i.test(msg) || isKeineDatenquelleKonfiguriert(url)) {
    return {
      kind: "KEINE_QUELLE",
      titel: "Es ist keine Datenquelle konfiguriert.",
      hinweis: `Prüfen Sie unter „URLs zu Datenressourcen → ${label}" ob eine gültige ${typLabel}-URL eingetragen ist (Hilfe-Tooltip beachten).`,
      detail: msg,
      alertClass: "alert-info"
    };
  }
  if (/Typ passt nicht: erwartet/i.test(msg)) {
    return {
      kind: "TYP_MISMATCH",
      titel: msg,
      hinweis: `Diese App erwartet ${typLabel}. Korrigieren Sie die URL gemäß Hilfe-Tooltip (Beispiel dort).`,
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/URL origin not allowed/i.test(msg)) {
    return {
      kind: "PROXY_ORIGIN",
      titel: "ODAS-Proxy blockiert: Ziel-Origin nicht freigegeben.",
      hinweis: "Tragen Sie die Ziel-Origin als eigenen Eintrag unter „URLs zu Datenressourcen“ ein oder prüfen Sie proxyAktiv.",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/ODAS-Proxy-Fehler/i.test(msg) || /kein content-String/i.test(msg)) {
    return {
      kind: "PROXY_HTTP",
      titel: msg,
      hinweis: "Prüfen Sie proxyAktiv und Erreichbarkeit im ODAS-Live-System (lokal 404 ist normal).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/Direkter Datenabruf fehlgeschlagen/i.test(msg) || /Failed to fetch/i.test(msg)) {
    const corsHint = /Failed to fetch/i.test(msg) ? " – vermutlich CORS blockiert → im ODAS-Live proxyAktiv=ja." : "";
    return {
      kind: "DIREKT_CORS_HTTP",
      titel: msg,
      hinweis: `Prüfen Sie URL und CORS der Quelle${corsHint}`,
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/liefert kein JSON/i.test(msg) || /HTML-Seite|CSV-|leere Antwort|unlesbaren/i.test(msg)) {
    return {
      kind: "PAYLOAD_TYP",
      titel: msg,
      hinweis: "Tragen Sie den passenden Endpunkt ein – nicht die Datensatzseite (/dataset/…) – Hilfe-Tooltip beachten.",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/CKAN.*Fehler|success:false/i.test(msg)) {
    return {
      kind: "CKAN_API",
      titel: msg,
      hinweis: "Prüfen Sie Daten-ID / Datensatz-ID (existiert die Tabelle/Datei noch auf dem Portal?).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/404|Nicht gefunden/i.test(msg)) {
    return {
      kind: "HTTP_404",
      titel: msg,
      hinweis: "Ressource/Datensatz auf dem Portal nicht gefunden (404).",
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  return {
    kind: "UNBEKANNT",
    titel: msg || "Unbekannter Fehler beim Laden.",
    hinweis: "Prüfen Sie Konfiguration und Erreichbarkeit der Quelle.",
    detail: msg,
    alertClass: "alert-danger"
  };
}

function renderOdasFehler(container, error, kontext = {}) {
  if (!container) return;
  const typWarn = validateUrlTypErwartung(kontext.url, kontext.erwarteterTyp);
  if (typWarn && !/Typ passt nicht/i.test(String(error && error.message))) {
    error = new Error(typWarn);
  }
  const info = classifyOdasFehler(error, kontext);
  const url = String(kontext.url || "");
  const urlZeile = url ? `<p class="mb-1 small text-muted">Konfigurierte URL: <code>${escapeHtml(url.length > 80 ? url.slice(0, 80) + "…" : url)}</code></p>` : "";
  const titel = kontext.leer ? "Keine Datensätze gefunden." : info.titel;
  const alertClass = kontext.leer ? "alert-info" : info.alertClass;
  container.innerHTML = `<div class="alert ${alertClass}" role="alert"><strong>${escapeHtml(titel)}</strong><p class="mb-1">${escapeHtml(info.hinweis)}</p>${urlZeile}<details class="small"><summary>Details</summary><code>${escapeHtml(info.detail || String(error))}</code></details></div>`;
}

function isLeerErgebnis(json) {
  if (!json) return true;
  if (Array.isArray(json) && json.length === 0) return true;
  if (Array.isArray(json.records) && json.records.length === 0) return true;
  if (Array.isArray(json.results) && json.results.length === 0) return true;
  if (json.result && Array.isArray(json.result.records) && json.result.records.length === 0) return true;
  return false;
}


// F-51/F-70: Container -> Teardown-Callback. Wird synchron zu Beginn von
// app() gesetzt (vor jeglicher DOM-/Async-Arbeit) und setzt u. a. das
// Dispose-Flag der Instanz, damit verspaetete Promise-/setTimeout-
// Fortsetzungen erkennen, dass ihre Instanz nicht mehr aktiv ist.
const spTeardowns = new Map();

/* Wird von app/app-base.js zu Beginn von loadPage() aufgerufen. */
function onPageLeave(page) {
  spTeardowns.forEach((teardown, container) => {
    try {
      teardown();
    } catch (error) {
      console.warn("Fehler beim Abraeumen der Spielplatz-Instanz:", error);
    }
    spTeardowns.delete(container);
  });
}

function app(configdata = {}, enclosingHtmlDivElement) {
  const spUid = "i" + ++spInstanzZaehler;
  // F-70: Instanzzustand inkl. Dispose-/Race-Guard. Wird VOR jeglicher DOM-
  // und Async-Arbeit angelegt und registriert, damit auch ein Seitenwechsel
  // waehrend des initialen CSV-Ladens oder des Leaflet-Wartens verspaetete
  // Fortsetzungen wirkungslos macht (statt in den DOM eines abgebauten/
  // wiederverwendeten Containers zu schreiben).
  const state = {
    datenStand: null,
    disposed: false,
    map: null,
    // Monoton wachsender Token: wird bei Dispose erhoeht, um laufende
    // Geocode-Fortsetzungen als ueberholt zu markieren (Muster wie F-57 in
    // odas-app-realtimedataview).
    geocodeToken: 0,
  };
  // F-51/F-70: Container -> Abbaufunktion dieser Instanz. Ueberschreibt
  // synchron jeden evtl. noch vorhandenen Eintrag fuer denselben Container.
  spTeardowns.set(enclosingHtmlDivElement, function () {
    state.disposed = true;
    state.geocodeToken++;
    if (state.map) {
      try {
        state.map.remove();
      } catch (error) {
        console.warn("Fehler beim Entfernen der Leaflet-Karte:", error);
      }
      state.map = null;
    }
  });
  // --- Skeleton sofort rendern ---
  enclosingHtmlDivElement.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0">
        <span style="font-size:1.4rem;">🛝</span> ${escapeHtml(configdata.titel || "Spielplätze")}
      </h2>
      <small class="text-muted">Steglitz-Zehlendorf · Berlin Open Data</small>
    </div>
    <div id="sp-datenstand-wrap-${spUid}"></div>

    <div class="card mb-3 border-0 bg-light">
      <div class="card-body py-2">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label mb-1 small fw-semibold">Suche (Name / Adresse)</label>
            <input type="text" id="sp-search-${spUid}" class="form-control form-control-sm"
                   placeholder="z. B. Schloßpark …">
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label mb-1 small fw-semibold">Ortsteil</label>
            <select id="sp-ortsteil-${spUid}" class="form-select form-select-sm">
              <option value="">Alle</option>
            </select>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label mb-1 small fw-semibold">Art</label>
            <select id="sp-art-${spUid}" class="form-select form-select-sm">
              <option value="">Alle</option>
            </select>
          </div>
          <div class="col-6 col-md-2">
            <div class="form-check mt-3">
              <input class="form-check-input" type="checkbox" id="sp-barrierefrei-${spUid}">
              <label class="form-check-label small" for="sp-barrierefrei-${spUid}">♿ Barrierefrei</label>
            </div>
          </div>
          <div class="col-6 col-md-2">
            <div class="form-check mt-3">
              <input class="form-check-input" type="checkbox" id="sp-ballspielen-${spUid}">
              <label class="form-check-label small" for="sp-ballspielen-${spUid}">⚽ Ballspielen</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="sp-map-${spUid}" style="height:380px; border-radius:8px; margin-bottom:.5rem;"></div>
    <p id="sp-map-status-${spUid}" class="text-muted small mb-3">Karte wird vorbereitet …</p>

    <p id="sp-count-${spUid}" class="text-muted small mb-2">
      <span id="sp-data-spinner-${spUid}" style="vertical-align:middle;">
        <span class="spinner-border text-primary spinner-border-sm" role="status"
              style="width:1.2rem;height:1.2rem;">
          <span class="visually-hidden">Laden...</span>
        </span>
      </span>
      Lade Daten …
    </p>

    <div class="table-responsive" style="max-height:50vh; overflow:auto;">
      <table class="table table-sm table-hover align-middle">
        <thead class="table-dark" style="position:sticky; top:0; z-index:1;">
          <tr>
            <th>Name / Adresse</th>
            <th>Ortsteil</th>
            <th>Art</th>
            <th>Fläche (m²)</th>
            <th>⚽</th>
            <th>🏓</th>
            <th>♿</th>
          </tr>
        </thead>
        <tbody id="sp-tbody-${spUid}">
          <tr><td colspan="7" class="text-center">
            <div class="spinner-border spinner-border-sm text-secondary me-2"></div>
            Daten werden geladen …
          </td></tr>
        </tbody>
      </table>
    </div>

    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-2">
      <div id="sp-page-info-${spUid}" class="small text-muted"></div>
      <div class="d-flex align-items-center gap-2">
        <label for="sp-page-size-${spUid}" class="small text-muted mb-0">Pro Seite</label>
        <select id="sp-page-size-${spUid}" class="form-select form-select-sm" style="width:auto;">
          <option value="10">10</option>
          <option value="20" selected>20</option>
          <option value="50">50</option>
        </select>
        <button id="sp-prev-${spUid}" type="button" class="btn btn-outline-secondary btn-sm">Zurück</button>
        <button id="sp-next-${spUid}" type="button" class="btn btn-outline-secondary btn-sm">Weiter</button>
      </div>
    </div>
    <div id="sp-methodik-wrap-${spUid}"></div>
    <div id="sp-weitere-infos-wrap-${spUid}"></div>
  `;

  const methodikHtml = renderMethodikbox(configdata, spUid);
  if (methodikHtml) {
    const mel = enclosingHtmlDivElement.querySelector(`#sp-methodik-wrap-${spUid}`);
    if (mel) mel.innerHTML = methodikHtml;
  }

  // Schale 4: Weitere Informationen sofort rendern
  const weitereHtml = renderWeitereInfos(configdata, spUid);
  if (weitereHtml) {
    const wel = enclosingHtmlDivElement.querySelector(`#sp-weitere-infos-wrap-${spUid}`);
    if (wel) wel.innerHTML = weitereHtml;
  }

  const rawApiUrl = getOdasApiUrl(configdata, "spielplaetze");
  const spKontext = {
    url: rawApiUrl,
    label: "Spielplatz-CSV",
    typLabel: "Statische Datei",
    erwarteterTyp: "csv-zip",
  };
  const apiUrl = normalizeApiUrl(rawApiUrl);
  if (!rawApiUrl || !apiUrl) {
    renderOdasFehler(enclosingHtmlDivElement, new Error("Keine Datenquelle konfiguriert."), spKontext);
    return null;
  }
  // Variante A (F-92): Typprüfung vor dem ersten Fetch.
  const spTypWarn = validateUrlTypErwartung(apiUrl, "csv-zip");
  if (spTypWarn) {
    renderOdasFehler(enclosingHtmlDivElement, new Error(spTypWarn), spKontext);
    return null;
  }

  // --- Daten laden (nicht-async, via .then()) ---
  fetchSpielplatzCsv(apiUrl, configdata, state)
    .then(function (csvText) {
      // F-70: Seitenwechsel waehrend des Fetch — abbrechen, bevor irgendetwas
      // geparst oder in den (evtl. abgebauten/wiederverwendeten) DOM
      // geschrieben wird.
      if (state.disposed) return;
      // Schale 4: Datenfrische aus Last-Modified anzeigen
      if (state.datenStand) {
        const dsEl = enclosingHtmlDivElement.querySelector(`#sp-datenstand-wrap-${spUid}`);
        if (dsEl) dsEl.innerHTML = '<div class="text-muted small mb-2">Datenstand: ' + escapeHtml(state.datenStand) + '</div>';
      }
      const spielplaetze = parseCSV(csvText);
      if (spielplaetze.length === 0) {
        showEmptyDataInfo("Keine Daten in der Datenquelle gefunden.");
        return;
      }
      waitForLeafletThenInit(spielplaetze, enclosingHtmlDivElement, spUid, state);
    })
    .catch(function (err) {
      if (state.disposed) return;
      console.error(err);
      const spTableWrap = enclosingHtmlDivElement.querySelector(
        `#sp-tbody-${spUid}`,
      );
      if (spTableWrap) {
        spTableWrap.innerHTML =
          '<tr><td colspan="7"><div class="sp-fehler-slot"></div></td></tr>';
        renderOdasFehler(
          spTableWrap.querySelector(".sp-fehler-slot"),
          err,
          spKontext,
        );
      }
      clearLoadingPlaceholders("Keine Karte: Daten konnten nicht geladen werden.");
    });

  return null;

  function clearLoadingPlaceholders(mapText) {
    const s = enclosingHtmlDivElement.querySelector(`#sp-data-spinner-${spUid}`);
    if (s) s.style.display = "none";
    // Der Text "Lade Daten …" steht außerhalb des Spinners und blieb im
    // Leer-/Fehlerzustand stehen (F-98, Live-Fund 2026-09-08).
    const count = enclosingHtmlDivElement.querySelector(`#sp-count-${spUid}`);
    if (count) count.textContent = "";
    const mapStatus = enclosingHtmlDivElement.querySelector(`#sp-map-status-${spUid}`);
    if (mapStatus) mapStatus.textContent = mapText;
  }

  function showEmptyDataInfo(message) {
    enclosingHtmlDivElement.querySelector(`#sp-tbody-${spUid}`).innerHTML =
      `<tr><td colspan="7" class="text-center p-3">
         <div class="alert alert-info mb-0" role="alert">${escapeHtml(message)}</div>
       </td></tr>`;
    clearLoadingPlaceholders("Keine Karte: keine Daten gefunden.");
  }
}

async function fetchSpielplatzCsv(apiUrl, configdata = {}, state) {
  // Standard ist der Direktabruf; der ODAS-Proxy nur bei proxyAktiv=ja.
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(apiUrl);
  }
  return fetchCSVDirect(apiUrl, state);
}

async function fetchCSVDirect(apiUrl, state) {
  const response = await fetch(apiUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`GET ${apiUrl} -> HTTP ${response.status}`);
  }

  // Datenfrische aus Last-Modified header
  const lastMod = response.headers.get("last-modified");
  if (lastMod) {
    const d = new Date(lastMod);
    if (!isNaN(d.getTime())) {
      state.datenStand = d.toLocaleDateString("de-DE");
    }
  }

  return response.text();
}

function normalizeApiUrl(apiUrl) {
  if (!apiUrl) return "";

  if (
    apiUrl.includes("...simple-search-spielplaetze/index.php/index/all.csv?q=")
  ) {
    return apiUrl.replace(
      "...simple-search-spielplaetze/index.php/index/all.csv?q=",
      "politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/spiel-und-sportplaetze/simple-search-spielplaetze/index.php/index/all.csv?q=",
    );
  }

  if (apiUrl.includes("...")) return "";
  return apiUrl;
}

/* ------------------------------------------------------------------ */
/*  Warte auf Leaflet, dann App initialisieren                         */
/* ------------------------------------------------------------------ */
function waitForLeafletThenInit(data, container, uid, state) {
  let tries = 0;
  function check() {
    // F-70: Instanz kann waehrend des Pollings (Seitenwechsel) abgebaut
    // worden sein — dann weder initApp() noch weitere DOM-Schreibvorgaenge
    // ausloesen, und die Poll-Schleife nicht fortsetzen.
    if (state.disposed) return;
    if (typeof L !== "undefined") {
      initApp(data, container, uid, state);
      return;
    }
    if (tries++ > 80) {
      container.querySelector(`#sp-tbody-${uid}`).innerHTML =
        `<tr><td colspan="9" class="text-danger text-center">
           Leaflet konnte nicht geladen werden.
         </td></tr>`;
      return;
    }
    setTimeout(check, 100);
  }
  check();
}

/* ------------------------------------------------------------------ */
/*  CSV-Parser (quote-sicher, Semikolon/Komma)                         */
/* ------------------------------------------------------------------ */
function parseCSV(text) {
  if (!text || !text.trim()) return [];

  const records = splitCSVRecords(text.replace(/\r\n?/g, "\n"));
  if (records.length < 2) return [];

  const delimiter = detectDelimiter(records[0]);
  const headers = splitCSVRow(records[0], delimiter).map(function (h) {
    return h.trim().toLowerCase();
  });

  return records
    .slice(1)
    .filter(function (line) {
      return line.trim() !== "";
    })
    .map(function (line) {
      const vals = splitCSVRow(line, delimiter);
      const obj = {};
      headers.forEach(function (h, i) {
        obj[h] = vals[i] || "";
      });
      return obj;
    });
}

function detectDelimiter(headerLine) {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ";" : ",";
}

function splitCSVRecords(text) {
  const records = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "\n" && !inQuotes) {
      records.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current !== "") records.push(current);
  return records;
}

function splitCSVRow(row, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    const next = row[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseCoordinate(value) {
  if (value === null || typeof value === "undefined") return NaN;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return NaN;
  return Number.parseFloat(normalized);
}

function isTruthyValue(value) {
  if (typeof value === "number") return value > 0;
  if (typeof value === "boolean") return value;
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return false;
  return (
    ["j", "ja", "yes", "true", "1", "x"].includes(text) ||
    text.includes("rollstuhl")
  );
}

/* ------------------------------------------------------------------ */
/*  App initialisieren (Karte + Tabelle + Filter)                      */
/* ------------------------------------------------------------------ */
function initApp(data, container, uid, state) {
  // Spinner ausblenden
  const spinner = container.querySelector(`#sp-data-spinner-${uid}`);
  if (spinner) spinner.style.display = "none";

  // Felder normalisieren
  const normalized = data.map(function (row) {
    const tischtennisCount = parseCoordinate(
      row["tischtennis_anzahl"] || row["tischtennis"] || 0,
    );

    return {
      id: row["id"] || "",
      name:
        row["name"] ||
        row["bezeichnung"] ||
        row["adresse"] ||
        row["strasse"] ||
        "",
      ortsteil: row["ortsteil"] || row["bezirk"] || "",
      plz: row["plz"] || row["postleitzahl"] || "",
      strasse: row["strasse"] || row["adresse"] || "",
      art: row["art"] || row["spielplatzart"] || row["anlagenart"] || "",
      flaeche: row["groesse"] || row["flaeche"] || row["größe"] || "",
      ballspielen: row["ballspielen"] || row["bolzen"] || "",
      tischtennis: row["tischtennis"] || row["tischtennis_anzahl"] || "",
      tischtennisCount: isNaN(tischtennisCount) ? 0 : tischtennisCount,
      barrierefrei: row["behindertengerecht"] || row["barrierefrei"] || "",
      schliesszeiten: row["schliesszeiten"] || row["öffnungszeiten"] || "",
      lat: parseCoordinate(
        row["lat"] ||
          row["latitude"] ||
          row["breitengrad"] ||
          row["ykoord"] ||
          row["koordy"] ||
          "",
      ),
      lon: parseCoordinate(
        row["lon"] ||
          row["longitude"] ||
          row["laengengrad"] ||
          row["xkoord"] ||
          row["koordx"] ||
          "",
      ),
    };
  });

  // Leaflet-Karte
  const map = L.map(container.querySelector(`#sp-map-${uid}`)).setView([52.43, 13.32], 12);
  // F-51/F-70: Referenz auf die Karte am Instanzzustand hinterlegen — die in
  // app() bereits registrierte Abbaufunktion entfernt sie ueber state.map,
  // sobald die Instanz disposed wird (Seitenwechsel oder Re-Init desselben
  // Containers).
  state.map = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  const mapStatus = container.querySelector(`#sp-map-status-${uid}`);

  const geocodeCache = new Map();
  const geocodeInFlight = new Set();
  const markerByKey = new Map();
  let latestRowsByKey = new Map();
  let selectedRowKey = "";
  let pendingFocusKey = "";
  let renderScheduled = false;
  let currentPage = 1;

  const pageSizeSelect = container.querySelector(`#sp-page-size-${uid}`);
  const pageInfo = container.querySelector(`#sp-page-info-${uid}`);
  const prevBtn = container.querySelector(`#sp-prev-${uid}`);
  const nextBtn = container.querySelector(`#sp-next-${uid}`);

  // Dropdowns befüllen
  const ortsteile = [
    ...new Set(
      normalized
        .map(function (d) {
          return d.ortsteil;
        })
        .filter(Boolean),
    ),
  ].sort();
  const arten = [
    ...new Set(
      normalized
        .map(function (d) {
          return d.art;
        })
        .filter(Boolean),
    ),
  ].sort();

  const selOrt = container.querySelector(`#sp-ortsteil-${uid}`);
  const selArt = container.querySelector(`#sp-art-${uid}`);
  ortsteile.forEach(function (o) {
    selOrt.innerHTML += `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`;
  });
  arten.forEach(function (a) {
    selArt.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`;
  });

  // Badge-Helper
  function badge(val) {
    if (!val && val !== 0) return "<span class='text-muted'>–</span>";
    return isTruthyValue(val)
      ? "<span class='badge bg-success'>✓</span>"
      : "<span class='badge bg-secondary'>✗</span>";
  }

  function hasCoords(sp) {
    return (
      Number.isFinite(sp.lat) &&
      Number.isFinite(sp.lon) &&
      sp.lat !== 0 &&
      sp.lon !== 0
    );
  }

  function getRowKey(sp) {
    if (sp.id) return `id:${sp.id}`;
    return (
      "row:" +
      [sp.name, sp.strasse, sp.plz, sp.ortsteil]
        .map(function (v) {
          return String(v || "")
            .trim()
            .toLowerCase();
        })
        .join("|")
    );
  }

  function highlightSelectedRow() {
    const tbody = container.querySelector(`#sp-tbody-${uid}`);
    tbody.querySelectorAll("tr[data-row-key]").forEach(function (rowEl) {
      const rowKey = decodeURIComponent(
        rowEl.getAttribute("data-row-key") || "",
      );
      rowEl.classList.toggle("table-primary", rowKey === selectedRowKey);
    });
  }

  function focusPlaygroundByKey(rowKey) {
    const sp = latestRowsByKey.get(rowKey);
    if (!sp) return;

    selectedRowKey = rowKey;
    const coords = getCoords(sp);

    if (Array.isArray(coords) && coords.length === 2) {
      const marker = markerByKey.get(rowKey);
      if (marker) {
        marker.openPopup();
        map.setView(coords, 17, { animate: true });
      }
      mapStatus.textContent = `${sp.name || "Spielplatz"} auf Karte fokussiert`;
      highlightSelectedRow();
      return;
    }

    pendingFocusKey = rowKey;
    if (queueGeocode(sp)) {
      mapStatus.textContent = `${sp.name || "Spielplatz"}: Koordinaten werden per Adresse ermittelt …`;
    } else {
      mapStatus.textContent = `${sp.name || "Spielplatz"}: Keine Koordinaten/Adresse für Kartenfokus verfügbar.`;
    }
    highlightSelectedRow();
  }

  function geocodeKey(sp) {
    const parts = [sp.strasse, sp.plz, sp.ortsteil]
      .map(function (p) {
        return String(p || "").trim();
      })
      .filter(Boolean);

    if (parts.length === 0) return "";
    return parts.join("|").toLowerCase().replace(/\s+/g, " ");
  }

  function geocodeQuery(sp) {
    const parts = [sp.strasse, sp.plz, sp.ortsteil].filter(Boolean);
    if (parts.length === 0) return "";
    parts.push("Berlin");
    return parts.join(", ");
  }

  function getCoords(sp) {
    if (hasCoords(sp)) return [sp.lat, sp.lon];
    const key = geocodeKey(sp);
    if (!key) return null;
    if (geocodeCache.has(key)) return geocodeCache.get(key);
    return null;
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(function () {
      renderScheduled = false;
      // F-70: waehrend der gebatchten 0ms-Verzoegerung kann die Instanz
      // (Seitenwechsel) disposed worden sein — dann nicht mehr auf der
      // bereits entfernten Leaflet-Karte/DOM rendern.
      if (state.disposed) return;
      render();
    }, 0);
  }

  async function geocodeAddress(query) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "de");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) return null;

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) return null;

    const lat = parseCoordinate(payload[0].lat);
    const lon = parseCoordinate(payload[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lat, lon];
  }

  function queueGeocode(sp) {
    const key = geocodeKey(sp);
    const query = geocodeQuery(sp);
    if (!key || !query) return false;
    if (geocodeCache.has(key) || geocodeInFlight.has(key)) return false;

    geocodeInFlight.add(key);
    // F-70: Token der Instanz zum Zeitpunkt der Anfrage einfrieren. Er wird
    // bei Dispose erhoeht, sodass eine verspaetet zurueckkommende Anfrage
    // erkennt, dass ihre Instanz nicht mehr aktiv ist, und weder den Cache
    // fuellt noch einen Render auf einer bereits entfernten Karte ausloest.
    const requestToken = state.geocodeToken;
    geocodeAddress(query)
      .then(function (coords) {
        if (state.geocodeToken !== requestToken) return;
        geocodeCache.set(key, coords);
      })
      .catch(function () {
        if (state.geocodeToken !== requestToken) return;
        geocodeCache.set(key, null);
      })
      .finally(function () {
        geocodeInFlight.delete(key);
        if (state.geocodeToken !== requestToken) return;
        scheduleRender();
      });

    return true;
  }

  function renderMap(rows) {
    markerLayer.clearLayers();
    markerByKey.clear();
    const bounds = [];
    let markerCount = 0;
    let queuedGeocodes = 0;
    const maxGeocodePerRender = 8;

    rows.forEach(function (sp) {
      const rowKey = getRowKey(sp);
      const coords = getCoords(sp);
      if (Array.isArray(coords) && coords.length === 2) {
        const marker = L.marker(coords);
        marker.bindPopup(
          `<strong>${escapeHtml(sp.name) || "Spielplatz"}</strong><br>` +
            [sp.strasse, sp.plz, sp.ortsteil]
              .filter(Boolean)
              .map(escapeHtml)
              .join(" · ") +
            "<br><em>" +
            escapeHtml(sp.art) +
            "</em><br>" +
            (isTruthyValue(sp.barrierefrei) ? "♿ Barrierefrei " : "") +
            (isTruthyValue(sp.ballspielen) ? "⚽ Ballspielen " : "") +
            (sp.tischtennisCount > 0 || isTruthyValue(sp.tischtennis)
              ? "🏓 Tischtennis"
              : "") +
            (sp.schliesszeiten
              ? "<br>🕐 " + escapeHtml(sp.schliesszeiten)
              : ""),
        );
        markerLayer.addLayer(marker);
        markerByKey.set(rowKey, marker);
        bounds.push(coords);
        markerCount++;
        return;
      }

      if (queuedGeocodes < maxGeocodePerRender && queueGeocode(sp)) {
        queuedGeocodes++;
      }
    });

    if (pendingFocusKey && markerByKey.has(pendingFocusKey)) {
      const marker = markerByKey.get(pendingFocusKey);
      if (marker) {
        marker.openPopup();
        map.setView(marker.getLatLng(), 17, { animate: true });
      }
      selectedRowKey = pendingFocusKey;
      pendingFocusKey = "";
      highlightSelectedRow();
    }

    const selectedMarker = selectedRowKey
      ? markerByKey.get(selectedRowKey)
      : null;
    if (selectedMarker) {
      selectedMarker.openPopup();
      map.setView(selectedMarker.getLatLng(), 17, { animate: true });
    } else if (bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
      } catch (e) {}
    }

    if (markerCount > 0) {
      mapStatus.textContent =
        `${markerCount} Marker auf Karte` +
        (queuedGeocodes > 0
          ? ` · ${queuedGeocodes} Adresse(n) werden ermittelt …`
          : "");
      return;
    }

    mapStatus.textContent =
      queuedGeocodes > 0
        ? `Noch keine Koordinaten vorhanden · ${queuedGeocodes} Adresse(n) werden ermittelt …`
        : "Für diese Auswahl konnten keine Koordinaten ermittelt werden.";
  }

  // Render-Funktion
  function render() {
    const q = container.querySelector(`#sp-search-${uid}`).value.toLowerCase();
    const ort = selOrt.value;
    const art = selArt.value;
    const barrier = container.querySelector(`#sp-barrierefrei-${uid}`).checked;
    const ball = container.querySelector(`#sp-ballspielen-${uid}`).checked;
    const pageSize = parseInt(pageSizeSelect.value, 10) || 20;

    const filtered = normalized.filter(function (sp) {
      const searchText = [sp.name, sp.strasse, sp.plz, sp.ortsteil, sp.art]
        .join(" ")
        .toLowerCase();
      if (q && !searchText.includes(q)) return false;
      if (ort && sp.ortsteil !== ort) return false;
      if (art && sp.art !== art) return false;
      if (barrier && !isTruthyValue(sp.barrierefrei)) return false;
      if (ball && !isTruthyValue(sp.ballspielen)) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const pageStart = (currentPage - 1) * pageSize;
    const paged = filtered.slice(pageStart, pageStart + pageSize);

    // Zähler
    container.querySelector(`#sp-count-${uid}`).textContent =
      filtered.length +
      " Spielplatz" +
      (filtered.length !== 1 ? "plätze" : "") +
      " gefunden";

    pageInfo.textContent =
      `Seite ${currentPage}/${totalPages} · ` +
      `${paged.length} von ${filtered.length} Einträgen sichtbar`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    // Tabelle
    const tbody = container.querySelector(`#sp-tbody-${uid}`);
    latestRowsByKey = new Map(
      paged.map(function (sp) {
        return [getRowKey(sp), sp];
      }),
    );

    if (paged.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">
        Keine Ergebnisse für diese Filter.</td></tr>`;
    } else {
      tbody.innerHTML = paged
        .map(function (sp) {
          const rowKey = getRowKey(sp);
          const rowKeyAttr = encodeURIComponent(rowKey);
          const addressLine = [sp.strasse, sp.plz].filter(Boolean).join(" · ");
          const tischtennisBadge =
            sp.tischtennisCount > 0 ? badge(true) : badge(sp.tischtennis);

          return `<tr data-row-key="${rowKeyAttr}" style="cursor:pointer;">
          <td>
            <div class="fw-semibold">${sp.name ? escapeHtml(sp.name) : "<em class='text-muted'>–</em>"}</div>
            <div class="small text-muted">${escapeHtml(addressLine) || "–"}</div>
            ${sp.schliesszeiten ? `<div class="small text-muted">🕐 ${escapeHtml(sp.schliesszeiten)}</div>` : ""}
          </td>
          <td>${escapeHtml(sp.ortsteil) || "–"}</td>
          <td>${escapeHtml(sp.art) || "–"}</td>
          <td class="text-end">${escapeHtml(sp.flaeche) || "–"}</td>
          <td class="text-center">${badge(sp.ballspielen)}</td>
          <td class="text-center">${tischtennisBadge}</td>
          <td class="text-center">${badge(sp.barrierefrei)}</td>
        </tr>`;
        })
        .join("");
    }

    highlightSelectedRow();

    renderMap(paged);
  }

  // --- Event-Listener ---
  function resetPageAndRender() {
    currentPage = 1;
    render();
  }

  ["sp-search-" + uid, "sp-ortsteil-" + uid, "sp-art-" + uid].forEach(function (id) {
    container.querySelector("#" + id).addEventListener("input", resetPageAndRender);
  });
  ["sp-barrierefrei", "sp-ballspielen"].forEach(function (id) {
    container.querySelector("#" + id + "-" + uid).addEventListener("change", resetPageAndRender);
  });

  pageSizeSelect.addEventListener("change", resetPageAndRender);
  container
    .querySelector(`#sp-tbody-${uid}`)
    .addEventListener("click", function (event) {
      const rowEl = event.target.closest("tr[data-row-key]");
      if (!rowEl) return;
      const rowKey = decodeURIComponent(
        rowEl.getAttribute("data-row-key") || "",
      );
      focusPlaygroundByKey(rowKey);
    });

  prevBtn.addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  });
  nextBtn.addEventListener("click", function () {
    currentPage++;
    render();
  });

  // --- Erstmalig rendern ---
  render();
}

/*
 * Diese Funktion lädt Leaflet CSS und JS in den Head.
 */
function addToHead() {
  // Leaflet CSS
  const leafletCss = document.createElement("link");
  leafletCss.rel = "stylesheet";
  leafletCss.href = "vendor/leaflet/leaflet.css";
  leafletCss.crossOrigin = "anonymous";
  document.head.appendChild(leafletCss);

  // Leaflet JS
  const leafletJs = document.createElement("script");
  leafletJs.src = "vendor/leaflet/leaflet.js";
  leafletJs.async = false;
  leafletJs.crossOrigin = "anonymous";
  document.head.appendChild(leafletJs);
}
