#!/usr/bin/env node
/*
 * Hardware-Radar – erzeugt statische Seiten aus data/catalog.json und data/deals.json:
 *   p/<id>.html          eine Seite pro Produkt (Preis, alle Shops, Preisverlauf, Preisalarm, ähnliche Produkte)
 *   k/<kategorie>.html   eine Übersicht pro Kategorie
 *   ratgeber/...         Kaufberatungen mit aktuellen Empfehlungen aus dem Katalog
 *   sitemap.xml          alle Seiten für Suchmaschinen
 * Läuft bei jeder Veröffentlichung im Workflow "Website veröffentlichen". Keine Abhängigkeiten.
 *   node tools/build/build.mjs --out _site
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { GUIDES } from "./guides.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > -1 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg("out", path.join(ROOT, "_site")));
const SITE = "https://hwradar.de/";

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const sandbox = { window: {} }; vm.runInNewContext(read("assets/config.js"), sandbox);
const CFG = sandbox.window.HR_CONFIG || {};
const L = require(path.join(ROOT, "assets/links.js"))(CFG);
const catalog = JSON.parse(read("data/catalog.json"));
const dealsData = JSON.parse(read("data/deals.json"));
const CATS = ["Grafikkarten", "Prozessoren", "Arbeitsspeicher", "SSDs", "Mainboards", "Monitore", "Netzteile", "Gehäuse", "Kühlung"];
const products = (catalog.products || []).filter(p => p && p.id && /^[a-z0-9-]+$/.test(p.id) && p.name && typeof p.price === "number" && CATS.includes(p.cat));
const byId = new Map(products.map(p => [p.id, p]));
const STAND = catalog.updated || dealsData.updated || new Date().toISOString();

/* ---------- kleine Helfer ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const eur0 = n => Math.round(n).toLocaleString("de-DE") + " €";
const dshort = s => { const p = String(s).slice(0, 10).split("-"); return p[2] + "." + p[1] + "." + p[0]; };
const dlong = s => new Date(s).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
const tlong = s => new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
export const catSlug = c => c.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-");
const shopNm = s => L.shopName(s);
const offersOf = p => (p.offers && p.offers.length ? p.offers : [{ shop: p.shop, price: p.price, ship: null, avail: null, url: p.url }]).slice().sort((a, b) => a.price - b.price);
const total = o => o.ship == null ? null : o.price + o.ship;
const relOf = l => L.relOf(l);
const affMark = l => l.aff ? '<span class="aff">*</span>' : "";
function btn(l, cls) { return '<a class="btn ' + cls + '" href="' + esc(l.href) + '" target="_blank" rel="' + relOf(l) + '"' + (l.guess ? ' title="Öffnet die Suche nach diesem Produkt im Shop"' : "") + ">" + esc(l.label) + affMark(l) + "</a>"; }
function write(rel, html) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }

const ICON = {
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
function thumb(p, big) {
  const u = p.img ? L.safeUrl(p.img) : null;
  return '<div class="thumb' + (big ? " big" : "") + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[p.cat] || ICON.Prozessoren) + "</svg>" +
    (u ? '<img src="' + esc(u.toString()) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">' : "") + "</div>";
}

/* ---------- grobe Leistungswerte (wie im PC-Konfigurator) ---------- */
export const GPU_PERF = [
  [/rtx 5090/, 100, 575], [/rtx 5080/, 72, 360], [/rtx 5070 ti/, 61, 300], [/rtx 5070/, 50, 250], [/rtx 5060 ti.*16|16.*rtx 5060 ti/, 39, 180], [/rtx 5060 ti/, 37, 180],
  [/rtx 5060/, 33, 150], [/rtx 5050/, 26, 130], [/rtx 3050/, 15, 115], [/rx 9070 xt/, 60, 304], [/rx 9070 gre/, 46, 220], [/rx 9070/, 53, 220], [/rx 9060 xt/, 38, 160],
  [/rx 9060/, 32, 140], [/arc b580/, 30, 190], [/arc b570/, 26, 150]
];
export function gpuInfo(p) {
  const key = (p.sub + " " + p.name).toLowerCase().replace(/radeon\s+(\d)/, "rx $1");
  if (/ai pro|pro r9700|arc pro|workstation/.test(key)) return null;
  const r = GPU_PERF.find(x => x[0].test(key)); return r ? { perf: r[1], watt: r[2] } : null;
}
export function chipOf(p) {
  const k = (p.sub + " " + p.name).toLowerCase().replace(/radeon\s+(?:rx\s+)?(\d)/g, "rx $1");
  const m = k.match(/rtx\s?(\d{4})(\s?ti)?/) || k.match(/(?:rx|radeon)\s?(\d{4})\s?(xt|gre)?/);
  if (!m) return p.sub || "";
  const brand = /rtx/.test(m[0]) ? "RTX " : "RX ";
  const vram = /rtx 5060 ti/.test(k) ? (/16\s?gb|16384|16g/.test(k) ? " 16 GB" : " 8 GB") : /rx 9060 xt/.test(k) ? (/8\s?gb|8192/.test(k) && !/16/.test(k) ? " 8 GB" : " 16 GB") : "";
  return brand + m[1] + (m[2] ? " " + m[2].trim().toUpperCase().replace("TI", "Ti") : "") + vram;
}

/* ---------- Seitenrahmen ---------- */
function page({ rel, title, desc, body, jsonld, crumbs }) {
  const depth = rel.split("/").length - 1, B = "../".repeat(depth);
  const canon = SITE + rel.replace(/index\.html$/, "");
  const ld = (jsonld || []).concat(crumbs ? [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: SITE + c[1] })) }] : []);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="google-adsense-account" content="${esc(CFG.adsenseClient || "")}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canon)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Hardware-Radar"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canon)}"><meta property="og:image" content="${SITE}assets/brand/profilbild-512.png">
<meta name="theme-color" content="#0b0e13" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f3f5f8" media="(prefers-color-scheme: light)">
<link rel="icon" href="${B}favicon.svg" type="image/svg+xml">
<script src="${B}assets/theme.js"></script>
<link rel="stylesheet" href="${B}assets/style.css">
${ld.length ? '<script type="application/ld+json">' + JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c") + "</script>" : ""}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied"});</script>
${CFG.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CFG.adsenseClient)}" crossorigin="anonymous"></script>` : ""}
</head>
<body>
<a class="skip" href="#main">Zum Inhalt springen</a>
<header class="site-head"><div class="wrap">
  <a class="logo" href="${B}./" aria-label="Hardware-Radar Startseite">
    <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--line-strong)" stroke-width="1.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="var(--line-strong)" stroke-width="1.5"/><circle cx="16" cy="16" r="3.5" fill="none" stroke="var(--line-strong)" stroke-width="1.5"/><g class="sweep"><path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 28.6 8.8 Z" fill="var(--signal)" opacity=".35"/><line x1="16" y1="16" x2="16" y2="1.5" stroke="var(--signal)" stroke-width="2" stroke-linecap="round"/></g><circle cx="23" cy="10" r="2.2" fill="var(--down)"/></svg>
    <span class="word">Hardware<b>·</b>Radar</span>
  </a>
  <nav class="head-nav" aria-label="Hauptnavigation">
    <a href="${B}#deals">Deals</a>
    <a href="${B}#preisvergleich">Preisvergleich</a>
    <a href="${B}ratgeber/">Kaufberatung</a>
    <a href="${B}konfigurator.html">PC-Konfigurator</a>
  </nav>
</div></header>
<main id="main">
${crumbs ? '<div class="wrap"><nav class="crumbs" aria-label="Brotkrumen">' + crumbs.map((c, i) => i < crumbs.length - 1 ? '<a href="' + B + c[1] + '">' + esc(c[0]) + "</a>" : '<span aria-current="page">' + esc(c[0]) + "</span>").join('<span class="sep">›</span>') + "</nav></div>" : ""}
${body}
</main>
<footer class="site-foot"><div class="wrap">
  <div>
    <p>Alle Preise in Euro inkl. MwSt., ohne Gewähr. Maßgeblich sind Preis und Verfügbarkeit im Shop. Stand der Preise: ${esc(dlong(STAND))}, ${esc(tlong(STAND))} Uhr.</p>
    <p>* Mit Sternchen markierte Links sind Affiliate-Links. Kaufst du darüber, erhalten wir eine kleine Provision. Für dich ändert sich der Preis nicht.</p>
  </div>
  <div class="foot-links">
    <a href="${B}./">Startseite</a>
    <a href="${B}ratgeber/">Kaufberatung</a>
    <a href="${B}konfigurator.html">PC-Konfigurator</a>
    <a href="${B}impressum.html">Impressum</a>
    <a href="${B}datenschutz.html">Datenschutz</a>
  </div>
</div></footer>
<nav class="tabbar" aria-label="Navigation">
  <a href="${B}#deals"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><span>Deals</span></a>
  <a href="${B}#preisvergleich"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><span>Preisvergleich</span></a>
  <a href="${B}ratgeber/"${rel.startsWith("ratgeber/") ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5v-16Z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20M8 7h8M8 11h6"/></svg><span>Ratgeber</span></a>
  <a href="${B}konfigurator.html"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6"/><circle cx="12" cy="16" r="1.6"/></svg><span>Konfigurator</span></a>
</nav>
<script src="${B}assets/alarm.js"></script>
</body>
</html>
`;
}

/* ---------- Preisverlauf als SVG ---------- */
function bigChart(hist, price) {
  const h = (hist || []).filter(x => x && x.d && typeof x.p === "number").sort((a, b) => a.d < b.d ? -1 : 1);
  if (h.length < 2) return "";
  const W = 720, H = 220, Lp = 54, R = 14, T = 14, Bp = 28;
  const t0 = Date.parse(h[0].d), t1 = Date.parse(h[h.length - 1].d), span = Math.max(864e5, t1 - t0);
  let lo = Math.min(...h.map(x => x.p)), hi = Math.max(...h.map(x => x.p)); if (hi === lo) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = t => Lp + (W - Lp - R) * ((t - t0) / span), Y = v => T + (H - T - Bp) * (1 - (v - lo) / (hi - lo));
  const xy = h.map(x => [X(Date.parse(x.d)), Y(x.p)]);
  const line = xy.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const chg = (price - h[0].p) / h[0].p, col = chg > 0.005 ? "var(--up)" : chg < -0.005 ? "var(--down)" : "var(--signal)";
  const ticks = [0, 0.5, 1].map(f => { const v = lo + (hi - lo) * (1 - f), y = T + (H - T - Bp) * f; return `<line x1="${Lp}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/><text x="${Lp - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(eur0(v))}</text>`; }).join("");
  const last = xy[xy.length - 1];
  return `<svg class="chart big" viewBox="0 0 ${W} ${H}" role="img" aria-label="Preisverlauf von ${esc(dshort(h[0].d))} bis heute"><defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>${ticks}` +
    `<path d="${line} L${last[0].toFixed(1)} ${H - Bp} L${xy[0][0].toFixed(1)} ${H - Bp} Z" fill="url(#g1)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
    xy.map(q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="${col}"/>`).join("") +
    `<text x="${Lp}" y="${H - 8}">${esc(dshort(h[0].d))}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${esc(dshort(h[h.length - 1].d))}</text></svg>`;
}

/* ---------- Produktseiten ---------- */
const guideFor = p => GUIDES.find(g => g.forProduct && g.forProduct(p, { gpuInfo, chipOf }));
function similar(p) {
  return products.filter(x => x.cat === p.cat && x.id !== p.id).map(x => ({ x, d: Math.abs(Math.log(x.price / p.price)) + (x.sub === p.sub ? 0 : 0.35) }))
    .sort((a, b) => a.d - b.d).slice(0, 6).map(a => a.x);
}
export function miniRow(p, B) {
  const l = L.productLink(p);
  return `<li class="mini"><a class="mini-main" href="${B}p/${p.id}.html">${thumb(p)}<span class="mini-t"><span class="mini-s">${esc(p.sub || p.cat)}</span><span class="mini-n">${esc(p.name)}</span></span><span class="mini-p">${eur(p.price)}<small>bei ${esc(shopNm(p.shop))}</small></span></a>${btn(l, "ghost mini-go")}</li>`;
}
function productPage(p) {
  const rel = "p/" + p.id + ".html", B = "../", offers = offersOf(p), best = offers[0];
  const bestLink = L.productLink(p);
  const h = (p.hist || []).filter(x => x && typeof x.p === "number");
  const lowH = h.length ? Math.min(...h.map(x => x.p)) : p.price, highH = h.length ? Math.max(...h.map(x => x.p)) : p.price;
  const n = offers.length, lo = offers[0].price, hi = offers[n - 1].price;
  const gi = p.cat === "Grafikkarten" ? gpuInfo(p) : null;
  const rows = offers.map((o, i) => {
    const ol = L.shopLink(o.url, o.shop, p.name), t = total(o);
    return `<tr class="${i === 0 ? "best" : ""}"><td>${esc(shopNm(o.shop))}${i === 0 ? '<span class="tag-best">günstigster</span>' : ""}</td><td class="num">${eur(o.price)}</td><td class="num">${o.ship == null ? "–" : o.ship === 0 ? "frei" : eur(o.ship)}</td><td class="num">${t == null ? '<span class="unk">unbekannt</span>' : eur(t)}</td><td>${esc(o.avail || "–")}</td><td class="go">${ol ? `<a href="${esc(ol.href)}" target="_blank" rel="${relOf(ol)}">${esc(ol.label)}${affMark(ol)}</a>` : ""}</td></tr>`;
  }).join("");
  const g = guideFor(p);
  const facts = [
    ["Kategorie", `<a href="${B}k/${catSlug(p.cat)}.html">${esc(p.cat)}</a>`],
    p.sub && p.sub !== p.cat ? ["Typ", esc(p.sub)] : null,
    ["Günstigster Preis", `${eur(best.price)} bei ${esc(shopNm(best.shop))}`],
    n > 1 ? ["Preisspanne", `${eur(lo)} bis ${eur(hi)} in ${n} Shops`] : null,
    h.length > 1 ? ["Tiefstpreis im Radar", `${eur(lowH)} (seit ${dshort(h[0].d)})`] : null,
    gi ? ["Leistung (grob)", `${gi.perf} von 100 Punkten (RTX 5090 = 100), etwa ${gi.watt} W Leistungsaufnahme`] : null,
    p.firstSeen ? ["Im Radar seit", dshort(p.firstSeen)] : null,
    ["Preis geprüft", p.stand ? dlong(p.stand) + ", " + tlong(p.stand) + " Uhr" : dlong(STAND)]
  ].filter(Boolean);
  const chart = bigChart(p.hist, p.price);
  const sim = similar(p);
  const desc = `${p.name}: aktuell ab ${eur(best.price)} bei ${shopNm(best.shop)}${n > 1 ? `, ${n} Shops im Vergleich` : ""}. Preisverlauf, Preisalarm und direkte Shop-Links bei Hardware-Radar.`;
  const ld = [{
    "@context": "https://schema.org", "@type": "Product", name: p.name, category: p.cat + (p.sub ? " > " + p.sub : ""),
    ...(p.img && L.safeUrl(p.img) ? { image: p.img } : {}),
    offers: { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: lo.toFixed(2), highPrice: hi.toFixed(2), offerCount: n }
  }];
  const body = `<div class="wrap pp">
  <section class="pp-head">
    ${thumb(p, true)}
    <div class="pp-title"><span class="p-sub">${esc(p.sub || p.cat)}</span><h1>${esc(p.name)}</h1>
      <p class="pp-lede">Aktuell ab <b>${eur(best.price)}</b> bei ${esc(shopNm(best.shop))}${n > 1 ? `, ${n} Shops verglichen` : ""}. Geprüft am ${esc(p.stand ? dlong(p.stand) : dlong(STAND))}.</p></div>
    <div class="pp-buy"><span class="from">ab</span><span class="val">${eur(best.price)}</span><span class="at">bei <b>${esc(shopNm(best.shop))}</b>${best.ship != null ? " · Versand " + (best.ship === 0 ? "frei" : eur(best.ship)) : ""}</span>
      ${btn(bestLink, "primary")}<a class="btn ghost" href="#alarm">Preisalarm setzen</a></div>
  </section>
  <div class="pp-grid">
    <section class="pp-card"><h2>Preise im Vergleich</h2>
      <div class="offers-scroll"><table><thead><tr><th>Shop</th><th class="num">Preis</th><th class="num">Versand</th><th class="num">Gesamt</th><th>Lieferung</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${p.note ? `<p class="c-note">${esc(p.note)}</p>` : ""}
      <p class="pp-small">Preise laut Hardware-Radar, Stand ${esc(p.stand ? dlong(p.stand) : dlong(STAND))}. Maßgeblich ist der Preis im Shop.${bestLink.guess ? " Einige Links öffnen die Produktsuche im jeweiligen Shop." : ""}</p>
    </section>
    <section class="pp-card"><h2>Eckdaten</h2><dl class="facts">${facts.map(f => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join("")}</dl></section>
    <section class="pp-card wide"><h2>Preisverlauf</h2>
      ${chart || `<p class="pp-empty">Der Preisverlauf startet am ${esc(dshort((h[0] && h[0].d) || STAND))}. Hardware-Radar prüft den Preis dreimal täglich, ab morgen siehst du hier die Kurve.</p>`}
      ${h.length > 1 ? `<p class="pp-small">Tiefstwert ${eur(lowH)}, Höchstwert ${eur(highH)}. ${p.price <= lowH * 1.01 ? "Der heutige Preis liegt auf dem Tiefstand seit Beginn der Messung." : p.price >= highH * 0.99 ? "Der heutige Preis liegt am oberen Ende der Messung, Abwarten kann sich lohnen." : "Der heutige Preis liegt zwischen Tief- und Höchstwert."}</p>` : ""}
    </section>
    <section class="pp-card wide" id="alarm"><h2>Preisalarm</h2>
      <form class="alarm-form" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-price="${p.price}">
        <label for="al-in">Melde mir, wenn der Preis fällt auf</label>
        <div class="al-row-in"><input id="al-in" type="text" inputmode="decimal" autocomplete="off" aria-describedby="al-hint"><span class="al-eur">€</span><button class="btn primary" type="submit">Alarm speichern</button><button class="btn ghost al-del" type="button" hidden>Löschen</button></div>
        <p class="al-state" aria-live="polite"></p>
        <p class="pp-small" id="al-hint">Dein Zielpreis wird nur in diesem Browser gespeichert. Bei jedem Besuch auf Hardware-Radar vergleichen wir ihn mit dem aktuellen Preis und zeigen dir oben eine Meldung, sobald er erreicht ist. Über die Glocke im Kopf der Seite siehst du alle deine Alarme.</p>
      </form>
    </section>
    ${g ? `<section class="pp-card wide guide-tip"><h2>Kaufberatung</h2><p><a href="${B}ratgeber/${g.slug}.html"><b>${esc(g.title)}</b></a>: ${esc(g.teaser)}</p></section>` : ""}
    ${sim.length ? `<section class="pp-card wide"><h2>Ähnliche ${esc(p.cat)}</h2><ul class="minis">${sim.map(x => miniRow(x, B)).join("")}</ul><p class="pp-small"><a href="${B}k/${catSlug(p.cat)}.html">Alle ${esc(p.cat)} im Vergleich →</a></p></section>` : ""}
  </div>
</div>`;
  write(rel, page({ rel, title: `${p.name} ab ${eur(best.price)} – Preisvergleich | Hardware-Radar`, desc, body, jsonld: ld, crumbs: [["Startseite", ""], [p.cat, "k/" + catSlug(p.cat) + ".html"], [p.name, rel]] }));
  return rel;
}

/* ---------- Kategorieseiten ---------- */
const CAT_TEXT = {
  "Grafikkarten": "Die Grafikkarte entscheidet am stärksten, wie flüssig Spiele laufen. Hier findest du alle Karten im Radar, sortiert nach Preis, mit dem günstigsten Shop.",
  "Prozessoren": "Für Gaming zählen vor allem Takt und Cache. Hier findest du alle Prozessoren im Radar mit dem aktuell günstigsten Shop.",
  "Arbeitsspeicher": "Arbeitsspeicher ist 2026 deutlich teurer als früher. Der Preisvergleich zeigt dir, wo 32 GB gerade am günstigsten sind.",
  "SSDs": "NVMe-SSDs sorgen für kurze Ladezeiten. Achte auf den Preis pro Terabyte, er steht beim Preisvergleich auf der Startseite.",
  "Mainboards": "Das Mainboard muss zum Prozessor passen (Sockel und Chipsatz). Hier findest du alle Mainboards im Radar.",
  "Monitore": "Auflösung und Bildwiederholrate sollten zur Grafikkarte passen. Hier findest du alle Gaming-Monitore im Radar.",
  "Netzteile": "Ein gutes Netzteil schützt die teuren Teile. Wie viel Watt du brauchst, erklärt unsere Kaufberatung.",
  "Gehäuse": "Das Gehäuse muss Mainboard-Größe, Grafikkarte und Kühler aufnehmen. Hier findest du alle Gehäuse im Radar.",
  "Kühlung": "Ein guter CPU-Kühler hält den Prozessor leise und kühl. Hier findest du Luftkühler und Wasserkühlungen im Radar."
};
function catPage(c) {
  const rel = "k/" + catSlug(c) + ".html", B = "../", list = products.filter(p => p.cat === c).sort((a, b) => a.price - b.price);
  if (!list.length) return null;
  const subs = [...new Set(list.map(p => p.sub).filter(Boolean))];
  const gs = GUIDES.filter(g => g.cat === c);
  const body = `<div class="wrap pp"><section class="pp-head cat-head"><div class="pp-title"><span class="p-sub">${list.length} Produkte im Radar</span><h1>${esc(c)} im Preisvergleich</h1><p class="pp-lede">${esc(CAT_TEXT[c] || "")} Günstigstes Angebot gerade: <b>${eur(list[0].price)}</b>.</p></div></section>
  ${gs.length ? `<div class="guide-chips">${gs.map(g => `<a class="chip" href="${B}ratgeber/${g.slug}.html">${esc(g.short || g.title)}</a>`).join("")}</div>` : ""}
  ${subs.length > 1 ? subs.map(s => { const l = list.filter(p => p.sub === s); return `<section class="pp-card wide"><h2>${esc(s)} <span class="n">${l.length}</span></h2><ul class="minis">${l.map(p => miniRow(p, B)).join("")}</ul></section>`; }).join("") + (list.some(p => !p.sub) ? `<section class="pp-card wide"><h2>Weitere</h2><ul class="minis">${list.filter(p => !p.sub).map(p => miniRow(p, B)).join("")}</ul></section>` : "")
    : `<section class="pp-card wide"><ul class="minis">${list.map(p => miniRow(p, B)).join("")}</ul></section>`}
</div>`;
  write(rel, page({ rel, title: `${c} Preisvergleich: ${list.length} Angebote ab ${eur0(list[0].price)} | Hardware-Radar`, desc: `${c} im Preisvergleich: ${list.length} Produkte, sortiert nach Preis, mit dem günstigsten Shop und Preisverlauf. Stand ${dlong(STAND)}.`, body, crumbs: [["Startseite", ""], [c, rel]] }));
  return rel;
}

/* ---------- Kaufberatungen ---------- */
const H = { esc, eur, eur0, dlong, dshort, products, byId, gpuInfo, chipOf, offersOf, shopNm, L, btn, miniRow, catSlug, STAND, pulse: dealsData.pulse || [], deals: dealsData.deals || [] };
function guidePage(g) {
  const rel = "ratgeber/" + g.slug + ".html", B = "../";
  const html = g.render(Object.assign({ B }, H));
  const body = `<div class="wrap guide"><article class="g-body">
  <header class="g-head"><span class="p-sub">Kaufberatung · aktualisiert am ${esc(dlong(STAND))}</span><h1>${esc(g.title)}</h1><p class="pp-lede">${esc(g.teaser)}</p></header>
  ${html}
  <aside class="g-cta"><div><b>Lieber direkt einen kompletten PC?</b><span>Der PC-Konfigurator stellt aus den aktuellen Bestpreisen einen passenden PC zusammen und prüft, ob alles zusammenpasst.</span></div><span class="g-cta-btns"><a class="btn primary" href="${B}konfigurator.html${g.cfg ? "#" + g.cfg : ""}">PC-Konfigurator öffnen</a><a class="btn ghost" href="${B}konfigurator.html#aufruesten">Meinen PC aufrüsten</a></span></aside>
  <p class="pp-small">Die Empfehlungen in den Tabellen werden bei jeder Preisprüfung automatisch neu berechnet. Leistungswerte sind grobe Richtwerte aus öffentlichen Tests und dienen nur dem Vergleich. Maßgeblich sind Preis und Verfügbarkeit im Shop.</p>
  </article>
  <nav class="g-more" aria-label="Weitere Kaufberatungen"><h2>Weitere Kaufberatungen</h2><ul>${GUIDES.filter(x => x !== g).map(x => `<li><a href="${B}ratgeber/${x.slug}.html">${esc(x.title)}</a></li>`).join("")}</ul></nav>
</div>`;
  write(rel, page({ rel, title: g.title + " | Hardware-Radar", desc: g.teaser, body, crumbs: [["Startseite", ""], ["Kaufberatung", "ratgeber/"], [g.short || g.title, rel]],
    jsonld: [{ "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.teaser, dateModified: STAND, inLanguage: "de", author: { "@type": "Organization", name: "Hardware-Radar" }, publisher: { "@type": "Organization", name: "Hardware-Radar" } }] }));
  return rel;
}
function guideIndex() {
  const rel = "ratgeber/index.html", B = "../";
  const body = `<div class="wrap guide"><header class="g-head"><span class="p-sub">Kaufberatung</span><h1>Kaufberatung für Gaming-PC-Hardware</h1><p class="pp-lede">Welche Grafikkarte passt zu deinem Budget, wie viel Arbeitsspeicher brauchst du und wie stark muss das Netzteil sein? Unsere Ratgeber erklären es kurz und zeigen dir dazu die aktuell besten Angebote, die bei jeder Preisprüfung neu berechnet werden.</p></header>
  <ul class="g-list">${GUIDES.map(g => `<li><a href="${B}ratgeber/${g.slug}.html"><span class="p-sub">${esc(g.cat || "PC")}</span><b>${esc(g.title)}</b><span>${esc(g.teaser)}</span></a></li>`).join("")}</ul>
  <h2 class="g-h2">Alle Kategorien im Preisvergleich</h2><div class="guide-chips">${CATS.filter(c => products.some(p => p.cat === c)).map(c => `<a class="chip" href="${B}k/${catSlug(c)}.html">${esc(c)}</a>`).join("")}</div></div>`;
  write(rel, page({ rel, title: "Kaufberatung Gaming-PC-Hardware 2026 | Hardware-Radar", desc: "Kaufberatungen für Grafikkarten, Prozessoren, Arbeitsspeicher, SSDs und Netzteile, mit aktuellen Bestpreisen aus deutschen Shops.", body, crumbs: [["Startseite", ""], ["Kaufberatung", "ratgeber/"]] }));
  return "ratgeber/";
}

/* ---------- Ablauf ---------- */
fs.mkdirSync(OUT, { recursive: true });
for (const d of ["p", "k", "ratgeber"]) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
const urls = [["", "daily", "1.0"], ["konfigurator.html", "daily", "0.8"]];
urls.push([guideIndex(), "daily", "0.8"]);
for (const g of GUIDES) urls.push([guidePage(g), "daily", "0.8"]);
for (const c of CATS) { const r = catPage(c); if (r) urls.push([r, "daily", "0.7"]); }
for (const p of products) urls.push([productPage(p), "daily", "0.5"]);
urls.push(["impressum.html", "yearly", "0.1"], ["datenschutz.html", "yearly", "0.1"]);
const today = new Date(STAND).toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${SITE}${u[0]}</loc><lastmod>${today}</lastmod><changefreq>${u[1]}</changefreq><priority>${u[2]}</priority></url>`).join("\n") + "\n</urlset>\n");
// Startseite: Kaufberatungen als Links einfügen (gut für Besucher und Suchmaschinen)
const home = path.join(OUT, "index.html");
if (fs.existsSync(home)) {
  const sec = `<section class="home-guides"><div class="wrap"><h2>Kaufberatung</h2><p class="pp-lede">Kurze Ratgeber mit den aktuell besten Angeboten, bei jeder Preisprüfung neu berechnet.</p><ul class="g-list">${GUIDES.map(g => `<li><a href="ratgeber/${g.slug}.html"><span class="p-sub">${esc(g.cat || "PC")}</span><b>${esc(g.title)}</b><span>${esc(g.teaser)}</span></a></li>`).join("")}</ul><div class="guide-chips">${CATS.filter(c => products.some(p => p.cat === c)).map(c => `<a class="chip" href="k/${catSlug(c)}.html">${esc(c)} im Preisvergleich</a>`).join("")}</div></div></section>`;
  fs.writeFileSync(home, fs.readFileSync(home, "utf8").replace("<!--HR:GUIDES-->", sec));
}
console.log(`Seiten erzeugt: ${products.length} Produkte, ${GUIDES.length} Kaufberatungen, ${urls.length} Einträge in der Sitemap → ${OUT}`);
