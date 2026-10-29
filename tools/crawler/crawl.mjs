#!/usr/bin/env node
/*
 * Hardware-Radar Crawler
 * ----------------------
 * Durchsucht Online-Shops nach Gaming-Hardware, liest die Preise aus den strukturierten Produktdaten
 * (schema.org JSON-LD, wie sie Shops für Google bereitstellen), findet selbstständig neue Shops,
 * führt einen Preisverlauf und erkennt Deals. Ergebnis: data/catalog.json und data/deals.json.
 *
 * Höflich und regelkonform:
 *  - beachtet robots.txt (Disallow/Allow, Crawl-delay) und gibt sich mit Kontaktadresse zu erkennen
 *  - höchstens eine Anfrage pro Shop alle paar Sekunden, feste Obergrenzen pro Lauf
 *  - liest nur öffentliche Produktseiten, keine Logins, keine Formulare
 *
 * Aufruf:  node tools/crawler/crawl.mjs [--dry] [--max 300] [--data ./data] [--state ./tools/crawler/state.json]
 * Benötigt Node.js 18 oder neuer, keine weiteren Pakete.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const CFG = JSON.parse(fs.readFileSync(args.config || path.join(HERE, "config.json"), "utf8"));
const DATA_DIR = path.resolve(args.data || path.join(HERE, "..", "..", "data"));
const STATE_FILE = path.resolve(args.state || path.join(HERE, "state.json"));
const TEST = !!args.test;              // erlaubt localhost/IP-Adressen (nur für Tests)
const DRY = !!args.dry;                // nichts schreiben
const L = Object.assign({}, CFG.limits, args.max ? { maxRequestsPerRun: +args.max } : {});
if (TEST) L.minDelayMs = +(args.delay ?? 0);
const NOW = args.now ? new Date(args.now) : new Date();  // --now nur für Tests
const TODAY = NOW.toISOString().slice(0, 10);

function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2), v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
    o[k] = v;
  }
  return o;
}
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

/* ---------------- Zustand ---------------- */
function loadJSON(f, fallback) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fallback; } }
const state = loadJSON(STATE_FILE, {});
state.domains ??= {};      // domain -> { status: active|candidate|rejected, origin, sitemaps, fails, products, lastCrawl, name }
state.urls ??= {};         // url -> { last, key, kind }
state.products ??= {};     // key -> { name, cat, sub, gtin, mpn, brand, offers: {domain: {...}}, hist: [{d,p}] }
state.discovered ??= {};   // domain -> { origin, firstSeen, seenOn }
state.runs ??= [];
state.learned ??= {};      // Kategorie -> gelernte Suchbegriffe aus gefundenen Produktnamen
const GROW = CFG.growth || {};

for (const s of CFG.seeds) {
  const u = safeUrl(s); if (!u) continue;
  const d = domainOf(u);
  state.domains[d] ??= { status: "active", origin: u.origin, fails: 0, products: 0, seed: true };
}

/* ---------------- Hilfen ---------------- */
function safeUrl(s, base) {
  try {
    const u = new URL(s, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!TEST && (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.includes(":") || /^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname))) return null;
    u.hash = "";
    return u;
  } catch { return null; }
}
function domainOf(u) { return u.hostname.replace(/^www\./, "") + (TEST && u.port ? ":" + u.port : ""); }
function hostMatches(d, blocked) { const h = d.split(":")[0]; return blocked.some(b => h === b || h.endsWith("." + b)); }
function isBlocked(d) { return hostMatches(d, CFG.blockedDomains); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STRIP = /^(utm_|gclid|fbclid|msclkid|awc|tag|ref|refid|affid|partner|campaign|wt_mc|emid|srsltid|sid|session)/i;
function cleanUrl(u) {
  const x = new URL(u.toString());
  [...x.searchParams.keys()].forEach(k => { if (STRIP.test(k)) x.searchParams.delete(k); });
  return x.toString();
}
const decode = s => String(s ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const norm = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

/* ---------------- Netzwerk ---------------- */
let requests = 0;
const perDomain = {};
const nextSlot = {};
async function get(url, { binary = false } = {}) {
  const u = safeUrl(url); if (!u) return null;
  const d = domainOf(u);
  if (requests >= L.maxRequestsPerRun) return null;
  if ((perDomain[d] || 0) >= L.maxRequestsPerDomain) return null;
  const rob = await robotsFor(u);
  if (rob && !rob.allowed(u.pathname + u.search)) return { status: 0, blocked: true };
  const delay = Math.max(L.minDelayMs, (rob?.delay || 0) * 1000);
  const wait = (nextSlot[d] || 0) - Date.now();
  nextSlot[d] = Math.max(Date.now(), nextSlot[d] || 0) + delay;
  if (wait > 0) await sleep(wait);
  return rawGet(u, binary);
}
async function rawGet(u, binary) {
  const d = domainOf(u);
  requests++; perDomain[d] = (perDomain[d] || 0) + 1;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), L.timeoutMs);
  try {
    const r = await fetch(u, { redirect: "follow", signal: ctl.signal, headers: { "User-Agent": CFG.userAgent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5", "Accept-Language": "de-DE,de;q=0.9", "From": CFG.contact } });
    const len = +r.headers.get("content-length") || 0;
    if (len > 8e6) return { status: r.status, url: r.url, text: "" };
    let buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8e6) buf = buf.subarray(0, 8e6);
    if (/\.gz($|\?)/.test(u.pathname) || (buf[0] === 0x1f && buf[1] === 0x8b)) { try { buf = zlib.gunzipSync(buf); } catch {} }
    return { status: r.status, url: r.url, type: r.headers.get("content-type") || "", text: binary ? buf : buf.toString("utf8") };
  } catch (e) {
    return { status: 0, error: String(e.name || e) };
  } finally { clearTimeout(t); }
}

/* ---------------- robots.txt ---------------- */
const robotsCache = {};
function robotsFor(u) {
  const key = u.origin;
  if (!robotsCache[key]) robotsCache[key] = (async () => {
    const r = await rawGet(new URL("/robots.txt", u.origin), false);
    return parseRobots(r && r.status === 200 ? r.text : "", r ? r.status : 0);
  })();
  return robotsCache[key];
}
function parseRobots(txt, status) {
  // 401/403 auf robots.txt = alles verboten; 404 = alles erlaubt; 5xx/Fehler = vorsichtshalber verboten
  if (status === 401 || status === 403 || status >= 500 || status === 0) return { allowed: () => false, delay: 0, sitemaps: [], deny: true };
  const me = "hardwareradarbot";
  const groups = []; let cur = null, lastWasAgent = false;
  const sitemaps = [];
  for (let line of String(txt).split(/\r?\n/)) {
    line = line.replace(/#.*/, "").trim(); if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "sitemap") { sitemaps.push(v); continue; }
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], delay: 0 }; groups.push(cur); }
      cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === "allow" || k === "disallow") cur.rules.push({ allow: k === "allow", path: v });
    if (k === "crawl-delay") cur.delay = Math.min(60, parseFloat(v) || 0);
  }
  const mine = groups.filter(g => g.agents.some(a => a !== "*" && me.includes(a)));
  const use = mine.length ? mine : groups.filter(g => g.agents.includes("*"));
  const rules = use.flatMap(g => g.rules).filter(r => r.path !== "" || !r.allow);
  const delay = Math.max(0, ...use.map(g => g.delay));
  const toRe = p => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  const compiled = rules.filter(r => r.path).map(r => ({ allow: r.allow, len: r.path.length, re: toRe(r.path) }));
  return {
    delay, sitemaps,
    allowed(p) {
      let best = null;
      for (const r of compiled) if (r.re.test(p) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
      return !best || best.allow;
    }
  };
}

/* ---------------- Kategorien ---------------- */
// Wörter nur als ganze Wörter erkennen ("aio" soll nicht in "XAiOX" stecken)
const WRE = {};
function hasWord(n, w) {
  const k = norm(w);
  const re = WRE[k] ??= new RegExp("(^|[^a-z0-9])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/[a-z0-9]$/.test(k) ? "(?![a-z0-9])" : ""));
  return re.test(n);
}
function classify(name, price) {
  const n = " " + norm(name) + " ";
  for (const c of CFG.categories) {
    if (c.not.some(w => hasWord(n, w))) continue;
    if (!c.any.some(w => hasWord(n, w))) continue;
    if (c.must && !c.must.some(w => n.includes(norm(w)))) continue;
    if (price != null && ((c.min && price < c.min) || (c.max && price > c.max))) continue;
    return c.cat;
  }
  return null;
}
function pathWords(u) { let p = u.pathname; try { p = decodeURIComponent(p); } catch {} return " " + norm(p + " " + u.search).replace(/[-_/+.=&?]+/g, " ") + " "; }
function catWords(c) { return c.any.concat(state.learned[c.cat] || []).map(w => norm(w).replace(/[-_]+/g, " ").trim()).filter(Boolean); }
function urlCategory(u) {
  const p = pathWords(u);
  for (const c of CFG.categories) {
    if (c.not.slice(0, 40).some(w => hasWord(p, w))) continue;
    if (catWords(c).some(w => p.includes(w))) return c.cat;
  }
  return null;
}
function urlLooksRelevant(u) { return !!urlCategory(u); }
function subOf(cat, name) {
  const n = norm(name); let m;
  switch (cat) {
    case "Grafikkarten":
      if ((m = /rtx\s?(\d{4})\s?(ti|super)?/.exec(n))) return "GeForce RTX " + m[1] + (m[2] ? " " + (m[2] === "ti" ? "Ti" : "Super") : "");
      if ((m = /(?:rx|radeon)\s?(\d{4})\s?(xtx|xt|gre)?/.exec(n))) return "Radeon RX " + m[1] + (m[2] ? " " + m[2].toUpperCase() : "");
      if ((m = /arc\s?(b\d{3}|a\d{3})/.exec(n))) return "Intel Arc " + m[1].toUpperCase();
      return "Grafikkarten";
    case "Prozessoren":
      if ((m = /ryzen\s?[3579]\s?(\d)\d{3}/.exec(n))) return +m[1] >= 7 ? "AM5" : "AM4";
      if (/core\s?ultra/.test(n)) return "Intel LGA1851";
      if (/core\s?i[3579][\s-]?1[234]\d{3}/.test(n)) return "Intel LGA1700";
      return "Prozessoren";
    case "Arbeitsspeicher": {
      const t = /ddr5/.test(n) ? "DDR5" : /ddr4/.test(n) ? "DDR4" : "RAM";
      const g = /(\d{2,3})\s?gb/.exec(n); return t + (g ? " " + g[1] + " GB" : "");
    }
    case "SSDs": {
      const tb = /(\d+(?:[.,]\d+)?)\s?tb/.exec(n), gb = /(\d{3,4})\s?gb/.exec(n);
      const pcie = /gen\s?5|pcie\s?5/.test(n) ? "PCIe 5.0" : /gen\s?4|pcie\s?4/.test(n) ? "PCIe 4.0" : /sata/.test(n) ? "SATA" : "NVMe";
      return pcie + (tb ? " " + tb[1].replace(".", ",") + " TB" : gb ? " " + gb[1] + " GB" : "");
    }
    case "Mainboards":
      if ((m = /\b([abxzh])(\d{3})e?(?=m\b|i\b|\b|-)/.exec(n))) {
        const L1 = m[1].toUpperCase(), num = +m[2], c = L1 + m[2];
        const amd = L1 === "X" || L1 === "A" || (L1 === "B" && [350, 450, 550, 650, 840, 850].includes(num));
        if (amd) return (num < 600 ? "AM4 " : "AM5 ") + c;
        if (num >= 800) return "Intel LGA1851 " + c;
        if (num >= 600) return "Intel LGA1700 " + c;
        return "Intel " + c;
      }
      if (/\bam5\b/.test(n)) return "AM5";
      if (/\bam4\b/.test(n)) return "AM4";
      return "Mainboards";
    case "Monitore": {
      const z = /(\d{2}(?:[.,]\d)?)\s?("|zoll|”|'')/.exec(n); return z ? z[1].replace(".", ",") + "\"" : "Monitore";
    }
    case "Netzteile": {
      const w = /(\d[.,]?\d{3}|\d{3,4})\s?(?:w\b|watts?\b)/.exec(n); if (!w) return /sfx/.test(n) ? "SFX" : "Netzteile";
      const watt = +w[1].replace(/[.,]/, ""); if (/\bsfx\b/.test(n)) return "SFX";
      return watt >= 1000 ? "1000 W+" : watt >= 850 ? "850 W" : watt >= 750 ? "750 W" : watt >= 650 ? "650 W" : "bis 600 W";
    }
    case "Kühlung": return /aio|wasser|liquid/.test(n) ? "AiO-Wasserkühlung" : /lufter|fan/.test(n) && !/kuhler|cooler/.test(n) ? "Lüfter" : "Luftkühler";
    default: return cat;
  }
}
function tagsOf(name, cat, sub) { return [norm(cat), norm(sub), ...norm(name).split(/[^a-z0-9]+/).filter(w => w.length > 2)].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 18).join(" "); }

/* ---------------- Produktdaten aus HTML ---------------- */
function extractJsonLd(html) {
  const out = [];
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let txt = m[1].trim().replace(/^<!--|-->$/g, "").replace(/^\s*\/\*<!\[CDATA\[\*\/|\/\*\]\]>\*\/\s*$/g, "");
    try { out.push(JSON.parse(txt)); } catch {
      try { out.push(JSON.parse(txt.replace(/[\u0000-\u001f]+/g, " "))); } catch {}
    }
  }
  const flat = [];
  const walk = x => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    flat.push(x);
    if (x["@graph"]) walk(x["@graph"]);
    if (x.hasVariant) walk(x.hasVariant);
    if (x.mainEntity) walk(x.mainEntity);
  };
  walk(out);
  return flat;
}
const isType = (o, t) => [].concat(o["@type"] || []).some(x => String(x).toLowerCase() === t);
function num(v) {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s); return isFinite(n) ? n : null;
}
function offerOf(o) {
  const offers = [].concat(o.offers || []);
  let best = null;
  for (const of of offers) {
    if (!of || typeof of !== "object") continue;
    const list = isType(of, "aggregateoffer") ? [].concat(of.offers || [], [{ ...of, price: of.lowPrice ?? of.price }]) : [of];
    for (const x of list) {
      const cur = String(x.priceCurrency || x.priceSpecification?.priceCurrency || [].concat(x.priceSpecification || [])[0]?.priceCurrency || "").toUpperCase();
      const price = num(x.price ?? x.lowPrice ?? [].concat(x.priceSpecification || [])[0]?.price);
      if (price == null || price <= 0 || (cur && cur !== "EUR")) continue;
      if (!cur) continue;
      const avail = String(x.availability || "").split("/").pop();
      const ship = num([].concat(x.shippingDetails || [])[0]?.shippingRate?.value);
      const seller = x.seller?.name || x.offeredBy?.name || null;
      const cand = { price, ship: ship == null ? null : ship, avail, seller, url: x.url || null };
      if (/OutOfStock|Discontinued|SoldOut/i.test(avail) && best && !/OutOfStock|Discontinued|SoldOut/i.test(best.avail)) continue;
      if (!best || cand.price < best.price) best = cand;
    }
  }
  return best;
}
function parseProduct(html, pageUrl) {
  const items = extractJsonLd(html);
  const prods = items.filter(o => isType(o, "product") || isType(o, "productgroup") || isType(o, "individualproduct"));
  const siteName = decode((/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i.exec(html) || [])[1] || "").trim();
  for (const p of prods) {
    const of = offerOf(p) || (p.isVariantOf ? null : null);
    if (!of) continue;
    const name = decode(p.name || "").replace(/\s+/g, " ").trim();
    if (!name || name.length < 6) continue;
    const brand = decode(typeof p.brand === "string" ? p.brand : p.brand?.name || "").trim();
    const gtin = String(p.gtin13 || p.gtin || p.gtin14 || p.gtin12 || p.ean || "").replace(/\D/g, "") || null;
    const mpn = String(p.mpn || "").trim() || null;
    const img = [].concat(p.image || [])[0] || null; // wird nur für freigegebene Shops übernommen, siehe record()
    return { name: brand && !norm(name).includes(norm(brand)) ? brand + " " + name : name, brand, gtin, mpn, img: typeof img === "string" ? img : img?.url || null, offer: of, siteName };
  }
  // Rückfall: Open-Graph-Produktpreis
  const pr = num((/<meta[^>]+property=["'](?:product|og):price:amount["'][^>]+content=["']([^"']+)/i.exec(html) || [])[1]);
  const cur = ((/<meta[^>]+property=["'](?:product|og):price:currency["'][^>]+content=["']([^"']+)/i.exec(html) || [])[1] || "").toUpperCase();
  const title = decode((/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(html) || [])[1] || "").trim();
  if (pr && cur === "EUR" && title) return { name: title, brand: "", gtin: null, mpn: null, img: null, offer: { price: pr, ship: null, avail: "", seller: null, url: null }, siteName };
  return null;
}
function extractLinks(html, base) {
  const out = []; const re = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi; let m;
  while ((m = re.exec(html)) && out.length < 3000) { const u = safeUrl(decode(m[1]), base); if (u) out.push(u); }
  return out;
}

/* ---------------- Sitemaps ---------------- */
async function sitemapUrls(dom, origin) {
  const rob = await robotsFor(new URL(origin));
  let queue = (rob?.sitemaps?.length ? rob.sitemaps : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"]).slice(0, 10);
  const seen = new Set(), found = [];
  let fetched = 0;
  while (queue.length && fetched < L.maxSitemapsPerDomain) {
    // Produkt-Sitemaps zuerst
    queue.sort((a, b) => score(b) - score(a));
    const sm = queue.shift(); if (seen.has(sm)) continue; seen.add(sm);
    const r = await get(sm); fetched++;
    if (!r || r.status !== 200 || !r.text) continue;
    const locs = [...String(r.text).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map(m => decode(m[1]));
    if (/<sitemapindex/i.test(r.text)) { queue.push(...locs.filter(l => safeUrl(l))); continue; }
    for (const l of locs) { const u = safeUrl(l); if (u && domainOf(u) === dom && urlLooksRelevant(u)) found.push(cleanUrl(u)); }
    if (found.length > 20000) break;
  }
  return [...new Set(found)];
  function score(s) { return /product|produkt|artikel|item|p-|catalog/i.test(s) ? 2 : /categor|kategorie|page|cms|blog|news|image/i.test(s) ? -1 : 0; }
}

/* ---------------- Preise speichern ---------------- */
function productKey(p) {
  if (p.gtin && p.gtin.length >= 8) return "gtin:" + p.gtin.replace(/^0+/, "");
  if (p.mpn && p.brand) return "mpn:" + norm(p.brand) + ":" + norm(p.mpn).replace(/[^a-z0-9]/g, "");
  return "name:" + norm(p.name).replace(/\b(kit|gaming|edition|retail|boxed|tray|wof|schwarz|black|weiss|white)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function record(dom, pageUrl, p) {
  const cat = classify(p.name, p.offer.price); if (!cat) return false;
  if (p.offer.price < (CFG.deals.minPrice || 0)) return false;
  const key = productKey(p);
  const rec = state.products[key] ??= { name: p.name, cat, sub: subOf(cat, p.name), gtin: p.gtin, mpn: p.mpn, brand: p.brand, offers: {}, hist: [], firstSeen: TODAY };
  if (!rec.firstSeen) rec.firstSeen = TODAY;
  if (!rec.offers[dom]) newOffersThisRun++;
  if (p.name.length < rec.name.length || !rec.name) rec.name = p.name;
  rec.cat = cat; rec.sub = subOf(cat, rec.name);
  // Produktbilder nur von Shops, deren Bilder du nutzen darfst (config.json -> imageDomains, z. B. als Affiliate-Partner)
  if (p.img && hostMatches(dom, CFG.imageDomains || [])) {
    const iu = safeUrl(typeof p.img === "string" ? p.img : "", pageUrl);
    if (iu && iu.protocol === "https:") { rec.img = iu.toString(); rec.imgFrom = dom; }
  }
  const shopName = state.domains[dom]?.name || p.offer.seller || p.siteName || dom;
  if (state.domains[dom] && !state.domains[dom].name && p.siteName && p.siteName.length < 40) state.domains[dom].name = p.siteName;
  const prev = rec.offers[dom];
  rec.offers[dom] = { shop: shopName, price: round(p.offer.price), ship: p.offer.ship == null ? null : round(p.offer.ship), avail: availText(p.offer.avail), url: cleanUrl(new URL(p.offer.url || pageUrl, pageUrl)), seen: NOW.toISOString(), prev: prev ? prev.price : undefined };
  const best = Math.min(...Object.values(rec.offers).filter(fresh).map(o => o.price));
  const h = rec.hist[rec.hist.length - 1];
  if (h && h.d === TODAY) h.p = Math.min(h.p, best); else rec.hist.push({ d: TODAY, p: best });
  if (rec.hist.length > 120) rec.hist = rec.hist.slice(-120);
  state.urls[pageUrl] = { last: NOW.toISOString(), key, kind: "product", d: dom };
  return true;
}
const round = n => Math.round(n * 100) / 100;
const fresh = o => (NOW - new Date(o.seen)) / 36e5 < 72;
function availText(a) {
  if (/InStock/i.test(a)) return "Auf Lager";
  if (/PreOrder|PreSale/i.test(a)) return "Vorbestellung";
  if (/BackOrder|LimitedAvailability/i.test(a)) return "Begrenzt lieferbar";
  if (/OutOfStock|SoldOut/i.test(a)) return "Nicht lieferbar";
  return null;
}

/* ---------------- Sortiment wachsen lassen ----------------
 * 1. Kategorien mit wenig Produkten bekommen Vorrang (Ziele in config.json -> growth.targetPerCategory).
 * 2. Listen-/Kategorieseiten werden erkannt, regelmäßig neu besucht und ihre Folgeseiten (Seite 2, 3, ...) verfolgt.
 * 3. Aus gefundenen Produktnamen lernt der Crawler neue Suchbegriffe (z. B. neue Modellnamen) und findet damit mehr Seiten.
 * 4. Für Produkte im Preisvergleich ohne Shop-Angebot sucht er gezielt in der Shop-Suche (nur wo robots.txt das erlaubt).
 */
let newOffersThisRun = 0;
function catCounts() {
  const n = {}; for (const c of CFG.categories) n[c.cat] = 0;
  for (const p of Object.values(state.products)) if (Object.values(p.offers).some(fresh)) n[p.cat] = (n[p.cat] || 0) + 1;
  return n;
}
let COUNTS = catCounts();
function deficit(cat) {
  if (!cat) return 0;
  const t = (GROW.targetPerCategory || {})[cat] || 300;
  return Math.max(0, 1 - (COUNTS[cat] || 0) / t);
}
function priority(u, v) {
  // höher = früher. Unbesuchte Seiten aus Kategorien mit Lücken zuerst, dann Listen, dann Neu-Besuche alter Produkte.
  let cat = v.cat; if (cat === undefined) { const x = safeUrl(u); cat = v.cat = x ? urlCategory(x) : null; }
  const age = v.last ? (NOW - new Date(v.last)) / 36e5 : 1e4;
  let s = deficit(cat) * 3;
  if (!v.last) s += 2;
  if (v.kind === "listing") s += 1.5;
  if (v.kind === "search") s -= 1;
  return s + Math.min(age, 240) / 240;
}
const MODEL_RE = [
  /\b(rtx\s?\d{4}(?:\s?(?:ti|super))?)\b/g, /\b(rx\s?\d{4}(?:\s?(?:xt|xtx|gre))?)\b/g, /\b(arc\s?[ab]\d{3})\b/g,
  /\b(ryzen\s?[3579]\s?\d{4}x?3?d?)\b/g, /\b(core\s?ultra\s?[3579]\s?\d{3}k?f?)\b/g, /\b(i[3579][\s-]\d{5}k?f?)\b/g,
  /\b([abxz]\d{3}e?m?)\b/g, /\b(ddr[45][\s-]\d{4})\b/g, /\b(\d{3,4}\s?w)\b/g
];
function learnKeywords() {
  if (!GROW.learnKeywords) return 0;
  const tally = {};
  for (const p of Object.values(state.products)) {
    const n = norm(p.name), t = tally[p.cat] ??= {}, shops = Object.keys(p.offers).length;
    for (const re of MODEL_RE) for (const m of n.matchAll(re)) { const k = m[1].replace(/\s+/g, " ").trim(); if (k.length >= 4) t[k] = (t[k] || 0) + shops; }
    // Marke + Produktreihe, z. B. "pure power", "liquid freezer", "dark rock"
    const w = n.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
    if (w.length >= 3 && p.brand && /^(Kühlung|Netzteile|Gehäuse)$/.test(p.cat)) { const b = norm(p.brand); const i = w.indexOf(b.split(" ")[0]); if (i >= 0 && w[i + 1] && w[i + 2] && !/\d/.test(w[i + 1])) { const k = w[i + 1] + " " + w[i + 2]; t[k] = (t[k] || 0) + 1; } }
  }
  let added = 0;
  for (const [cat, t] of Object.entries(tally)) {
    const base = new Set((CFG.categories.find(c => c.cat === cat)?.any || []).map(norm));
    const other = CFG.categories.filter(c => c.cat !== cat).flatMap(c => c.any.map(norm));
    const top = Object.entries(t).filter(([k, n]) => n >= 3 && !base.has(k) && !other.some(o => o.includes(k) || k.includes(o))).sort((a, b) => b[1] - a[1]).slice(0, GROW.maxLearnedPerCategory || 60).map(([k]) => k);
    const before = new Set(state.learned[cat] || []);
    added += top.filter(k => !before.has(k)).length;
    state.learned[cat] = top;
  }
  return added;
}
function modelTokens(name) {
  const n = norm(name).replace(/\((?:boxed|tray|wof|mpk)[^)]*\)/g, " ");
  return new Set(n.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length > 1 && !/^(gb|tb|oc|kit|gaming|edition|black|schwarz|white|weiss|mit|und|the|for|fur|de|retail|boxed|tray|grafikkarte|prozessor|arbeitsspeicher|mainboard|monitor|netzteil|gehause)$/.test(w)));
}
function similarity(a, b) {
  const A = modelTokens(a), B = modelTokens(b); if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  // Zahlen/Modellnummern müssen übereinstimmen
  const numsA = [...A].filter(t => /\d/.test(t)), numsB = [...B].filter(t => /\d/.test(t));
  if (numsA.length && numsB.length && !numsA.every(t => B.has(t)) && !numsB.every(t => A.has(t))) return 0;
  return inter / Math.min(A.size, B.size);
}
function searchTerm(name) { return norm(name).replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 .-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" "); }
function queueSearches(dom) {
  if (!GROW.fillMissingShops) return 0;
  if (!(state.domains[dom]?.products > 0)) return 0; // erst suchen, wenn der Shop auswertbare Produktseiten hat
  const tpl = Object.entries(CFG.searchTemplates || {}).find(([d]) => dom === d || dom.endsWith("." + d))?.[1];
  if (!tpl) return 0;
  const catalog = loadJSON(path.join(DATA_DIR, "catalog.json"), { products: [] });
  const wanted = (catalog.products || []).filter(p => p.source !== "crawler" && !(p.offers || []).some(o => o.url && domainOfStr(o.url) === dom))
    .sort((a, b) => deficit(b.cat) - deficit(a.cat) || ((a.offers || []).filter(o => o.url).length - (b.offers || []).filter(o => o.url).length));
  let n = 0;
  for (const p of wanted) {
    if (n >= (GROW.maxSearchesPerDomain || 15)) break;
    const u = tpl.replace("{q}", encodeURIComponent(searchTerm(p.name)));
    const v = state.urls[u];
    if (v && v.last && (NOW - new Date(v.last)) / 864e5 < 7) continue; // höchstens einmal pro Woche suchen
    state.urls[u] = { ...(v || {}), last: v?.last || null, kind: "search", d: dom, want: p.name, cat: p.cat };
    n++;
  }
  return n;
}
function nextPageLinks(html, base, dom) {
  const out = new Set();
  const rel = /<(?:a|link)[^>]+rel=["']next["'][^>]*href=["']([^"']+)["']|<(?:a|link)[^>]+href=["']([^"']+)["'][^>]*rel=["']next["']/gi; let m;
  while ((m = rel.exec(html))) { const u = safeUrl(decode(m[1] || m[2]), base); if (u && domainOf(u) === dom) out.add(cleanUrl(u)); }
  const cur = safeUrl(base);
  if (cur) for (const k of ["page", "p", "seite", "pg"]) {
    const n = +(cur.searchParams.get(k) || 1);
    if (new RegExp("[?&]" + k + "=\\d+", "i").test(html) || cur.searchParams.has(k)) { const nx = new URL(cur); nx.searchParams.set(k, String(n + 1)); out.add(cleanUrl(nx)); break; }
  }
  return [...out].slice(0, 2);
}

/* ---------------- Einen Shop durchsuchen ---------------- */
async function crawlDomain(dom) {
  const D = state.domains[dom];
  const origin = D.origin;
  let hits = 0, tried = 0;
  const rob = await robotsFor(new URL(origin));
  if (!rob || rob.deny) { D.fails = (D.fails || 0) + 1; log(dom, "robots.txt nicht erreichbar oder verbietet Zugriff"); return; }
  if (!rob.allowed("/")) log(dom, "Startseite per robots.txt gesperrt, nutze nur erlaubte Seiten");

  // Produkt-URLs sammeln: Sitemaps (alle paar Tage neu) + bekannte URLs
  if (!D.sitemapAt || (NOW - new Date(D.sitemapAt)) / 36e5 > 72) {
    const list = await sitemapUrls(dom, origin);
    D.sitemapAt = NOW.toISOString();
    for (const u of list) state.urls[u] ??= { last: null, key: null, kind: "candidate", d: dom };
    log(dom, list.length + " passende Produkt-URLs aus Sitemaps");
  }
  if (!D.homeAt || (NOW - new Date(D.homeAt)) / 36e5 > 72) {
    const h = await get(origin + "/");
    D.homeAt = NOW.toISOString();
    if (h && h.status === 200 && h.text) for (const u of extractLinks(h.text, origin)) {
      const ud = domainOf(u);
      if (ud === dom && urlLooksRelevant(u)) state.urls[cleanUrl(u)] ??= { last: null, key: null, kind: "candidate", d: dom };
      else if (ud !== dom) noteDomain(ud, u, dom);
    }
  }
  // feste Such- und Kategorieseiten aus config.json (listingSeeds), damit alle Kategorien wachsen
  for (const u of ((CFG.listingSeeds || {})[dom] || [])) state.urls[u] ??= { last: null, key: null, kind: "listing", d: dom };
  const searches = queueSearches(dom);
  let urls = Object.entries(state.urls).filter(([, v]) => v.d === dom && v.kind !== "dead" && v.kind !== "nonproduct");
  const recrawl = v => v.kind === "listing" ? 24 : v.kind === "search" ? 24 * 7 : L.recrawlHours;
  const due = urls.filter(([, v]) => !v.last || (NOW - new Date(v.last)) / 36e5 >= recrawl(v));
  due.sort((a, b) => priority(b[0], b[1]) - priority(a[0], a[1]));
  let listingPages = 0, newFound = 0, productTries = 0, deadRun = 0;
  if (searches) log(dom, searches + " gezielte Suchen für Produkte ohne Shop-Angebot eingeplant");
  for (const [u] of due) {
    if (perDomain[dom] >= L.maxRequestsPerDomain || requests >= L.maxRequestsPerRun) break;
    const kindBefore = state.urls[u]?.kind;
    const r = await get(u); tried++;
    if (kindBefore !== "listing" && kindBefore !== "search") productTries++;
    if (!r) break;
    if (r.blocked) { state.urls[u] = { last: NOW.toISOString(), kind: "nonproduct", d: dom }; continue; }
    if (r.status === 404 || r.status === 410) { state.urls[u] = { last: NOW.toISOString(), kind: "dead", d: dom }; deadRun++; continue; }
    deadRun = 0;
    if (r.status === 403 || r.status === 401) { D.blockedBot = (D.blockedBot || 0) + 1; log(dom, "Zugriff verweigert (HTTP " + r.status + "), vermutlich Bot-Schutz"); break; }
    if (r.status === 429 || r.status === 503) { log(dom, "Shop bremst (HTTP " + r.status + "), pausiere bis zum nächsten Lauf"); break; }
    if (r.status !== 200 || !r.text) { state.urls[u] = { ...state.urls[u], last: NOW.toISOString(), d: dom }; continue; }
    const links = extractLinks(r.text, r.url || u);
    for (const l of links.slice(0, 600)) { const ld = domainOf(l); if (ld !== dom) noteDomain(ld, l, dom); }
    const prevKind = state.urls[u]?.kind, want = state.urls[u]?.want;
    const p = prevKind === "search" ? null : parseProduct(r.text, r.url || u);
    if (p && record(dom, u, p)) hits++;
    else if (p) state.urls[u] = { last: NOW.toISOString(), kind: "nonproduct", d: dom };
    else {
      // Liste, Kategorie- oder Suchseite: Produktlinks einsammeln
      const own = [...new Set(links.filter(l => domainOf(l) === dom).map(cleanUrl))];
      let picked;
      if (prevKind === "search" && want) picked = own.filter(l => similarity(want, pathWords(new URL(l))) >= 0.6).slice(0, 3);
      else picked = own.filter(l => urlLooksRelevant(new URL(l))).slice(0, 400);
      for (const l of picked) if (!state.urls[l]) { state.urls[l] = { last: null, key: null, kind: "candidate", d: dom, from: prevKind === "search" ? "search" : "listing" }; newFound++; }
      const isListing = prevKind === "search" || picked.length >= 8;
      state.urls[u] = { last: NOW.toISOString(), kind: prevKind === "search" ? "search" : isListing ? "listing" : "candidate", d: dom, cat: state.urls[u]?.cat, want };
      if (isListing && prevKind !== "search" && GROW.followListings && listingPages < (GROW.maxListingPagesPerDomain || 40)) {
        for (const nx of nextPageLinks(r.text, r.url || u, dom)) if (!state.urls[nx]) { state.urls[nx] = { last: null, kind: "listing", d: dom }; listingPages++; }
      }
    }
    if (productTries >= 40 && hits === 0) { log(dom, "keine Produktdaten auf den ersten 40 Produktseiten gefunden"); break; }
    if (deadRun >= 30 && hits === 0) { log(dom, "30 Seiten in Folge nicht gefunden, der Shop blockt vermutlich Bots"); break; }
  }
  D.lastCrawl = NOW.toISOString();
  D.products = Object.values(state.products).filter(p => p.offers[dom] && fresh(p.offers[dom])).length;
  if (hits === 0 && tried > 0) D.fails = (D.fails || 0) + 1; else if (hits > 0) D.fails = 0;
  if (D.status === "candidate") D.status = hits > 0 ? "active" : (D.fails >= 2 ? "rejected" : "candidate");
  if (D.status === "active" && !D.seed && D.fails >= 4) D.status = "rejected";
  log(dom, `${tried} Seiten geprüft, ${hits} Produkte mit Preis, ${newFound} neue Produktseiten entdeckt` + (D.status !== "active" ? ` (Status: ${D.status})` : ""));
}
function domainOfStr(s) { const u = safeUrl(s); return u ? domainOf(u) : ""; }

/* ---------------- Neue Shops entdecken ---------------- */
function noteDomain(dom, u, from) {
  if (!CFG.discovery.enabled || state.domains[dom] || isBlocked(dom)) return;
  const tld = "." + dom.split(":")[0].split(".").pop();
  if (!TEST && !CFG.discovery.onlyTlds.includes(tld)) return;
  const e = state.discovered[dom] ??= { origin: u.origin, firstSeen: TODAY, seenOn: [], hits: 0 };
  e.hits++;
  if (!e.seenOn.includes(from) && e.seenOn.length < 5) e.seenOn.push(from);
}
async function verifyCandidates() {
  const cands = Object.entries(state.discovered).filter(([d]) => !state.domains[d] && !isBlocked(d))
    .sort((a, b) => b[1].hits - a[1].hits).slice(0, CFG.discovery.maxCandidatesPerRun);
  let added = 0;
  for (const [dom, e] of cands) {
    if (added >= L.maxNewDomainsPerRun || Object.values(state.domains).filter(x => x.status === "active").length >= L.maxActiveDomains) break;
    const rob = await robotsFor(new URL(e.origin));
    if (!rob || rob.deny) { state.domains[dom] = { status: "rejected", origin: e.origin, reason: "robots", fails: 9 }; continue; }
    const r = await get(e.origin + "/");
    if (!r || r.status !== 200 || !r.text) { e.hits = Math.floor(e.hits / 2); continue; }
    const html = r.text;
    const shopLike = /warenkorb|in den warenkorb|zur kasse|add to cart|versandkosten|lieferzeit/i.test(html);
    const hwLike = CFG.categories.some(c => c.any.slice(0, 4).some(w => norm(html).includes(norm(w))));
    if (shopLike && hwLike) {
      state.domains[dom] = { status: "candidate", origin: new URL(r.url || e.origin).origin, fails: 0, products: 0, foundVia: e.seenOn, added: TODAY };
      added++; log("Neuer Shop-Kandidat:", dom, "(gefunden auf " + e.seenOn.join(", ") + ")");
    } else state.domains[dom] = { status: "rejected", origin: e.origin, reason: "kein Hardware-Shop", fails: 9 };
  }
  return added;
}

/* ---------------- Ausgabe für die Website ---------------- */
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
function median(a) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; }
function buildOutputs() {
  const catalogFile = path.join(DATA_DIR, "catalog.json"), dealsFile = path.join(DATA_DIR, "deals.json");
  const catalog = loadJSON(catalogFile, { products: [] }), deals = loadJSON(dealsFile, { deals: [] });
  const manual = (catalog.products || []).filter(p => p.source !== "crawler");
  const nkey = n => norm(n).replace(/\((?:boxed|tray)[^)]*\)/g, "").replace(/[^a-z0-9]/g, "");
  const manualBy = new Map(manual.map(p => [nkey(p.name), p]));
  // frühere Crawler-Angebote aus den manuell gepflegten Produkten entfernen, sie werden neu eingetragen
  for (const m of manual) if (m.offers) { m.offers = m.offers.filter(o => !o.crawler); if (!m.offers.length) m.offers = [{ shop: m.shop, price: m.price, ship: null, avail: null }]; }
  const out = [], newDeals = [], usedIds = new Set();
  for (const [key, rec] of Object.entries(state.products)) {
    const offers = Object.values(rec.offers).filter(fresh).filter(o => o.avail !== "Nicht lieferbar").sort((a, b) => a.price - b.price);
    if (!offers.length) continue;
    const best = offers[0];
    let id = "c-" + slug(rec.name);
    if (usedIds.has(id)) id += "-" + Math.abs([...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).slice(0, 5);
    usedIds.add(id);
    const p = {
      id, cat: rec.cat, sub: rec.sub, name: rec.name, source: "crawler",
      url: best.url, stand: offers.map(o => o.seen).sort().pop().slice(0, 16),
      offers: offers.slice(0, 8).map(o => ({ shop: o.shop, price: o.price, ship: o.ship, avail: o.avail, url: o.url })),
      price: best.price, shop: best.shop, hist: rec.hist.slice(-90), count: offers.length,
      tags: tagsOf(rec.name, rec.cat, rec.sub), firstSeen: rec.firstSeen || TODAY
    };
    if (rec.img) p.img = rec.img;
    let m = manualBy.get(nkey(rec.name));
    if (!m) { let bestS = 0; for (const x of manual) if (x.cat === rec.cat) { const sim = similarity(x.name, rec.name); if (sim > bestS) { bestS = sim; m = x; } } if (bestS < 0.85) m = null; }
    if (m) {
      const shops = new Set((m.offers || []).map(o => norm(o.shop)));
      for (const o of p.offers) if (!shops.has(norm(o.shop))) m.offers.push({ ...o, crawler: true });
      m.offers.sort((a, b) => a.price - b.price);
      if (m.offers[0].price <= m.price || m.offers[0].crawler) { m.price = m.offers[0].price; m.shop = m.offers[0].shop; }
      if (p.stand > (m.stand || "")) m.stand = p.stand;
      const h = (m.hist ||= []), last = h[h.length - 1];
      if (last && last.d === TODAY) last.p = Math.min(last.p, m.price); else h.push({ d: TODAY, p: m.price });
    } else out.push(p);

    // Deal-Erkennung
    const past = rec.hist.filter(h => h.d !== TODAY && (NOW - new Date(h.d)) / 864e5 <= 30).map(h => h.p);
    const med = past.length >= 3 ? median(past) : null;
    const second = offers[1] ? offers[1].price : null;
    let ref = null, note = null;
    if (med && best.price <= med * (1 - CFG.deals.dropVsHistory)) { ref = round(med); note = Math.round((1 - best.price / med) * 100) + " % unter dem mittleren Preis der letzten 30 Tage."; }
    else if (second && offers.length >= 3 && best.price <= second * (1 - CFG.deals.belowOtherShops)) { ref = second; note = Math.round((1 - best.price / second) * 100) + " % günstiger als der nächste Shop (" + offers[1].shop + ")."; }
    if (ref) newDeals.push({
      id, name: rec.name, cat: rec.cat, price: best.price, ref, shop: best.shop, shopUrl: best.url, url: best.url,
      note, hist: rec.hist.slice(-60), histLabel: "Skala: günstigster Preis laut Hardware-Radar-Crawler", seen: TODAY, updated: TODAY,
      tags: tagsOf(rec.name, rec.cat, rec.sub), source: "crawler", score: 1 - best.price / ref
    });
  }
  out.sort((a, b) => b.count - a.count || a.price - b.price);
  catalog.products = manual.concat(out.slice(0, Math.max(0, L.maxCatalogProducts - manual.length)));
  catalog.updated = NOW.toISOString();
  newDeals.sort((a, b) => b.score - a.score);
  const keep = (deals.deals || []).filter(d => d.source !== "crawler");
  deals.deals = keep.concat(newDeals.slice(0, Math.max(0, L.maxDeals - keep.length)).map(({ score, ...d }) => d));
  deals.updated = NOW.toISOString();
  return { catalog, deals, catalogFile, dealsFile, crawled: out.length, found: newDeals.length };
}

/* ---------------- Ablauf ---------------- */
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); })); }
function cleanup() {
  // gesperrte Domains entfernen und alle Produkte mit den aktuellen Regeln neu prüfen
  let dropped = 0, offers = 0;
  for (const [d, v] of Object.entries(state.domains)) if (isBlocked(d)) { delete state.domains[d]; }
  for (const d of Object.keys(state.discovered)) if (isBlocked(d)) delete state.discovered[d];
  for (const [u, v] of Object.entries(state.urls)) if (!v.d || isBlocked(v.d)) delete state.urls[u];
  for (const [k, p] of Object.entries(state.products)) {
    for (const d of Object.keys(p.offers)) if (isBlocked(d)) { delete p.offers[d]; offers++; }
    const anyPrice = Object.values(p.offers).map(o => o.price)[0];
    const cat = anyPrice != null ? classify(p.name, anyPrice) : null;
    if (!cat || !Object.keys(p.offers).length) { delete state.products[k]; dropped++; continue; }
    p.cat = cat; p.sub = subOf(cat, p.name);
  }
  for (const [cat, words] of Object.entries(state.learned)) state.learned[cat] = (words || []).filter(w => /\d/.test(w) || /^(Kühlung|Netzteile|Gehäuse)$/.test(cat));
  if (dropped || offers) log(`Aufgeräumt: ${dropped} unpassende Produkte und ${offers} Angebote gesperrter Seiten entfernt`);
}
/* Schnell-Prüfung (--refresh): nur bekannte Produktseiten erneut abrufen, ohne neue Seiten zu suchen.
   Läuft zwischen den großen Durchläufen, damit Preissenkungen schnell auf der Website landen. */
async function refreshDomain(dom) {
  const D = state.domains[dom], cap = (CFG.refresh && CFG.refresh.perDomain) || 120, minAgeH = (CFG.refresh && CFG.refresh.minAgeHours) || 1.5;
  const rob = await robotsFor(new URL(D.origin)); if (!rob || rob.deny) return;
  const list = Object.entries(state.urls).filter(([, v]) => v.d === dom && v.kind === "product" && (!v.last || (NOW - new Date(v.last)) / 36e5 >= minAgeH))
    .sort((a, b) => (a[1].last ? Date.parse(a[1].last) : 0) - (b[1].last ? Date.parse(b[1].last) : 0)).slice(0, cap);
  let hits = 0;
  for (const [u] of list) {
    if (perDomain[dom] >= L.maxRequestsPerDomain || requests >= L.maxRequestsPerRun) break;
    const r = await get(u); if (!r) break;
    if (r.status === 404 || r.status === 410) { state.urls[u] = { last: NOW.toISOString(), kind: "dead", d: dom }; continue; }
    if (r.status === 403 || r.status === 401 || r.status === 429 || r.status === 503) { log(dom, "Schnell-Prüfung abgebrochen (HTTP " + r.status + ")"); break; }
    if (r.status !== 200 || !r.text) continue;
    const pr = parseProduct(r.text, r.url || u);
    if (pr && record(dom, u, pr)) hits++; else state.urls[u] = { ...state.urls[u], last: NOW.toISOString() };
  }
  log(dom, "Schnell-Prüfung: " + hits + " von " + list.length + " Preisen aktualisiert");
}

async function main() {
  cleanup();
  if (args.refresh) {
    const doms = Object.entries(state.domains).filter(([d, v]) => v.status === "active" && v.products > 0 && !isBlocked(d)).map(([d]) => d);
    log("Schnell-Prüfung für " + doms.length + " Shops");
    await pool(doms, 6, refreshDomain);
    const res = buildOutputs();
    state.runs = [...state.runs.slice(-29), { at: NOW.toISOString(), mode: "refresh", requests, newOffers: newOffersThisRun, crawlerProducts: res.crawled, deals: res.found }];
    log("Fertig (Schnell-Prüfung):", requests, "Abrufe,", newOffersThisRun, "neue Angebote,", res.found, "Deals");
    if (DRY) return;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    fs.writeFileSync(res.catalogFile, JSON.stringify(res.catalog, null, 1));
    fs.writeFileSync(res.dealsFile, JSON.stringify(res.deals, null, 1));
    return;
  }
  if (args.rebuild) { const res = buildOutputs(); if (!DRY) { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); fs.writeFileSync(res.catalogFile, JSON.stringify(res.catalog, null, 1)); fs.writeFileSync(res.dealsFile, JSON.stringify(res.deals, null, 1)); } log("Nur neu aufgebaut:", res.crawled, "Crawler-Produkte"); return; }
  log(`Start: ${Object.keys(state.domains).length} bekannte Shops, ${Object.keys(state.products).length} Produkte im Gedächtnis`);
  const active = Object.entries(state.domains).filter(([d, v]) => (v.status === "active" || v.status === "candidate") && !isBlocked(d))
    .sort((a, b) => (a[1].lastCrawl ? Date.parse(a[1].lastCrawl) : 0) - (b[1].lastCrawl ? Date.parse(b[1].lastCrawl) : 0)).map(([d]) => d);
  COUNTS = catCounts();
  const learned = learnKeywords();
  if (learned) log(learned + " neue Suchbegriffe aus gefundenen Produkten gelernt");
  await pool(active, 6, crawlDomain);
  const added = await verifyCandidates();
  if (added) { // neue Kandidaten gleich anprobieren, solange Budget da ist
    const fresh = Object.entries(state.domains).filter(([, v]) => v.status === "candidate" && !v.lastCrawl).map(([d]) => d);
    await pool(fresh, 4, crawlDomain);
  }
  // Gedächtnis begrenzen
  const urlEntries = Object.entries(state.urls);
  if (urlEntries.length > 60000) state.urls = Object.fromEntries(urlEntries.sort((a, b) => (b[1].last ? Date.parse(b[1].last) : 0) - (a[1].last ? Date.parse(a[1].last) : 0)).slice(0, 60000));
  for (const [k, p] of Object.entries(state.products)) if (!Object.values(p.offers).some(o => (NOW - new Date(o.seen)) / 864e5 < 30)) delete state.products[k];
  const disc = Object.entries(state.discovered); if (disc.length > 3000) state.discovered = Object.fromEntries(disc.sort((a, b) => b[1].hits - a[1].hits).slice(0, 3000));

  const res = buildOutputs();
  const activeN = Object.values(state.domains).filter(v => v.status === "active").length;
  COUNTS = catCounts(); learnKeywords();
  const summary = { at: NOW.toISOString(), requests, activeShops: activeN, newShops: added, newOffers: newOffersThisRun, crawlerProducts: res.crawled, deals: res.found, perCategory: COUNTS };
  log("Produkte je Kategorie:", Object.entries(COUNTS).map(([c, n]) => c + " " + n + "/" + ((GROW.targetPerCategory || {})[c] || 300)).join(", "));
  state.runs = [...state.runs.slice(-29), summary];
  log("Fertig:", JSON.stringify(summary));
  if (DRY) { log("Testlauf (--dry): nichts gespeichert"); return; }
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  fs.writeFileSync(res.catalogFile, JSON.stringify(res.catalog, null, 1));
  fs.writeFileSync(res.dealsFile, JSON.stringify(res.deals, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
