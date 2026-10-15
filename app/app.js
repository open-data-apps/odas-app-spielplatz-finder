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

async function fetchOdasResource(targetUrl, configdata = {}, options = {}) {
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(targetUrl, options);
  }

  try {
    const response = await fetch(targetUrl, { signal: options.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    // Abbruch ist kein Fehlerfall – unverpackt weiterreichen (SP-B5).
    if (error && error.name === "AbortError") throw error;
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
      hinweis: `Prüfen Sie unter „URLs zu Datenressourcen → ${label}", ob eine gültige ${typLabel}-URL eingetragen ist (Hilfe-Tooltip beachten).`,
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
  // Nur der Proxy-Helfer (Apps mit proxyAktiv) meldet "Direkter Datenabruf fehlgeschlagen".
  if (/Direkter Datenabruf fehlgeschlagen/i.test(msg)) {
    const corsHint = /Failed to fetch/i.test(msg) ? " – vermutlich CORS blockiert → im ODAS-Live proxyAktiv=ja." : "";
    return {
      kind: "DIREKT_CORS_HTTP",
      titel: msg,
      hinweis: `Prüfen Sie URL und CORS der Quelle${corsHint}`,
      detail: msg,
      alertClass: "alert-danger"
    };
  }
  if (/Failed to fetch/i.test(msg)) {
    return {
      kind: "NETZWERK",
      titel: msg,
      hinweis: "Die Quelle war nicht erreichbar. Prüfen Sie Internetverbindung und Erreichbarkeit der Quelle.",
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
  if (/\b404\b/.test(msg)) {
    return {
      kind: "HTTP_404",
      titel: msg,
      hinweis: "Die angefragte Adresse wurde nicht gefunden (404). Prüfen Sie, ob URL und Datensatz noch existieren. Lokal ohne ODAS gibt es weder Proxy noch Relay – Abrufe darüber enden dort mit 404.",
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
    loadController: null, // SP-B5: laufender CSV-Abruf ist abbrechbar
    // Monoton wachsender Token: wird bei Dispose erhoeht, um laufende
    // Geocode-Fortsetzungen als ueberholt zu markieren (Muster wie F-57 in
    // odas-app-realtimedataview).
    geocodeToken: 0,
    geocodePumpTimer: null, // wartender Start der nächsten Nominatim-Anfrage
  };
  // F-51/F-70: Container -> Abbaufunktion dieser Instanz.
  // BG/SP-B1: Vorgänger-Instanz desselben Containers zuerst abräumen — sonst
  // bleibt der Vorgänger `disposed = false`, seine Leaflet-Polling-Schleife
  // läuft weiter und ruft `initApp` auf einem bereits ersetzten Container.
  const spVorherigerTeardown = spTeardowns.get(enclosingHtmlDivElement);
  if (spVorherigerTeardown) {
    try {
      spVorherigerTeardown();
    } catch (_e) {}
  }
  spTeardowns.set(enclosingHtmlDivElement, function () {
    state.disposed = true;
    state.geocodeToken++;
    clearTimeout(state.geocodePumpTimer);
    state.geocodePumpTimer = null;
    if (state.loadController) {
      state.loadController.abort();
      state.loadController = null;
    }
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
  state.loadController = new AbortController();
  fetchSpielplatzCsv(apiUrl, configdata, state, state.loadController.signal)
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

async function fetchSpielplatzCsv(apiUrl, configdata = {}, state, signal) {
  // Standard ist der Direktabruf; der ODAS-Proxy nur bei proxyAktiv=ja.
  if (isOdasProxyEnabled(configdata)) {
    return fetchViaOdasProxy(apiUrl, { signal });
  }
  return fetchCSVDirect(apiUrl, state, signal);
}

async function fetchCSVDirect(apiUrl, state, signal) {
  // SP-B5: `signal` bricht einen laufenden Download beim Seitenwechsel ab.
  const response = await fetch(apiUrl, { method: "GET", signal });
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
/*  Leaflet dynamisch laden (SP-B2)                                    */
/* ------------------------------------------------------------------ */
// Vorher hing Leaflet als statisches Script in addToHead(); die App wartete
// dann in einer 80×100-ms-Polling-Schleife auf `window.L`. Jetzt lädt ein
// richtiger Loader mit onload/onerror — kein Polling, echter Fehlerpfad.
function ladeLeaflet() {
  return new Promise(function (resolve, reject) {
    if (typeof L !== "undefined") {
      resolve();
      return;
    }
    if (!document.getElementById("sp-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "sp-leaflet-css";
      link.rel = "stylesheet";
      link.href = "vendor/leaflet/leaflet.css";
      document.head.appendChild(link);
    }
    const src = "vendor/leaflet/leaflet.js";
    const fehler = function () {
      reject(new Error("Leaflet konnte nicht geladen werden."));
    };
    const vorhanden = document.querySelector('script[src="' + src + '"]');
    if (vorhanden) {
      if (vorhanden.spGeladen) {
        resolve();
        return;
      }
      vorhanden.addEventListener("load", function () { resolve(); });
      vorhanden.addEventListener("error", fehler);
      return;
    }
    const script = document.createElement("script");
    script.id = "sp-leaflet-js";
    script.src = src;
    script.onload = function () {
      script.spGeladen = true;
      resolve();
    };
    script.onerror = fehler;
    document.head.appendChild(script);
  });
}

/* ------------------------------------------------------------------ */
/*  Leaflet laden, dann App initialisieren                              */
/* ------------------------------------------------------------------ */
function waitForLeafletThenInit(data, container, uid, state) {
  // Zwei Argumente statt .catch(): ein Fehler in initApp wird sonst vom
  // Loader-Fehlerpfad geschluckt und als „Leaflet konnte nicht geladen
  // werden“ fehletikettiert.
  ladeLeaflet().then(
    function () {
      // F-70: waehrend des Ladens kann die Instanz abgebaut worden sein.
      if (state.disposed) return;
      // F-156: Markerbild-Basis explizit setzen; sonst leitet Leaflet sie aus dem
      // ggf. noch nicht geladenen leaflet.css ab und merkt sich einen falschen Pfad.
      L.Icon.Default.imagePath = new URL("vendor/leaflet/images/", document.baseURI).href;
      initApp(data, container, uid, state);
    },
    function (error) {
      console.warn("Spielplatz-Finder:", error);
      if (state.disposed) return;
      // SP-B3: Der Fehlerzustand war halbfertig — colspan passte nicht zur
      // 7-spaltigen Tabelle, und Spinner/„Lade Daten …“ blieben stehen (F-98).
      const tbody = container.querySelector(`#sp-tbody-${uid}`);
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="text-danger text-center">Leaflet konnte nicht geladen werden.</td></tr>';
      }
      const spinner = container.querySelector(`#sp-data-spinner-${uid}`);
      if (spinner) spinner.style.display = "none";
      const count = container.querySelector(`#sp-count-${uid}`);
      if (count) count.textContent = "";
      const mapStatus = container.querySelector(`#sp-map-status-${uid}`);
      if (mapStatus) mapStatus.textContent = "Keine Karte: Kartendarstellung nicht verfuegbar.";
    },
  );
}

/* ------------------------------------------------------------------ */
/*  CSV-Parser (quote-sicher, Semikolon/Komma)                         */
/* ------------------------------------------------------------------ */
function parseCSV(text) {
  if (!text || !text.trim()) return [];

  const records = splitCSVRecords(text);
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
  // F-135: Quotes bis zur Feldauswertung erhalten, nur äußere Zeilen trennen.
  const records = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      current += ch;
      if (inQuotes && text[i + 1] === '"') current += text[++i];
      else inQuotes = !inQuotes;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim()) records.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (inQuotes) throw new Error("CSV enthält nicht geschlossene Anführungszeichen.");
  if (current.trim()) records.push(current);
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
/*  Vorberechnete Koordinaten der Standardquelle                       */
/* ------------------------------------------------------------------ */
// Die Berlin-CSV enthält keine Koordinaten. Damit die Standardquelle ohne
// Nominatim-Anfragen auskommt, liegen hier die Flächenschwerpunkte der
// Spielplätze, Schlüssel ist das CSV-Feld `name` (= WFS-Feld `namenr`).
// Quelle: Geoportal Berlin, WFS-Dienst „Grünanlagen“ (URL im README),
// Layer gruenanlagen:spielplaetze (EPSG:4326), Bezirk Steglitz-Zehlendorf,
// Stand 2026-10-15. Lizenz: Datenlizenz Deutschland – Zero – Version 2.0
// (dl-de/zero-2-0). „Marshallstraße 3 SP“ fehlt im WFS und wird per Adresse
// geokodiert. Format: { "<name>": [lat, lng] }.
const VORBERECHNETE_KOORDINATEN = {
  "Am Erlenbusch SP": [52.464327, 13.302443],
  "Breitenbachplatz SP": [52.467050, 13.308672],
  "Buchsweilerstraße SP": [52.443578, 13.280684],
  "Dreipfuhlpark SP": [52.445144, 13.271221],
  "Edwin-Redslob-Straße SP": [52.459478, 13.295725],
  "Kaiser-Wilhelm-Platz SP": [52.464485, 13.297965],
  "Messelpark SP": [52.464697, 13.293011],
  "Bernkastler Platz SP": [52.440168, 13.346042],
  "Calandrellistraße 51 SP": [52.441599, 13.338737],
  "Dillgesstraße 11 SP": [52.434922, 13.341097],
  "Dorfaue Alt-Lankwitz SP": [52.439466, 13.352877],
  "Ahlener Weg SP -2/2": [52.411298, 13.303613],
  "Asternplatz SP": [52.448689, 13.304615],
  "Augustaplatz SP": [52.442651, 13.307387],
  "Begonienplatz SP -1/2": [52.451155, 13.310864],
  "Brauerplatz SP": [52.424012, 13.321236],
  "Eduard-Spranger-Promenade SP -1/2": [52.432781, 13.315468],
  "Finckensteinallee 170 SP": [52.432890, 13.280348],
  "Lipaerstraße 28-29 SP": [52.445444, 13.312377],
  "Marschnerstraße 44-46 SP": [52.443774, 13.316566],
  "Platz der US-Berlin-Brigade SP": [52.419727, 13.283880],
  "Schloßpark Lichterfelde SP -1/2": [52.439791, 13.318649],
  "Sonneberger Weg 29a SP": [52.422603, 13.331037],
  "Stubenrauchstraße 14b SP": [52.441824, 13.300945],
  "Pfeddersheimer Weg SP": [52.427506, 13.209126],
  "Potsdamer Chaussee 66 C SP": [52.422118, 13.201138],
  "Von-der-Trenck-Straße 10 SP": [52.421428, 13.200355],
  "Dubrowplatz SP": [52.435156, 13.221355],
  "Klopstockstraße SP": [52.441473, 13.227093],
  "Paul-Ernst-Park SP": [52.439757, 13.210765],
  "Wasgenstraße SP": [52.430703, 13.214246],
  "Althoffplatz SP": [52.456837, 13.331686],
  "Althoffstraße 22 SP": [52.457459, 13.327649],
  "Carmerplatz SP": [52.452606, 13.320664],
  "Friedrichsruher Platz SP": [52.458813, 13.336526],
  "Lenbachstraße 10 SP": [52.465587, 13.338203],
  "Markusplatz SP": [52.448678, 13.342439],
  "Martinstraße 9 SP": [52.452523, 13.323268],
  "Munsterdamm 89 SP": [52.458226, 13.347849],
  "Ruth-Andreas-Friedrich-Park SP -1/2": [52.455139, 13.309440],
  "Ruth-Andreas-Friedrich-Park SP -2/2": [52.455405, 13.310596],
  "Sachsenwaldstraße 4 SP": [52.463147, 13.340513],
  "Südendstraße 24 SP": [52.455490, 13.333688],
  "Dampferanlegestelle Wannsee SP": [52.421286, 13.175605],
  "Steinstücken SP": [52.390173, 13.128685],
  "Bolchener Straße SP": [52.433394, 13.277076],
  "Breitensteinweg SP": [52.409589, 13.257771],
  "Brettnacher Straße SP": [52.436599, 13.278156],
  "Gemeindewäldchen SP": [52.435441, 13.248446],
  "Hoffbauerpfad SP": [52.419145, 13.255711],
  "Jaehnstraße SP": [52.440126, 13.241159],
  "Mörchinger Straße SP -1/2": [52.437995, 13.278119],
  "Nieritzweg SP": [52.415487, 13.253539],
  "Paul-Mebes-Park SP": [52.432067, 13.246250],
  "Ramsteinweg SP": [52.413959, 13.255307],
  "Schönower Park SP": [52.427692, 13.263256],
  "Schönower Straße 5 SP": [52.429283, 13.257635],
  "Werner-Sylten-Weg SP": [52.413406, 13.264635],
  "Windsteiner Weg SP": [52.412408, 13.256554],
  "Heinrich-Laehr-Park SP -2/2": [52.412953, 13.270133],
  "Heinrich-Laehr-Park SP -1/2": [52.413961, 13.269776],
  "Am Eichgarten- / Borstellpromenade SP": [52.445269, 13.342723],
  "Schloßpark Lichterfelde SP -2/2": [52.438594, 13.316958],
  "Yehudi-Menuhin-Park SP": [52.426476, 13.219877],
  "Schilfluch- / Moorgraben SP": [52.414630, 13.296891],
  "Rathaus Lankwitz SP -2/2": [52.437940, 13.341823],
  "Teltowkanalpromenade SP": [52.429933, 13.309335],
  "Apoldaer Straße SP -1/2": [52.419723, 13.343884],
  "Krumme Lanke SP - Argentinische Allee": [52.448682, 13.246164],
  "Fregestraße 39 SP": [52.464222, 13.332796],
  "Mörchinger Straße SP -2/2": [52.438342, 13.278928],
  "Grünzug Düppel-Süd SP -1/2": [52.422207, 13.233531],
  "Döhlauer Pfad SP": [52.438456, 13.361703],
  "Johann-Baptist-Gradl-Grünanlage SP -1/4": [52.415453, 13.321451],
  "Johann-Baptist-Gradl-Grünanlage SP -2/4": [52.414901, 13.321933],
  "Rütliplatz SP": [52.425742, 13.291993],
  "Elisabethstraße 37 SP": [52.432043, 13.334263],
  "Rathaus Lankwitz SP -1/2": [52.437837, 13.343885],
  "Bäkepark SP -3/3": [52.444957, 13.326427],
  "Echtermeyerstraße SP": [52.432558, 13.272197],
  "Paulsenstraße 22a SP": [52.463506, 13.313848],
  "Stewardstraße SP": [52.452583, 13.263336],
  "Altdorfer Straße 1 SP": [52.428604, 13.306058],
  "Schopenhauerstraße SP": [52.437131, 13.220026],
  "Ahornstraße 3 SP": [52.433991, 13.253011],
  "Lützelsteiner Weg SP": [52.446705, 13.271213],
  "Königstraße 36 SP": [52.432895, 13.251784],
  "Pappritz- / Wichurastraße SP -2/4": [52.427141, 13.360634],
  "Thielpark und Triestpark SP -1/2": [52.448761, 13.284775],
  "Peschkestraße 11 SP": [52.464431, 13.332146],
  "Am Bäkequell SP": [52.452806, 13.316636],
  "Waltershauser Straße SP": [52.424736, 13.346063],
  "Schäferstraße SP": [52.411521, 13.136795],
  "Charkiw-Park SP": [52.457079, 13.318148],
  "Sembritzkistraße 24 SP": [52.452356, 13.352058],
  "Curtiusstraße 14 SP": [52.442344, 13.293566],
  "Bäkepark SP -1/3": [52.447537, 13.320454],
  "Taylorstraße SP": [52.456195, 13.267474],
  "Thielpark und Triestpark SP -2/2": [52.453368, 13.281306],
  "Külzer Straße 3 SP": [52.458846, 13.332473],
  "Marga-Meusel-Platz SP": [52.438186, 13.238474],
  "Keffenbrinkweg SP": [52.430890, 13.363145],
  "Georg-von-Siemens-Park SP": [52.449373, 13.358652],
  "Lauenburger Platz SP": [52.460953, 13.338510],
  "Harry-Bresslau-Park SP": [52.463706, 13.321267],
  "Johann-Baptist-Gradl-Grünanlage SP -4/4": [52.411417, 13.325760],
  "Osdorfer Straße 90-91 SP": [52.410824, 13.322331],
  "Ahlener Weg SP -1/2": [52.410631, 13.304615],
  "Schönhauser Straße 9 SP": [52.461136, 13.334992],
  "Pappritz- / Wichurastraße SP -3/4": [52.430117, 13.362226],
  "Grünzug am Buschgraben SP": [52.421763, 13.244693],
  "Grünzug Düppel-Süd SP -2/2": [52.422535, 13.241598],
  "Lepsiusstraße 10 SP": [52.465719, 13.321407],
  "Breite Straße 6 SP": [52.453344, 13.326634],
  "Gemeindepark Lankwitz SP": [52.431759, 13.347981],
  "Kaulbachstraße 55 SP": [52.438132, 13.338887],
  "Kolonie Königsgraben SP": [52.422903, 13.351616],
  "Kolonie Schweizerland SP": [52.423462, 13.286405],
  "Rathaus Lichterfelde Ost SP": [52.429054, 13.316939],
  "Pappritz- / Wichurastraße SP -1/4": [52.422980, 13.359809],
  "Lilienthal-Gedenkstätte SP -2/2": [52.414020, 13.337992],
  "Karlplatz SP": [52.438155, 13.295638],
  "Bäkepark SP -2/3": [52.447360, 13.322862],
  "Breisgauer Straße 1 C SP": [52.440202, 13.216905],
  "Johann-Baptist-Gradl-Grünanlage SP -3/4": [52.413365, 13.323354],
  "Elisabeth-Bergner-Park SP": [52.465236, 13.315980],
  "Lilienthal-Gedenkstätte SP -1/2": [52.412278, 13.328960],
  "Stadtpark Steglitz SP -2/3": [52.448398, 13.333305],
  "Fischtalpark SP -1/2": [52.443078, 13.255760],
  "Stadtpark Steglitz SP -1/3": [52.447313, 13.335414],
  "Apoldaer Straße SP -2/2": [52.420391, 13.344074],
  "Begonienplatz SP -2/2": [52.451644, 13.311086],
  "Stadtpark Steglitz SP -3/3": [52.447721, 13.330338],
  "Potsdamer Straße 5 SP (Steglitz)": [52.433864, 13.302605],
  "Pappritz- / Wichurastraße SP -4/4": [52.427799, 13.361906],
  "Fischtalpark SP -2/2": [52.450232, 13.262215],
  "Straße Zum Löwen SP": [52.426852, 13.159001],
};

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

  // Ermittelte Adresskoordinaten überdauern das Neuladen, damit Nominatim
  // dieselbe Adresse nicht erneut beantworten muss.
  const GEOCODE_SPEICHER_KEY = "odas-spielplatz-geocode-v1";
  const geocodeCache = new Map(Object.entries(leseGeocodeSpeicher()));
  const geocodeInFlight = new Set();
  const markerByKey = new Map();
  let latestRowsByKey = new Map();
  let selectedRowKey = "";
  let pendingFocusKey = "";
  let renderScheduled = false;
  let currentPage = 1;
  // Kartenausschnitt nur nach Filter-/Seitenwechsel anpassen, nicht bei jeder
  // eintreffenden Geokodierung (sonst springt die Karte).
  let kartenausschnittAnpassen = true;

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
    if (Object.prototype.hasOwnProperty.call(VORBERECHNETE_KOORDINATEN, sp.name)) {
      return VORBERECHNETE_KOORDINATEN[sp.name];
    }
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
    if (!response.ok) {
      const error = new Error("Nominatim: HTTP " + response.status);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) return null;

    const lat = parseCoordinate(payload[0].lat);
    const lon = parseCoordinate(payload[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lat, lon];
  }

  // SP-B4: Nominatim erlaubt rund eine Anfrage pro Sekunde und keine
  // Parallel-Bursts. Vorher startete jeder Render bis zu 8 Anfragen gleichzeitig
  // (und jeder Tastendruck einen Render) — das riskierte eine Sperrung.
  // Jetzt wartet eine Warteschlange und arbeitet sequenziell mit Abstand.
  // Der Abstand gilt zwischen zwei Anfrage-Starts, auch wenn ein Render
  // zwischendurch neue Aufträge einreiht; nach HTTP 429 pausiert die
  // Warteschlange 60 s. Fehler werden nicht gecacht, die Adresse wird beim
  // nächsten Render erneut eingereiht.
  const GEOCODE_ABSTAND_MS = 1100;
  const GEOCODE_PAUSE_429_MS = 60000;
  const geocodeWarteschlange = [];
  let geocodeLaeuft = false;
  let naechsterStartMs = 0;

  function leseGeocodeSpeicher() {
    try {
      const daten = JSON.parse(localStorage.getItem(GEOCODE_SPEICHER_KEY) || "{}");
      return daten && typeof daten === "object" ? daten : {};
    } catch (_e) {
      return {};
    }
  }

  function speichereGeocode(key, coords) {
    try {
      const daten = leseGeocodeSpeicher();
      daten[key] = coords;
      localStorage.setItem(GEOCODE_SPEICHER_KEY, JSON.stringify(daten));
    } catch (_e) {}
  }

  function pumpeGeocodeWarteschlange() {
    if (geocodeLaeuft || state.disposed || state.geocodePumpTimer) return;
    if (geocodeWarteschlange.length === 0) return;
    const warte = naechsterStartMs - Date.now();
    if (warte > 0) {
      state.geocodePumpTimer = setTimeout(function () {
        state.geocodePumpTimer = null;
        pumpeGeocodeWarteschlange();
      }, warte);
      return;
    }
    const auftrag = geocodeWarteschlange.shift();
    geocodeLaeuft = true;
    naechsterStartMs = Date.now() + GEOCODE_ABSTAND_MS;
    geocodeAddress(auftrag.query)
      .then(function (coords) {
        if (state.geocodeToken !== auftrag.token) return;
        geocodeCache.set(auftrag.key, coords);
        speichereGeocode(auftrag.key, coords);
      })
      .catch(function (error) {
        if (error && error.status === 429) {
          naechsterStartMs = Date.now() + GEOCODE_PAUSE_429_MS;
        }
      })
      .finally(function () {
        geocodeInFlight.delete(auftrag.key);
        geocodeLaeuft = false;
        if (state.geocodeToken !== auftrag.token) return;
        pumpeGeocodeWarteschlange();
        scheduleRender();
      });
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
    geocodeWarteschlange.push({ key: key, query: query, token: state.geocodeToken });
    pumpeGeocodeWarteschlange();
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
    } else if (bounds.length > 0 && kartenausschnittAnpassen) {
      kartenausschnittAnpassen = false;
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
      filtered.length + (filtered.length === 1 ? " Spielplatz" : " Spielplätze") + " gefunden";

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

    // Nur Adressen der aktuellen Seite geokodieren; ältere Aufträge verwerfen.
    const seitenKeys = new Set(paged.map(geocodeKey));
    for (let i = geocodeWarteschlange.length - 1; i >= 0; i--) {
      if (!seitenKeys.has(geocodeWarteschlange[i].key)) {
        geocodeInFlight.delete(geocodeWarteschlange[i].key);
        geocodeWarteschlange.splice(i, 1);
      }
    }

    renderMap(paged);
  }

  // --- Event-Listener ---
  function resetPageAndRender() {
    currentPage = 1;
    kartenausschnittAnpassen = true;
    render();
  }

  // SP-B4: Suche entprellen — jeder Tastendruck baute sonst die ganze Tabelle
  // plus Marker (und Geocode-Aufträge) neu auf.
  function entprellt(fn, millis) {
    let timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        if (state.disposed) return;
        fn();
      }, millis);
    };
  }

  container
    .querySelector("#sp-search-" + uid)
    .addEventListener("input", entprellt(resetPageAndRender, 300));
  ["sp-ortsteil-" + uid, "sp-art-" + uid].forEach(function (id) {
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
      kartenausschnittAnpassen = true;
      render();
    }
  });
  nextBtn.addEventListener("click", function () {
    currentPage++;
    kartenausschnittAnpassen = true;
    render();
  });

  // --- Erstmalig rendern ---
  render();
}

/*
 * Diese Funktion laedt Bibliotheken und Skripte in den Head.
 * SP-B2: Leaflet wird nicht mehr hier geladen, sondern per ladeLeaflet().
 */
function addToHead() {
  return ``;
}
