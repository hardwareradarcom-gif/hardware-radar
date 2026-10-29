/* Hardware-Radar – Seitenlogik. Lädt data/deals.json, rendert Suche, Kategorien, Karten mit Preisverlauf,
   Werbeflächen (erst nach Zustimmung) und das Cookie-Banner. */
(function () {
  "use strict";
  var CFG = window.HR_CONFIG || {};
  var CATS = ["Grafikkarten", "Prozessoren", "Arbeitsspeicher", "SSDs", "Mainboards", "Monitore", "Netzteile", "Gehäuse", "Kühlung"];
  var SLUG = {}; CATS.forEach(function (c) { SLUG[c.toLowerCase().replace("ä", "ae").replace("ü", "ue")] = c; });
  var state = { q: "", cat: "Alle", sort: "deal" };
  var deals = [];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Hilfsfunktionen ---------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function eur0(n) { return Math.round(n).toLocaleString("de-DE") + " €"; }
  function dshort(s) { var p = s.split("-"); return p[2] + "." + p[1] + "." + p[0].slice(2); }
  function pct(x) { return (x * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, signDisplay: "exceptZero" }) + " %"; }
  function safeUrl(u) { try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x : null; } catch (e) { return null; } }

  /* Fremde Tracking-Kennungen entfernen und eigene Partner-ID anhängen */
  var STRIP = ["tag", "ascsubtag", "linkcode", "linkid", "creative", "creativeasin", "camp", "awc", "smid", "psc", "th", "gclid", "fbclid", "msclkid", "wt_mc", "wt.mc_id", "emid", "affid", "affiliate", "partner", "pid", "clickref", "srsltid"];
  function hostIs(h, dom) { h = h.replace(/^www\./, ""); return h === dom || h.slice(-(dom.length + 1)) === "." + dom; }
  function affiliate(url) {
    var u = safeUrl(url); if (!u) return { href: "#", aff: false, shop: false };
    var A = CFG.affiliate || {};
    var portal = ["mydealz.de", "hardwaredealz.com", "geizhals.de", "geizhals.at", "billiger.de", "idealo.de"].some(function (d) { return hostIs(u.hostname, d); });
    if (portal) return { href: u.toString(), aff: false, shop: false };
    Array.from(u.searchParams.keys()).forEach(function (k) { var l = k.toLowerCase(); if (l.indexOf("utm_") === 0 || STRIP.indexOf(l) > -1) u.searchParams.delete(k); });
    var clean = u.toString();
    if (A.amazonTag && hostIs(u.hostname, "amazon.de")) { u.searchParams.set("tag", A.amazonTag); return { href: u.toString(), aff: true, shop: true }; }
    var m = A.awinMerchants || {};
    for (var dom in m) {
      if (m[dom] && A.awinId && hostIs(u.hostname, dom)) {
        return { href: "https://www.awin1.com/cread.php?awinmid=" + encodeURIComponent(m[dom]) + "&awinaffid=" + encodeURIComponent(A.awinId) + "&ued=" + encodeURIComponent(clean), aff: true, shop: true };
      }
    }
    return { href: clean, aff: false, shop: true };
  }
  /* Direkte Links zu Shops: Produktseite, wenn bekannt, sonst die Shop-Suche nach dem Produktnamen */
  var SHOPS = [
    [/amazon/i, "Amazon", "https://www.amazon.de/s?k="],
    [/mediamarkt/i, "MediaMarkt", "https://www.mediamarkt.de/de/search.html?query="],
    [/saturn/i, "Saturn", "https://www.saturn.de/de/search.html?query="],
    [/alternate/i, "Alternate", "https://www.alternate.de/listing.xhtml?q="],
    [/mindfactory/i, "Mindfactory", "https://www.mindfactory.de/search_result.php?search_query="],
    [/notebooksbilliger|^nbb$/i, "notebooksbilliger.de", "https://www.notebooksbilliger.de/produkte/"],
    [/cyberport/i, "Cyberport", "https://www.cyberport.de/tools/search-results.html?q="],
    [/computeruniverse/i, "computeruniverse", "https://www.computeruniverse.net/de/search?query="],
    [/galaxus/i, "Galaxus", "https://www.galaxus.de/de/search?q="],
    [/alza/i, "Alza", "https://www.alza.de/search.htm?exps="],
    [/proshop/i, "Proshop", "https://www.proshop.de/?s="],
    [/caseking/i, "Caseking", "https://www.caseking.de/search?search="],
    [/jacob/i, "Jacob", "https://www.jacob.de/q/"],
    [/kaufland/i, "Kaufland", "https://www.kaufland.de/s/?search_value="],
    [/conrad/i, "Conrad", "https://www.conrad.de/de/search.html?search="],
    [/reichelt/i, "reichelt", "https://www.reichelt.de/index.html?ACTION=446&SEARCH="],
    [/ebay/i, "eBay", "https://www.ebay.de/sch/i.html?_nkw="]
  ];
  var PORTALS = ["mydealz.de", "hardwaredealz.com", "geizhals.de", "geizhals.at", "geizhals.eu", "billiger.de", "idealo.de", "guenstiger.de", "preisvergleich.heise.de"];
  function isPortal(url) { var u = safeUrl(url); return !!u && PORTALS.some(function (d) { return hostIs(u.hostname, d); }); }
  function shopOf(name) { for (var i = 0; i < SHOPS.length; i++) if (SHOPS[i][0].test(name || "")) return SHOPS[i]; return null; }
  function cleanName(n) { return String(n || "").replace(/\([^)]*\)/g, " ").replace(/["„“]/g, " ").replace(/\s+/g, " ").trim(); }
  /* Liefert {href, label, aff, guess} für einen Shop-Knopf oder null */
  function shopLink(url, shop, name) {
    if (url && !isPortal(url)) { var l = affiliate(url); if (l.shop) return { href: l.href, aff: l.aff, label: shopOf(shop) ? "Zu " + shopOf(shop)[1] : "Zum Shop", guess: false }; }
    var s = shopOf(shop); if (!s) return null;
    var q = encodeURIComponent(cleanName(name)), l2 = affiliate(s[2] + q);
    return { href: l2.href, aff: l2.aff, label: "Zu " + s[1], guess: true };
  }
  function fallbackLink(name) { var l = affiliate("https://www.amazon.de/s?k=" + encodeURIComponent(cleanName(name))); return { href: l.href, aff: l.aff, label: "Bei Amazon suchen", guess: true }; }
  function shopBtn(l, cls) {
    return '<a class="btn ' + cls + '" href="' + esc(l.href) + '" target="_blank" rel="' + relOf(l) + '"' + (l.guess ? ' title="Öffnet die Suche nach diesem Produkt im Shop"' : "") + ">" + esc(l.label) + aff(l) + "</a>";
  }
  function relOf(l) { return l.aff ? "sponsored nofollow noopener" : "nofollow noopener"; }
  function aff(l) { return l.aff ? '<span class="aff">*</span>' : ""; }

  function stats(d) {
    var h = (d.hist || []).filter(function (x) { return x && x.d && typeof x.p === "number"; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    var ps = h.map(function (x) { return x.p; }).concat([d.price]);
    var min = Math.min.apply(null, ps), max = Math.max.apply(null, ps);
    var first = h.length ? h[0].p : d.price;
    var change = first ? (d.price - first) / first : 0;
    var vsMax = max ? (max - d.price) / max : 0;
    var vsRef = d.ref && d.ref > d.price ? (d.ref - d.price) / d.ref : 0;
    var score = Math.max(vsRef, vsMax * 0.8) + (change < 0 ? -change * 0.5 : 0);
    return { h: h, min: min, max: max, change: change, vsRef: vsRef, score: score };
  }


  /* ---------- Produktbilder ---------- */
  var ICON = {
    "Grafikkarten": '<rect x="2" y="6" width="17" height="11" rx="1.5"/><circle cx="8.5" cy="11.5" r="3"/><circle cx="14.5" cy="11.5" r="2"/><path d="M19 9h3v6h-3M5 17v2M9 17v2M13 17v2"/>',
    "Prozessoren": '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    "Arbeitsspeicher": '<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 10v3M10 10v3M14 10v3M18 10v3M4 16v2M20 16v2"/>',
    "SSDs": '<rect x="2" y="8" width="20" height="8" rx="1"/><rect x="6" y="10" width="5" height="4"/><rect x="13" y="10" width="3" height="4"/><circle cx="19.5" cy="12" r="1"/>',
    "Mainboards": '<rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="7" y="7" width="6" height="6"/><path d="M16 6v6M18 6v6M7 16h11M7 18.5h7"/>',
    "Monitore": '<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M12 17v3M8 20h8"/>',
    "Netzteile": '<rect x="2" y="5" width="20" height="14" rx="1.5"/><circle cx="9" cy="12" r="4"/><path d="M9 8v8M5 12h8M16 9h3M16 12h3M16 15h3"/>',
    "Gehäuse": '<rect x="6" y="2" width="12" height="20" rx="1.5"/><circle cx="12" cy="7" r="2"/><circle cx="12" cy="13" r="2"/><path d="M9 18h6"/>',
    "Kühlung": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5"/><path d="M12 10.5C11 7 12.5 4.5 15 4.5M13.5 12c3.5-1 6 .5 6 3M12 13.5c1 3.5-.5 6-3 6M10.5 12c-3.5 1-6-.5-6-3"/>'
  };
  function thumb(d, rank) {
    var u = d.img ? safeUrl(d.img) : null;
    return '<div class="thumb">' + (rank ? '<span class="rank">' + rank + "</span>" : "") +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[d.cat] || ICON["Prozessoren"]) + "</svg>" +
      (u ? '<img src="' + esc(u.toString()) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : "") + "</div>";
  }
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains("thumb")) t.parentNode.removeChild(t);
  }, true);

  var gid = 0;
  function chart(s) {
    var pts = s.h; if (pts.length < 2) return "";
    var W = 300, H = 84, L = 2, R = 6, T = 8, B = 18;
    var t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[pts.length - 1].d), span = Math.max(1, t1 - t0);
    var vals = pts.map(function (p) { return p.p; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { hi += 1; lo -= 1; }
    var pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    var X = function (t) { return L + (W - L - R) * ((t - t0) / span); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var xy = pts.map(function (p) { return [X(Date.parse(p.d)), Y(p.p)]; });
    var line = xy.map(function (q, i) { return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" ");
    var area = line + " L" + xy[xy.length - 1][0].toFixed(1) + " " + (H - B) + " L" + xy[0][0].toFixed(1) + " " + (H - B) + " Z";
    var col = s.change > 0.005 ? "var(--up)" : s.change < -0.005 ? "var(--down)" : "var(--signal)";
    var id = "hrg" + (++gid), last = xy[xy.length - 1];
    var grid = [0, 0.5, 1].map(function (f) { var y = (T + (H - T - B) * f).toFixed(1); return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>'; }).join("");
    var tip = pts.map(function (p) { return dshort(p.d) + ": " + eur(p.p); }).join(" · ");
    var dots = xy.slice(0, -1).map(function (q) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2" fill="' + col + '"/>'; }).join("");
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Preisverlauf: ' + esc(tip) + '"><title>' + esc(tip) + "</title>" +
      '<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".3"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4.5" fill="' + col + '" stroke="var(--surface)" stroke-width="2.5"/>' +
      '<text x="' + L + '" y="' + (H - 4) + '">' + dshort(pts[0].d) + "</text>" +
      '<text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">heute</text></svg>';
  }

  function card(d, rank) {
    var s = stats(d), cls = s.change > 0.005 ? "up" : s.change < -0.005 ? "down" : "flat";
    var pill = "";
    if (s.vsRef > 0.03) pill = '<span class="pill down">−' + Math.round(s.vsRef * 100) + " %</span>";
    else if (s.h.length > 1) pill = '<span class="pill ' + cls + '">' + (s.change <= 0 ? "▼ " : "▲ ") + pct(Math.abs(s.change)).replace("+", "") + "</span>";
    var pos = s.max > s.min ? ((d.price - s.min) / (s.max - s.min)) * 100 : 50;
    var scale = s.h.length > 1
      ? '<div class="scale"><div class="s-head"><span class="k">Preisverlauf</span><span class="d ' + cls + '">' + pct(s.change) + " seit " + dshort(s.h[0].d) + "</span></div>" + chart(s) +
        '<div class="range" title="Wo der heutige Preis zwischen Tief- und Höchstwert liegt"><span>' + eur0(s.min) + '</span><div class="track"><i style="left:' + pos.toFixed(1) + '%"></i></div><span>' + eur0(s.max) + "</span></div>" +
        (d.histLabel ? '<div class="s-src">' + esc(d.histLabel.replace(/^Skala:\s*/, "")) + "</div>" : "") + "</div>"
      : '<div class="scale"><div class="s-head"><span class="k">Preisverlauf</span><span class="d flat">neu im Radar</span></div><div class="s-one">Bisher gibt es nur den heutigen Preis. Die Skala füllt sich mit jeder täglichen Prüfung.</div></div>';
    var main = shopLink(d.shopUrl, d.shop, d.name) || shopLink(d.url, d.shop, d.name) || fallbackLink(d.name);
    var alt = main.label === "Zu Amazon" || main.label === "Bei Amazon suchen" ? null : fallbackLink(d.name);
    return '<article class="card"><div class="c-head">' + thumb(d, rank) +
      '<div class="c-title"><div class="c-cat">' + esc(d.cat) + '</div><h3 class="c-name">' + esc(d.name) + "</h3></div>" + pill + "</div>" +
      '<div><div class="c-price"><span class="now">' + eur(d.price) + "</span>" + (d.ref && d.ref > d.price ? '<span class="was">' + eur(d.ref) + "</span>" : "") + "</div>" +
      '<div class="c-shop">bei <b>' + esc(d.shop) + "</b>" + (d.seen ? " · geprüft " + dshort(d.seen) : "") + "</div></div>" +
      (d.note ? '<p class="c-note">' + esc(d.note) + "</p>" : "") + scale +
      '<div class="c-go">' + shopBtn(main, "primary") + (alt ? shopBtn(alt, "ghost") : "") + "</div></article>";
  }

  /* ---------- Werbung ---------- */
  var adsLoaded = false;
  function consent() { return store("hr-consent"); }
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });

  function adSlotHTML(kind) {
    var id = CFG.adSlots && CFG.adSlots[kind];
    if (CFG.adsenseClient && id && consent() === "granted")
      return '<span class="ad-label">Anzeige</span><ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(CFG.adsenseClient) + '" data-ad-slot="' + esc(id) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    if (CFG.showAdPlaceholders) return '<span class="ad-label">Anzeige</span><div class="ph">Werbefläche (' + (kind === "leaderboard" ? "Banner" : "im Raster") + ")</div>";
    return null;
  }
  function fillAds(root) {
    (root || document).querySelectorAll("[data-ad]:not([data-filled])").forEach(function (el) {
      var html = adSlotHTML(el.getAttribute("data-ad"));
      el.setAttribute("data-filled", "1");
      if (!html) { el.hidden = true; return; }
      el.innerHTML = html; el.hidden = false;
      if (el.querySelector("ins.adsbygoogle")) { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }
    });
  }
  function loadAdsense() {
    if (adsLoaded || !CFG.adsenseClient || consent() !== "granted") return;
    if (document.querySelector('script[src*="adsbygoogle.js"]')) { adsLoaded = true; gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" }); [].forEach.call(document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])"), function () { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }); return; }
    adsLoaded = true;
    gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    var s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(CFG.adsenseClient);
    document.head.appendChild(s);
  }
  function resetAds() { document.querySelectorAll("[data-ad]").forEach(function (el) { el.removeAttribute("data-filled"); el.innerHTML = ""; }); fillAds(); }

  /* ---------- Cookie-Banner ---------- */
  function showConsent(v) { $("consent").hidden = !v; }
  function setConsent(v) {
    store("hr-consent", v); showConsent(false);
    if (v === "granted") loadAdsense();
    else if (adsLoaded) { location.reload(); return; }
    resetAds();
  }
  if (CFG.useBuiltinConsent !== false) {
    $("consent-accept").addEventListener("click", function () { setConsent("granted"); });
    $("consent-deny").addEventListener("click", function () { setConsent("denied"); });
    $("open-consent").addEventListener("click", function () { showConsent(true); $("consent-accept").focus(); });
    if (!consent()) showConsent(true);
  } else {
    $("open-consent").hidden = true;
    store("hr-consent", "granted"); // Einwilligung verwaltet dann Googles Consent-Tool
  }
  loadAdsense();

  /* ---------- Darstellung ---------- */
  var products = [];
  state.view = "deals";
  state.sorts = { deals: "deal", compare: "cat" };
  state.sub = ""; state.pmin = null; state.pmax = null; state.ship = false; state.watchOnly = false;
  var watch = {};
  try { (JSON.parse(store("hr-watch") || "[]") || []).forEach(function (id) { watch[id] = 1; }); } catch (e) {}
  function saveWatch() { store("hr-watch", JSON.stringify(Object.keys(watch))); }
  try { state.ship = store("hr-ship") === "1"; } catch (e) {}

  /* Kapazität aus dem Namen lesen, für € pro GB (RAM) bzw. € pro TB (SSD) */
  function unitInfo(p) {
    var m;
    if (p.cat === "Arbeitsspeicher" && (m = /(\d+)\s*GB/i.exec(p.name))) return { n: +m[1], u: "GB" };
    if (p.cat === "SSDs") {
      if ((m = /(\d+(?:[.,]\d+)?)\s*TB/i.exec(p.name))) return { n: parseFloat(m[1].replace(",", ".")), u: "TB" };
      if ((m = /(\d+)\s*GB/i.exec(p.name))) return { n: +m[1] / 1000, u: "TB" };
    }
    return null;
  }
  /* Günstigstes Angebot, wahlweise nach Gesamtpreis inkl. Versand */
  function eff(p) {
    var offers = (p.offers || []).map(function (o) {
      var known = o.ship != null;
      return { o: o, val: state.ship && known ? o.price + o.ship : o.price, known: known };
    });
    offers.sort(function (a, b) { return a.val - b.val || a.o.price - b.o.price; });
    var best = offers[0] || { o: { price: p.price, shop: p.shop, ship: null }, val: p.price, known: false };
    var ui = unitInfo(p);
    return { list: offers, best: best, price: best.val, unit: ui ? best.val / ui.n : null, uinfo: ui };
  }
  var SORTS = {
    deals: [["deal", "Bester Deal"], ["drop", "Stärkster Preisrückgang"], ["asc", "Preis aufsteigend"], ["desc", "Preis absteigend"]],
    compare: [["cat", "Nach Kategorie"], ["asc", "Preis aufsteigend"], ["desc", "Preis absteigend"], ["unit", "Preis pro GB/TB"], ["spread", "Größte Shop-Unterschiede"], ["new", "Neu im Radar"], ["name", "Name A–Z"]]
  };
  function current() { return state.view === "deals" ? deals : products; }
  function matches(d, words) {
    if (state.cat !== "Alle" && d.cat !== state.cat) return false;
    if (d.offers) {
      if (state.sub && (d.sub || "") !== state.sub) return false;
      if (state.watchOnly && !watch[d.id]) return false;
      if (state.pmin != null || state.pmax != null) {
        var ep = eff(d).price;
        if (state.pmin != null && ep < state.pmin) return false;
        if (state.pmax != null && ep > state.pmax) return false;
      }
    }
    var hay = (d.name + " " + d.cat + " " + (d.sub || "") + " " + (d.shop || "") + " " + (d.tags || "")).toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) > -1; });
  }

  function renderPulse(p) {
    $("pulse").innerHTML = (p || []).slice(0, 3).map(function (x) {
      return '<div><div class="v ' + esc(x.trend || "") + '">' + esc(x.value) + '</div><div class="l">' + esc(x.label) + '</div><div class="s">' + esc(x.source || "") + "</div></div>";
    }).join("");
  }
  function renderChips() {
    var items = current(), counts = { Alle: items.length };
    CATS.forEach(function (c) { counts[c] = items.filter(function (d) { return d.cat === c; }).length; });
    $("chips").innerHTML = ["Alle"].concat(CATS).filter(function (c) { return c === "Alle" || counts[c] || state.cat === c; }).map(function (c) {
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '<span class="n">' + (counts[c] || 0) + "</span></button>";
    }).join("");
  }
  function renderSortOptions() {
    var sel = $("sort");
    sel.innerHTML = SORTS[state.view].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
    sel.value = state.sorts[state.view];
  }
  function renderTop() {
    var seen = {}, top = [];
    deals.slice().sort(function (a, b) { return stats(b).score - stats(a).score; }).forEach(function (d) {
      if (top.length < 3 && !seen[d.cat]) { seen[d.cat] = 1; top.push(d); }
    });
    $("top").innerHTML = top.map(function (d, i) { return card(d, i + 1); }).join("");
  }

  function ageDays(stand) { var t = Date.parse(stand); return isFinite(t) ? (Date.now() - t) / 864e5 : 0; }
  function dlong(stand) { var t = new Date(stand); return isFinite(t) ? t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : ""; }
  function shipText(o) { return o.ship == null ? "–" : o.ship === 0 ? "frei" : eur(o.ship); }

  function isNew(p) { var t = Date.parse(p.firstSeen || ""); return isFinite(t) && (Date.now() - t) / 864e5 <= 3; }
  function productRow(p) {
    var e = eff(p), ranked = e.list;
    var offers = (p.offers || []).slice().sort(function (a, b) { return a.price - b.price; });
    var best = e.best.o;
    var n = offers.length, stale = ageDays(p.stand) > 7;
    var lo = offers.length ? offers[0].price : p.price, hi = offers.length ? offers[offers.length - 1].price : p.price;
    var spread = n > 1 ? '<div class="spread" title="Preisspanne der verglichenen Shops"><span>' + eur0(lo) + '</span><div class="rail">' +
      offers.map(function (o) { var x = hi > lo ? (o.price - lo) / (hi - lo) * 100 : 50; return '<i class="' + (o === best ? "best" : "") + '" style="left:' + x.toFixed(1) + '%"></i>'; }).join("") +
      "</div><span>" + eur0(hi) + "</span></div>" : "";
    var srcName = p.source === "Geizhals" ? "Geizhals" : p.source === "hardwaredealz" ? "hardwaredealz" : p.source === "mydealz" ? "mydealz" : "öffentlichen Preisvergleichen";
    var bestLink = shopLink(best.url, best.shop, p.name);
    if (!bestLink) ranked.some(function (r) { var l = shopLink(r.o.url, r.o.shop, p.name); if (l) { bestLink = l; bestLink.label = "Zu " + (shopOf(r.o.shop) || [0, r.o.shop])[1]; return true; } return false; });
    if (!bestLink) bestLink = shopLink(p.url, p.shop, p.name) || fallbackLink(p.name);
    var hist = stats({ price: p.price, hist: p.hist });
    var histHtml = hist.h.length > 1 ? '<div class="p-hist"><div class="s-head"><span class="k">Preisverlauf</span><span class="d ' + (hist.change > 0.005 ? "up" : hist.change < -0.005 ? "down" : "flat") + '">' + pct(hist.change) + " seit " + dshort(hist.h[0].d) + "</span></div>" + chart(hist) + "</div>"
      : '<p class="c-note" style="margin-top:10px">Preisverlauf startet am ' + dshort((p.hist && p.hist[0] && p.hist[0].d) || p.stand.slice(0, 10)) + " und wächst mit jeder täglichen Prüfung.</p>";
    var rows = ranked.map(function (r, i) {
      var o = r.o, total = o.ship == null ? null : o.price + o.ship;
      var ol = shopLink(o.url, o.shop, p.name);
      return '<tr class="' + (i === 0 ? "best" : "") + '"><td>' + esc(o.shop) + (i === 0 ? '<span class="tag-best">günstigster</span>' : "") + '</td><td class="num">' + eur(o.price) + '</td><td class="num">' + shipText(o) + '</td><td class="num">' + (total == null ? '<span class="unk">unbekannt</span>' : eur(total)) + "</td><td>" + esc(o.avail || "–") + '</td><td class="go">' + (ol ? '<a href="' + esc(ol.href) + '" target="_blank" rel="' + relOf(ol) + '">' + esc(ol.label) + aff(ol) + "</a>" : "") + "</td></tr>";
    }).join("");
    var id = "of-" + esc(p.id);
    return '<article class="prod"><div class="prod-main">' +
      '<div class="p-left">' + thumb(p) + '<div class="p-info"><span class="p-sub">' + esc(p.sub || p.cat) + (isNew(p) ? '<span class="new-badge">neu</span>' : "") + '</span><h4 class="p-name">' + esc(p.name) + "</h4>" +
      '<div class="p-meta"><span>' + (n > 1 ? n + " Shops verglichen" : "1 Angebot") + (p.count ? " · " + p.count + " Angebote insgesamt" : "") + "</span><span>Stand " + dlong(p.stand) + "</span>" + (stale ? '<span class="stale">Preis älter als 7 Tage</span>' : "") + "</div>" + spread + "</div></div>" +
      '<div class="p-price"><span class="from">' + (state.ship && e.best.known ? "ab, inkl. Versand" : "ab") + '</span><span class="val">' + eur(e.price) + '</span><span class="at">bei <b>' + esc(best.shop) + "</b>" + (state.ship ? (e.best.known ? "" : " · Versand unbekannt") : best.ship != null ? " · Versand " + shipText(best) : "") + "</span>" +
      (e.unit != null ? '<span class="unit">' + eur(e.unit) + " pro " + e.uinfo.u + "</span>" : "") + "</div>" +
      '<div class="p-actions"><button type="button" class="star" data-watch="' + esc(p.id) + '" aria-pressed="' + !!watch[p.id] + '" aria-label="' + (watch[p.id] ? "Von Merkliste entfernen" : "Auf die Merkliste") + '" title="Merkliste"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg></button>' + (n > 1 || p.note ? '<button type="button" class="btn ghost" aria-expanded="false" aria-controls="' + id + '" data-toggle="' + id + '">Shops ansehen <span class="chev">▾</span></button>' : "") +
      shopBtn(bestLink, "primary") + "</div></div>" +
      '<div class="offers" id="' + id + '" hidden>' + (n ? '<div class="offers-scroll"><table><thead><tr><th>Shop</th><th class="num">Preis</th><th class="num">Versand</th><th class="num">Gesamt</th><th>Lieferung</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>" : "") +
      (p.note ? '<p class="c-note" style="margin-top:10px">' + esc(p.note) + "</p>" : "") + histHtml +
      '<div class="foot"><span>Preise laut ' + srcName + ", Stand " + dlong(p.stand) + " Maßgeblich ist der Preis im Shop." + (bestLink.guess ? " Shop-Links öffnen die Produktsuche im jeweiligen Shop." : "") + "</span></div></div></article>";
  }

  function renderCompare(list) {
    var sort = state.sorts.compare, html = "";
    var E = new Map(list.map(function (p) { return [p, eff(p)]; }));
    function spreadOf(p) { var o = p.offers || []; if (o.length < 2) return -1; var ps = o.map(function (x) { return x.price; }); return (Math.max.apply(null, ps) - Math.min.apply(null, ps)) / Math.min.apply(null, ps); }
    var by = {
      cat: function (a, b) { return CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || E.get(a).price - E.get(b).price; },
      asc: function (a, b) { return E.get(a).price - E.get(b).price; },
      desc: function (a, b) { return E.get(b).price - E.get(a).price; },
      unit: function (a, b) { var ua = E.get(a).unit, ub = E.get(b).unit; if (ua == null && ub == null) return E.get(a).price - E.get(b).price; if (ua == null) return 1; if (ub == null) return -1; return (E.get(a).uinfo.u === E.get(b).uinfo.u ? 0 : E.get(a).uinfo.u === "GB" ? -1 : 1) || ua - ub; },
      spread: function (a, b) { return spreadOf(b) - spreadOf(a); },
      name: function (a, b) { return a.name.localeCompare(b.name, "de"); },
      new: function (a, b) { return (b.firstSeen || "").localeCompare(a.firstSeen || "") || E.get(a).price - E.get(b).price; }
    }[sort];
    list.sort(by);
    if (sort === "cat") {
      CATS.forEach(function (c) {
        var g = list.filter(function (p) { return p.cat === c; });
        if (!g.length) return;
        var limit = state.cat === "Alle" && !state.q.trim() && !state.watchOnly && state.pmin == null && state.pmax == null ? 8 : Infinity;
        var shown = g.slice(0, limit);
        html += '<div class="cmp-group"><h3>' + esc(c) + '<span class="n">' + g.length + '</span></h3><div class="cmp-list">' + shown.map(productRow).join("") + "</div>" +
          (g.length > shown.length ? '<button type="button" class="btn ghost more" data-showcat="' + esc(c) + '">Alle ' + g.length + " " + esc(c) + " anzeigen</button>" : "") + "</div>";
      });
    } else if (list.length) {
      html = '<div class="cmp-group"><div class="cmp-list">' + list.map(productRow).join("") + "</div></div>";
    }
    if (list.length > 6) html += '<div class="ad leaderboard" data-ad="leaderboard" hidden></div>';
    $("compare").innerHTML = html;
    fillAds($("compare"));
  }

  function renderDeals(list) {
    var S = new Map(list.map(function (d) { return [d, stats(d)]; }));
    var by = {
      deal: function (a, b) { return S.get(b).score - S.get(a).score; },
      drop: function (a, b) { return S.get(a).change - S.get(b).change; },
      asc: function (a, b) { return a.price - b.price; },
      desc: function (a, b) { return b.price - a.price; }
    }[state.sorts.deals];
    list.sort(by);
    var every = Math.max(3, CFG.infeedEvery || 9), html = "";
    list.forEach(function (d, i) {
      html += card(d);
      if ((i + 1) % every === 0 && i < list.length - 1) html += '<div class="ad infeed" data-ad="infeed" hidden></div>';
    });
    $("grid").innerHTML = html;
    fillAds($("grid"));
  }

  function renderTools() {
    if (state.view !== "compare") return;
    var subs = [];
    if (state.cat !== "Alle") products.forEach(function (p) { if (p.cat === state.cat && p.sub && subs.indexOf(p.sub) < 0) subs.push(p.sub); });
    subs.sort(function (a, b) { return a.localeCompare(b, "de", { numeric: true }); });
    var sc = $("subchips");
    sc.hidden = subs.length < 2;
    sc.innerHTML = subs.length < 2 ? "" : ['<button type="button" class="chip" data-sub="" aria-pressed="' + !state.sub + '">Alle ' + esc(state.cat) + "</button>"].concat(subs.map(function (x) {
      var n = products.filter(function (p) { return p.cat === state.cat && p.sub === x; }).length;
      return '<button type="button" class="chip" data-sub="' + esc(x) + '" aria-pressed="' + (state.sub === x) + '">' + esc(x) + '<span class="n">' + n + "</span></button>";
    })).join("");
    var nw = Object.keys(watch).filter(function (id) { return products.some(function (p) { return p.id === id; }); }).length;
    $("n-watch").textContent = nw;
    $("watchonly").setAttribute("aria-pressed", state.watchOnly);
    $("withship").checked = state.ship;
    $("reset-tools").hidden = !(state.sub || state.pmin != null || state.pmax != null || state.watchOnly);
  }

  function render() {
    renderChips();
    renderTools();
    var isDeals = state.view === "deals";
    document.querySelectorAll("[data-view]").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== state.view; });
    $("tab-deals").setAttribute("aria-selected", isDeals);
    $("tab-compare").setAttribute("aria-selected", !isDeals);
    var q = state.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    var items = current(), list = items.filter(function (d) { return matches(d, words); });
    if (isDeals) renderDeals(list); else renderCompare(list);

    var ws = $("websearch"); ws.hidden = !q;
    if (q) {
      var e = encodeURIComponent(state.q.trim());
      $("ws-amazon").href = affiliate("https://www.amazon.de/s?k=" + e).href;
      $("ws-mediamarkt").href = affiliate("https://www.mediamarkt.de/de/search.html?query=" + e).href;
      $("ws-alternate").href = affiliate("https://www.alternate.de/listing.xhtml?q=" + e).href;
      $("ws-mindfactory").href = affiliate("https://www.mindfactory.de/search_result.php?search_query=" + e).href;
    }
    var other = isDeals ? products : deals;
    var otherHits = q ? other.filter(function (d) { return matches(d, words); }).length : 0;
    var empty = $("empty");
    empty.hidden = list.length > 0 || !items.length;
    if (!list.length && items.length) empty.innerHTML = "<h3>Kein Treffer" + (q ? " für „" + esc(state.q.trim()) + "“" : " in " + esc(state.cat)) + "</h3><p>" +
      (otherHits ? 'Im Bereich <a href="#' + (isDeals ? "preisvergleich" : "deals") + '">' + (isDeals ? "Preisvergleich" : "Deals") + "</a> gibt es " + otherHits + " Treffer. " : "") +
      "Probier einen kürzeren Begriff oder such über die Links oben direkt in den Shops.</p>";
    if (!list.length && !isDeals && state.watchOnly) empty.innerHTML = "<h3>Noch nichts auf der Merkliste" + (state.cat !== "Alle" || q ? " für diese Auswahl" : "") + "</h3><p>Tippe bei einem Produkt auf den Stern, um es zu merken. Die Merkliste bleibt in diesem Browser gespeichert.</p>";
    else if (!list.length && !isDeals && (state.pmin != null || state.pmax != null)) empty.innerHTML = "<h3>Kein Produkt in dieser Preisspanne</h3><p>Erweitere die Spanne oder setze die Filter zurück.</p>";
    var label = isDeals ? " Angeboten" : " Produkten";
    $("results-meta").textContent = list.length + " von " + items.length + label + (state.cat !== "Alle" ? " in " + state.cat : "") + (q ? " für „" + state.q.trim() + "“" : "") +
      (otherHits ? " · " + otherHits + " weitere im " + (isDeals ? "Preisvergleich" : "Bereich Deals") : "");
  }

  /* ---------- Bedienung ---------- */
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (h === "preisvergleich") state.view = "compare";
    else if (h === "deals" || !h) state.view = "deals";
    else return false;
    return true;
  }
  try { var ss = JSON.parse(store("hr-sorts") || "{}"); ["deals", "compare"].forEach(function (k) { if (ss[k] && SORTS[k].some(function (o) { return o[0] === ss[k]; })) state.sorts[k] = ss[k]; }); } catch (e) {}
  fromHash();
  function markTabbar() { var v = state.view; [].forEach.call(document.querySelectorAll(".tabbar a"), function (x) { if (x.getAttribute("data-v") === v) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); }); }
  markTabbar();
  renderSortOptions();
  $("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
  $("sort").addEventListener("change", function (e) { state.sorts[state.view] = e.target.value; store("hr-sorts", JSON.stringify(state.sorts)); render(); });
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    state.cat = b.getAttribute("data-cat"); state.sub = ""; render();
  });
  $("subchips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sub]"); if (!b) return;
    state.sub = b.getAttribute("data-sub"); render();
  });
  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) && n >= 0 ? n : null; }
  $("pmin").addEventListener("input", function (e) { state.pmin = num(e.target.value); render(); });
  $("pmax").addEventListener("input", function (e) { state.pmax = num(e.target.value); render(); });
  $("withship").addEventListener("change", function (e) { state.ship = e.target.checked; store("hr-ship", state.ship ? "1" : "0"); render(); });
  $("watchonly").addEventListener("click", function () { state.watchOnly = !state.watchOnly; render(); });
  $("reset-tools").addEventListener("click", function () { state.sub = ""; state.pmin = state.pmax = null; state.watchOnly = false; $("pmin").value = ""; $("pmax").value = ""; render(); });
  $("compare").addEventListener("click", function (e) {
    var sc = e.target.closest("[data-showcat]");
    if (sc) { state.cat = sc.getAttribute("data-showcat"); state.sub = ""; render(); try { $("filters").scrollIntoView({ block: "start" }); } catch (x) {} return; }
    var w = e.target.closest("[data-watch]");
    if (w) {
      var id = w.getAttribute("data-watch");
      if (watch[id]) delete watch[id]; else watch[id] = 1;
      saveWatch();
      w.setAttribute("aria-pressed", !!watch[id]);
      w.setAttribute("aria-label", watch[id] ? "Von Merkliste entfernen" : "Auf die Merkliste");
      if (state.watchOnly) render(); else renderTools();
      return;
    }
    var b = e.target.closest("[data-toggle]"); if (!b) return;
    var box = document.getElementById(b.getAttribute("data-toggle")); if (!box) return;
    var open = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", !open); box.hidden = open;
  });
  window.addEventListener("hashchange", function () { if (fromHash()) { markTabbar(); renderSortOptions(); render(); var t = $("tab-deals").parentNode; try { t.scrollIntoView({ block: "nearest" }); } catch (e) {} } });
  var y = $("year"); if (y) y.textContent = new Date().getFullYear();
  if (CFG.affiliate && (CFG.affiliate.amazonTag || CFG.affiliate.awinId)) $("aff-note").hidden = false;

  /* ---------- Daten laden ---------- */
  function getJSON(url, inline) {
    if (inline) return Promise.resolve(inline);
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function start(data, cat) {
    deals = ((data && data.deals) || []).filter(function (d) { return d && d.name && typeof d.price === "number" && CATS.indexOf(d.cat) > -1; });
    products = ((cat && cat.products) || []).filter(function (p) { return p && p.name && typeof p.price === "number" && CATS.indexOf(p.cat) > -1; });
    var upd = (data && data.updated) || (cat && cat.updated);
    if (upd) {
      var t = new Date(upd);
      $("stand").textContent = "Geprüft am " + t.toLocaleDateString("de-DE", { day: "2-digit", month: "long" }) + " um " + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
    }
    $("n-deals").textContent = deals.length;
    $("n-compare").textContent = products.length;
    renderPulse(data && data.pulse);
    renderTop(); render(); fillAds();
  }
  $("grid").innerHTML = "";
  $("empty").hidden = false;
  $("empty").innerHTML = "<h3>Angebote werden geladen</h3><p>Einen Moment, die heutigen Preise kommen gleich.</p>";
  Promise.all([
    getJSON("data/deals.json", window.HR_DATA).catch(function () { return null; }),
    getJSON("data/catalog.json", window.HR_CATALOG).catch(function () { return null; })
  ]).then(function (r) {
    if (!r[0] && !r[1]) throw new Error("no data");
    start(r[0], r[1]);
  }).catch(function () {
    $("empty").innerHTML = "<h3>Preise konnten nicht geladen werden</h3><p>Lade die Seite bitte neu. Klappt es dann immer noch nicht, sind die Datendateien gerade nicht erreichbar.</p>";
    $("stand").textContent = "Keine Verbindung";
  });
})();
