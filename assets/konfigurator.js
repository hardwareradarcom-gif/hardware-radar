/* Hardware-Radar PC-Konfigurator: Teile-Auswahl, Kompatibilitätsprüfung und Radar-Assistent.
   Läuft komplett im Browser. Optional: echte KI über einen eigenen Endpunkt (CFG.aiEndpoint, siehe tools/ai-worker). */
(function () {
  "use strict";
  var CFG = window.HR_CONFIG || {};
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function eur0(n) { return Math.round(n).toLocaleString("de-DE") + " €"; }
  function safeUrl(u) { try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x : null; } catch (e) { return null; } }
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


  /* ======================= Teile verstehen ======================= */
  var SLOTS = [
    { id: "cpu", cat: "Prozessoren", label: "Prozessor" },
    { id: "board", cat: "Mainboards", label: "Mainboard" },
    { id: "ram", cat: "Arbeitsspeicher", label: "Arbeitsspeicher" },
    { id: "gpu", cat: "Grafikkarten", label: "Grafikkarte" },
    { id: "ssd", cat: "SSDs", label: "SSD" },
    { id: "psu", cat: "Netzteile", label: "Netzteil" },
    { id: "case", cat: "Gehäuse", label: "Gehäuse" },
    { id: "cooler", cat: "Kühlung", label: "CPU-Kühler" },
    { id: "monitor", cat: "Monitore", label: "Monitor", optional: true }
  ];
  function n(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss"); }

  // Grobe Richtwerte: Spieleleistung (CPU: Ryzen 7 9800X3D = 100, GPU: RTX 5090 = 100), Mehrkern-Leistung, Stromaufnahme unter Last in Watt
  var CPU_TABLE = [
    [/9950x3d2/, 102, 104, 200], [/9950x3d/, 101, 100, 200], [/9850x3d/, 102, 56, 130], [/9800x3d/, 100, 55, 130], [/9900x3d/, 95, 78, 160],
    [/7800x3d/, 88, 50, 120], [/7500x3d/, 80, 36, 110], [/9950x/, 82, 100, 200], [/9900x/, 80, 78, 160], [/9700x/, 78, 55, 110], [/9600x/, 75, 42, 100],
    [/7700x/, 74, 52, 130], [/ryzen 7 7700\b/, 72, 50, 90], [/7600x/, 71, 40, 120], [/ryzen 5 7600\b/, 70, 38, 90], [/7500f/, 68, 36, 90],
    [/5800x3d/, 74, 40, 120], [/5950x/, 64, 62, 140], [/5900xt/, 63, 58, 140], [/5800xt/, 62, 43, 120], [/5800x\b/, 62, 42, 120], [/5700x3d/, 70, 38, 110],
    [/5700x\b/, 60, 40, 90], [/5700g/, 52, 36, 90], [/5600xt/, 58, 31, 90], [/5600x\b/, 57, 30, 90], [/ryzen 5 5600\b/, 56, 29, 90], [/5500f?\b/, 48, 26, 80],
    [/ultra 9 285k/, 84, 100, 250], [/ultra 7 270k/, 82, 88, 230], [/ultra 7 265k/, 80, 84, 230], [/ultra 5 250k/, 76, 62, 170], [/ultra 5 245k/, 74, 58, 170],
    [/14900k/, 86, 92, 260], [/14700k/, 84, 82, 240], [/14600k/, 78, 60, 190], [/14500/, 72, 50, 150], [/14400/, 68, 40, 150], [/12400/, 60, 30, 120]
  ];
  var GPU_TABLE = [
    [/rtx 5090/, 100, 575], [/rtx 5080/, 72, 360], [/rtx 5070 ti/, 61, 300], [/rtx 5070/, 50, 250], [/rtx 5060 ti 16/, 39, 180], [/rtx 5060 ti/, 37, 180],
    [/rtx 5060/, 33, 150], [/rtx 5050/, 26, 130], [/rx 9070 xt/, 60, 304], [/rx 9070 gre/, 46, 220], [/rx 9070/, 53, 220], [/rx 9060 xt/, 38, 160],
    [/rx 9060/, 32, 140], [/ai pro r9700/, 55, 300], [/arc b580/, 30, 190], [/arc b570/, 26, 150]
  ];
  var BOXED_COOLER = /ryzen 5 5500|ryzen 5 5600x?\b|5600xt|5700g|ryzen 5 7600\b|ryzen 7 7700\b|i5-14400|i5-14500|12400\b/;

  function attrs(p) {
    if (p._a) return p._a;
    var name = n(p.name), sub = n(p.sub), a = {};
    switch (p.cat) {
      case "Prozessoren": {
        a.socket = /am5/.test(sub) ? "AM5" : /am4/.test(sub) ? "AM4" : /1851/.test(sub) || /core ultra/.test(name) ? "LGA1851" : /1700/.test(sub) || /i[3579]-1[234]/.test(name) ? "LGA1700" : "?";
        var row = CPU_TABLE.find(function (r) { return r[0].test(name.replace(/\s+/g, " ")); }) || [null, 55, 35, 120];
        a.game = row[1]; a.work = row[2]; a.watt = row[3];
        a.cooler = /boxed/.test(name) && !/ohne kuhler|ohne kühler/.test(name) && BOXED_COOLER.test(name);
        a.igpu = !/\bf\b|f\b \(|kf\b|[0-9]f\b/.test(name.replace(/\(.*?\)/g, "")) && !/ryzen [579] 5\d{3}(?!g)/.test(name);
        break;
      }
      case "Mainboards": {
        a.socket = /^am5/.test(sub) ? "AM5" : /^am4/.test(sub) ? "AM4" : /z890|b860|h810/.test(sub + name) ? "LGA1851" : /z790|b760|h770|h610|z690|b660/.test(sub + name) ? "LGA1700" : /b6[05]0|b850|x870|x670|a620/.test(name) ? "AM5" : /b550|x570|a520|b450/.test(name) ? "AM4" : "?";
        a.ddr = a.socket === "AM5" || a.socket === "LGA1851" ? 5 : a.socket === "AM4" ? 4 : /ddr4/.test(name) ? 4 : 5;
        a.ff = /mini-itx|\bitx\b|b\d{3}i\b|x\d{3}i\b/.test(name) ? "ITX" : /matx|m-atx|micro|\b[abxz]\d{3}m\b|\b[abxz]\d{3}m-/.test(name) ? "mATX" : "ATX";
        a.wifi = /wifi|wi-fi|wlan|\bax\b/.test(name);
        break;
      }
      case "Arbeitsspeicher": {
        a.ddr = /ddr4/.test(name + sub) ? 4 : 5;
        var g = /(\d{2,3})\s?gb/.exec(name + " " + sub); a.gb = g ? +g[1] : 16;
        a.sodimm = /sodimm|so-dimm/.test(name);
        break;
      }
      case "Grafikkarten": {
        var key = (sub + " " + name).replace(/\s+/g, " ");
        var gr = GPU_TABLE.find(function (r) { return r[0].test(key); }) || [null, 30, 200];
        a.perf = gr[1]; a.watt = gr[2];
        a.brand = /radeon|\brx\b/.test(key) ? "amd" : /geforce|rtx/.test(key) ? "nvidia" : /arc/.test(key) ? "intel" : "?";
        a.pro = /ai pro|workstation|quadro/.test(key);
        break;
      }
      case "SSDs": { var tb = /(\d+(?:[.,]\d+)?)\s?tb/.exec(name + " " + sub), gb = /(\d{3,4})\s?gb/.exec(name); a.tb = tb ? parseFloat(tb[1].replace(",", ".")) : gb ? +gb[1] / 1000 : 1; break; }
      case "Netzteile": { var w = /(\d{3,4})\s?w\b/.exec(name); a.watt = w ? +w[1] : 0; a.sfx = /sfx/.test(name + sub); break; }
      case "Gehäuse": { a.fits = /mini-itx-geh|\bitx\b/.test(name) && !/atx/.test(name.replace(/mini-itx/, "")) ? ["ITX"] : /micro-atx|m-atx|matx/.test(name) ? ["mATX", "ITX"] : ["ATX", "mATX", "ITX"]; break; }
      case "Kühlung": {
        // nur echte CPU-Kühler zählen; Gehäuselüfter (auch ohne das Wort "Lüfter" im Namen) werden aussortiert
        a.fan = /^lufter$/.test(sub) || !/kuhler|cooler|freezer|assassin|spirit|rock|aio|loop|liquid|kraken|brocken|nh-[a-z]|contac|tower|wasser/.test(name);
        a.aio = /aio|wasser|liquid|loop|kraken/.test(name + sub);
        a.cap = a.aio || /phantom spirit|peerless|dark rock|brocken|nh-d15|nh-u12|assassin/.test(name) ? 260 : 160;
        break;
      }
      case "Monitore": {
        a.res = /4k|uhd|3840|2160|wuhd/.test(name + sub) ? 2160 : /wqhd|uwqhd|1440|qhd/.test(name + sub) ? 1440 : 1080;
        var hz = /(\d{3})\s?hz/.exec(name); a.hz = hz ? +hz[1] : 0;
        a.oled = /oled/.test(name + sub);
        break;
      }
    }
    p._a = a; return a;
  }

  /* ======================= Kompatibilität ======================= */
  function needWatt(b) {
    var c = b.cpu ? attrs(b.cpu).watt : 120, g = b.gpu ? attrs(b.gpu).watt : 0;
    return Math.ceil((c + g + 90) * 1.25 / 50) * 50;
  }
  function needsCooler(b) { return b.cpu && !attrs(b.cpu).cooler; }
  // Gründe, warum Teil p nicht zur restlichen Zusammenstellung b passt (leer = passt)
  function conflicts(slot, p, b) {
    var a = attrs(p), why = [];
    function other(id) { return id === slot ? null : b[id]; }
    var cpu = other("cpu"), board = other("board"), ram = other("ram"), cs = other("case"), psu = other("psu"), gpu = other("gpu");
    if (slot === "cpu" && board && attrs(board).socket !== a.socket) why.push("passt nicht auf das Mainboard (" + attrs(board).socket + ")");
    if (slot === "board") {
      if (cpu && attrs(cpu).socket !== a.socket) why.push("falscher Sockel für den Prozessor (" + attrs(cpu).socket + ")");
      if (ram && attrs(ram).ddr !== a.ddr) why.push("braucht DDR" + a.ddr + "-Arbeitsspeicher");
      if (cs && attrs(cs).fits.indexOf(a.ff) < 0) why.push(a.ff + "-Board passt nicht ins Gehäuse");
    }
    if (slot === "ram" && board && attrs(board).ddr !== a.ddr) why.push("Mainboard braucht DDR" + attrs(board).ddr);
    if (slot === "ram" && a.sodimm) why.push("Laptop-Speicher (SO-DIMM)");
    if (slot === "case" && board && a.fits.indexOf(attrs(board).ff) < 0) why.push("zu klein für ein " + attrs(board).ff + "-Mainboard");
    if (slot === "psu") { var need = needWatt({ cpu: cpu, gpu: gpu }); if (a.watt && a.watt < need) why.push("zu schwach, empfohlen ab " + need + " W"); }
    if (slot === "gpu" && psu && attrs(psu).watt && attrs(psu).watt < needWatt({ cpu: cpu, gpu: p })) why.push("Netzteil zu schwach für diese Karte");
    if (slot === "cooler") { if (a.fan) why.push("nur ein Gehäuselüfter, kein CPU-Kühler"); else if (cpu && a.cap < attrs(cpu).watt) why.push("zu schwach für diesen Prozessor"); }
    return why;
  }
  function checkBuild(b) {
    var out = [];
    var missing = SLOTS.filter(function (s) { return !s.optional && !b[s.id] && !(s.id === "cooler" && (!b.cpu || !needsCooler(b))); });
    SLOTS.forEach(function (s) { if (b[s.id]) conflicts(s.id, b[s.id], b).forEach(function (w) { out.push({ lvl: "bad", slot: s.id, text: s.label + ": " + w }); }); });
    if (b.cpu && !b.gpu && !attrs(b.cpu).igpu) out.push({ lvl: "bad", text: "Dieser Prozessor hat keine eingebaute Grafik, du brauchst eine Grafikkarte." });
    if (b.cpu && !needsCooler(b) && !b.cooler) out.push({ lvl: "ok", text: "Prozessor wird mit Kühler geliefert." });
    if (b.cpu && needsCooler(b) && !b.cooler) out.push({ lvl: "warn", text: "Prozessor kommt ohne Kühler, wähle einen CPU-Kühler." });
    if (b.board && b.cpu && attrs(b.board).socket === attrs(b.cpu).socket) out.push({ lvl: "ok", text: "Sockel passt (" + attrs(b.cpu).socket + ")." });
    if (b.board && b.ram && attrs(b.board).ddr === attrs(b.ram).ddr) out.push({ lvl: "ok", text: "Arbeitsspeicher passt (DDR" + attrs(b.ram).ddr + ")." });
    if (b.psu && attrs(b.psu).watt) { var need = needWatt(b); if (attrs(b.psu).watt >= need) out.push({ lvl: "ok", text: "Netzteil reicht: " + attrs(b.psu).watt + " W, empfohlen ab " + need + " W." }); }
    if (b.case && b.board && attrs(b.case).fits.indexOf(attrs(b.board).ff) >= 0) out.push({ lvl: "ok", text: attrs(b.board).ff + "-Mainboard passt ins Gehäuse." });
    if (b.gpu && b.psu && attrs(b.psu).sfx && b.case && attrs(b.case).fits.indexOf("ATX") >= 0) out.push({ lvl: "warn", text: "SFX-Netzteil im ATX-Gehäuse braucht meist eine Adapterblende." });
    var miss = missing.map(function (s) { return s.label; });
    if (miss.length && Object.keys(b).length) out.push({ lvl: "warn", text: "Noch offen: " + miss.join(", ") + "." });
    out.sort(function (x, y) { return { bad: 0, warn: 1, ok: 2 }[x.lvl] - { bad: 0, warn: 1, ok: 2 }[y.lvl]; });
    return out;
  }

  /* ======================= Assistent: Zusammenstellung suchen ======================= */
  var WEIGHTS = { "1080": [0.45, 0.55], "1440": [0.3, 0.7], "2160": [0.15, 0.85], work: [0.6, 0.4] };
  var USE_TEXT = { "1080": "Gaming in Full HD", "1440": "Gaming in WQHD", "2160": "Gaming in 4K", work: "Streaming und Arbeit" };
  function cheapest(list, ok) { var best = null; list.forEach(function (p) { if ((!ok || ok(p)) && (!best || p.price < best.price)) best = p; }); return best; }
  function sum(b) { return SLOTS.reduce(function (t, s) { return t + (b[s.id] && !(s.optional) ? b[s.id].price : 0); }, 0); }

  function assemble(opt) {
    var P = byCat, res = { builds: [], reason: "" };
    var w = WEIGHTS[opt.use] || WEIGHTS["1440"];
    var sockets = {};
    P.Mainboards.forEach(function (bd) { var s = attrs(bd).socket; if (s !== "?") sockets[s] = 1; });
    var plats = Object.keys(sockets);
    if (!plats.length) { res.reason = "Im Katalog fehlen gerade Mainboards."; return res; }
    var gpus = P.Grafikkarten.filter(function (g) { return !attrs(g).pro && (opt.gpu === "any" || attrs(g).brand === opt.gpu); });
    if (!gpus.length) gpus = P.Grafikkarten.filter(function (g) { return !attrs(g).pro; });
    // je GPU-Leistungsstufe nur das günstigste Modell betrachten (spart Rechenzeit, ändert das Ergebnis nicht)
    var gBest = {}; gpus.forEach(function (g) { var k = attrs(g).perf + "|" + attrs(g).brand; if (!gBest[k] || g.price < gBest[k].price) gBest[k] = g; });
    gpus = Object.keys(gBest).map(function (k) { return gBest[k]; });
    var all = [];
    plats.forEach(function (sock) {
      var board = cheapest(P.Mainboards, function (bd) { var a = attrs(bd); return a.socket === sock && a.ff !== "ITX" && (!opt.wifi || a.wifi); }) || cheapest(P.Mainboards, function (bd) { return attrs(bd).socket === sock && attrs(bd).ff !== "ITX"; });
      if (!board) return;
      var ddr = attrs(board).ddr;
      var wantGb = opt.budget < 800 ? 16 : 32;
      var ram = cheapest(P.Arbeitsspeicher, function (r) { return attrs(r).ddr === ddr && !attrs(r).sodimm && attrs(r).gb >= wantGb; }) || cheapest(P.Arbeitsspeicher, function (r) { return attrs(r).ddr === ddr && !attrs(r).sodimm; });
      if (!ram) return;
      var ssd = cheapest(P.SSDs, function (s) { return attrs(s).tb >= (opt.budget >= 1100 ? 2 : 1); }) || cheapest(P.SSDs);
      var cs = cheapest(P["Gehäuse"], function (c) { return attrs(c).fits.indexOf(attrs(board).ff) >= 0; });
      var cpuBest = {}; P.Prozessoren.forEach(function (c) { if (attrs(c).socket !== sock) return; var k = attrs(c).game + "|" + attrs(c).work + "|" + attrs(c).cooler; if (!cpuBest[k] || c.price < cpuBest[k].price) cpuBest[k] = c; });
      Object.keys(cpuBest).forEach(function (k) {
        var cpu = cpuBest[k], ca = attrs(cpu);
        var cooler = ca.cooler ? null : cheapest(P["Kühlung"], function (c) { return !attrs(c).fan && attrs(c).cap >= ca.watt; });
        if (!ca.cooler && !cooler) return;
        gpus.forEach(function (gpu) {
          var b = { cpu: cpu, board: board, ram: ram, gpu: gpu, ssd: ssd, case: cs, cooler: cooler };
          var need = needWatt(b);
          b.psu = cheapest(P.Netzteile, function (x) { return attrs(x).watt >= need && !(attrs(x).sfx && cs && attrs(cs).fits.indexOf("ATX") >= 0); }) || cheapest(P.Netzteile, function (x) { return attrs(x).watt >= need; });
          if (!b.psu) return;
          var total = sum(b);
          var score = w[0] * (opt.use === "work" ? ca.work : ca.game) + w[1] * attrs(gpu).perf;
          // Balance: zu schwache CPU bremst eine starke Karte (und umgekehrt)
          if (opt.use !== "work" && ca.game < 0.55 * 100 * Math.min(1, attrs(gpu).perf / 60)) score *= 0.9;
          all.push({ b: b, total: total, score: score });
        });
      });
    });
    if (!all.length) { res.reason = "Mit den aktuellen Teilen im Katalog konnte ich keinen vollständigen PC bilden."; return res; }
    var fit = all.filter(function (x) { return x.total <= opt.budget; });
    if (!fit.length) {
      var minB = all.reduce(function (m, x) { return x.total < m.total ? x : m; });
      res.reason = "Für " + eur0(opt.budget) + " finde ich gerade keinen vollständigen PC. Der günstigste passende kostet " + eur0(minB.total) + ".";
      if (minB.b.ram && minB.b.ram.price > minB.total * 0.25) res.reason += " Der Grund ist vor allem der Arbeitsspeicher: Durch die aktuelle Speicherkrise kosten " + attrs(minB.b.ram).gb + " GB gerade ab " + eur0(minB.b.ram.price) + ".";
      res.cheapest = minB; return res;
    }
    fit.sort(function (x, y) { return y.score - x.score || x.total - y.total; });
    var best = fit[0];
    // Restbudget sinnvoll nutzen: größere SSD
    var left = opt.budget - best.total;
    var big = cheapest(byCat.SSDs, function (s) { return attrs(s).tb > attrs(best.b.ssd).tb; });
    if (big && big.price - best.b.ssd.price <= left && left > 60) { best.b.ssd = big; best.total = sum(best.b); }
    res.builds = [best];
    // Alternative: was bringt mehr Budget?
    var up = all.filter(function (x) { return x.total > best.total && x.total <= opt.budget * 1.25 && x.score > best.score * 1.08; }).sort(function (x, y) { return (x.total - best.total) / (x.score - best.score) - (y.total - best.total) / (y.score - best.score); })[0];
    if (up) res.up = up;
    var down = fit.filter(function (x) { return x.total < best.total * 0.85 && x.score >= best.score * 0.9; }).sort(function (x, y) { return x.total - y.total; })[0];
    if (down) res.down = down;
    if (opt.monitor) {
      res.monitor = cheapest(byCat.Monitore, function (m) { var a = attrs(m); return a.res === (opt.use === "work" ? 1440 : +opt.use) && !a.oled; }) || cheapest(byCat.Monitore, function (m) { return attrs(m).res === (opt.use === "work" ? 1440 : +opt.use); });
    }
    return res;
  }

  function explain(res, opt) {
    var x = res.builds[0], b = x.b, out = [];
    var gp = Math.round(b.gpu.price / x.total * 100);
    out.push("<p>Für <b>" + USE_TEXT[opt.use] + "</b> mit <b>" + eur0(opt.budget) + "</b> schlage ich diesen PC für <b>" + eur(x.total) + "</b> vor" + (opt.budget - x.total > 5 ? " (" + eur0(opt.budget - x.total) + " unter Budget)" : "") + ":</p>");
    var li = [];
    li.push("<b>Grafikkarte " + esc(b.gpu.sub || b.gpu.name) + "</b>: " + (opt.use === "work" ? "solide Leistung für Videoschnitt und Encoding" : "die stärkste Karte, die in dein Budget passt") + ", " + gp + " % des Budgets.");
    var ca = attrs(b.cpu);
    li.push("<b>" + esc(cleanName(b.cpu.name)) + "</b>: " + (opt.use === "work" ? "viele Kerne zum fairen Preis" : ca.game >= 95 ? "einer der schnellsten Gaming-Prozessoren" : ca.game >= 80 ? "schnell genug, damit die Grafikkarte nicht ausgebremst wird" : "reicht für die gewählte Grafikkarte") + (ca.cooler ? ", Kühler ist dabei." : "."));
    li.push("<b>" + esc(cleanName(b.board.name)) + "</b>: günstigstes passendes " + ca.socket + "-Board" + (opt.wifi && attrs(b.board).wifi ? " mit WLAN" : "") + ".");
    li.push("<b>" + attrs(b.ram).gb + " GB DDR" + attrs(b.ram).ddr + "</b>, <b>" + String(attrs(b.ssd).tb).replace(".", ",") + " TB SSD</b>, Netzteil mit <b>" + attrs(b.psu).watt + " W</b> (nötig sind etwa " + needWatt(b) + " W)" + (b.cooler ? ", dazu der " + esc(cleanName(b.cooler.name)) : "") + ".");
    out.push("<ul><li>" + li.join("</li><li>") + "</li></ul>");
    if (res.up) {
      var d = res.up.b, more = Math.round(res.up.total - x.total), gain = Math.round((res.up.score / x.score - 1) * 100);
      out.push("<p>Tipp: Für <b>" + eur0(more) + " mehr</b> bekommst du mit " + esc(d.gpu.sub || d.gpu.name) + (d.cpu.id !== b.cpu.id ? " und " + esc(cleanName(d.cpu.name)) : "") + " etwa <b>" + gain + " % mehr Leistung</b>.</p>");
    }
    if (res.down) out.push("<p>Sparen geht auch: Für " + eur0(res.down.total) + " gibt es eine Variante mit kaum weniger Leistung.</p>");
    if (res.monitor) out.push("<p>Passender Monitor: <b>" + esc(res.monitor.name) + "</b> für " + eur(res.monitor.price) + " (kommt zum PC dazu).</p>");
    out.push("<p>Du kannst jedes Teil rechts tauschen oder mir schreiben, was du anders willst, z. B. „leiser“, „mehr Speicher“ oder „stärkere Grafikkarte“.</p>");
    return out.join("");
  }

  /* ======================= Chat verstehen ======================= */
  function parseWish(text, opt) {
    var t = n(text), o = Object.assign({}, opt), notes = [], changed = false;
    var num = /(\d{1,2}[.\s]?\d{3}|\d{3,5})\s*(€|euro|eur|\b)/.exec(t.replace(/(\d)\.(\d{3})/g, "$1$2"));
    if (num) { var v = parseInt(num[1].replace(/\D/g, ""), 10); if (v >= 400 && v <= 12000) { o.budget = v; changed = true; } }
    if (/\b4k\b|uhd|2160/.test(t)) { o.use = "2160"; changed = true; }
    else if (/wqhd|1440p?|\b2k\b|qhd/.test(t)) { o.use = "1440"; changed = true; }
    else if (/full ?hd|1080p?|\bfhd\b/.test(t)) { o.use = "1080"; changed = true; }
    if (/stream|arbeit|render|video|schnitt|blender|programmier|homeoffice|office/.test(t)) { o.use = "work"; changed = true; }
    if (/nvidia|geforce|\brtx\b/.test(t)) { o.gpu = "nvidia"; changed = true; }
    else if (/radeon|amd grafik|\brx\b/.test(t)) { o.gpu = "amd"; changed = true; }
    else if (/grafik(karte)? egal|egal welche/.test(t)) { o.gpu = "any"; changed = true; }
    if (/ohne (wlan|wifi)|kein (wlan|wifi)|lan reicht/.test(t)) { o.wifi = false; changed = true; } else if (/wlan|wifi/.test(t)) { o.wifi = true; changed = true; }
    if (/ohne monitor|kein monitor/.test(t)) { o.monitor = false; changed = true; } else if (/monitor|bildschirm/.test(t)) { o.monitor = true; changed = true; }
    if (/starker|mehr leistung|bessere grafik|schneller|mehr fps/.test(t) && !num) { o.budget = Math.round(o.budget * 1.15 / 50) * 50; changed = true; notes.push("Ich habe das Budget um 15 % auf " + eur0(o.budget) + " erhöht."); }
    if (/gunstiger|billiger|spar|weniger ausgeben|zu teuer/.test(t) && !num) { o.budget = Math.round(o.budget * 0.88 / 50) * 50; changed = true; notes.push("Ich habe das Budget auf " + eur0(o.budget) + " gesenkt."); }
    if (/intel/.test(t)) notes.push("Für Intel-Prozessoren habe ich gerade keine passenden Mainboards im Katalog, deshalb plane ich mit AMD. Der Crawler ergänzt laufend neue Teile.");
    if (/leise|silent|ruhig/.test(t)) notes.push("Für einen leisen PC lohnt ein größerer Kühler und ein Gehäuse mit gedämmten Seitenteilen. Tausch dafür rechts Kühler und Gehäuse, ich prüfe weiter, ob alles passt.");
    if (/mehr speicher|mehr ssd|grossere ssd|4 ?tb/.test(t)) { o.storage = true; notes.push("Ich nehme die größte sinnvolle SSD dazu."); changed = true; }
    var ask = /warum|wieso|erklar|begrund/.test(t), help = /hilfe|was kannst|wie funktioniert/.test(t);
    return { opt: o, changed: changed, notes: notes, ask: ask, help: help };
  }

  /* ======================= Oberfläche ======================= */
  var byCat = {}, all = [], build = {}, opt = { budget: 1500, use: "1440", gpu: "any", wifi: true, monitor: false };
  var lastRes = null;
  var $ = function (id) { return document.getElementById(id); };
  try { var so = JSON.parse(store("hr-cfg-opt") || "null"); if (so) opt = Object.assign(opt, so); } catch (e) {}

  function thumbFor(p, cat) {
    var c = p ? p.cat : cat, u = p && p.img ? safeUrl(p.img) : null;
    return '<div class="thumb"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[c] || ICON["Prozessoren"]) + "</svg>" + (u ? '<img src="' + esc(u.toString()) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "") + "</div>";
  }
  function bestOffer(p) {
    var offs = (p.offers || []).slice().sort(function (a, b) { return a.price - b.price; });
    var o = offs[0] || { shop: p.shop, price: p.price, url: p.shopUrl || p.url };
    var l = shopLink(o.url || p.shopUrl, o.shop, p.name) || shopLink(p.url, p.shop, p.name) || fallbackLink(p.name);
    return { o: o, link: l };
  }
  function slotMeta(s, p) {
    var a = attrs(p);
    switch (s.id) {
      case "cpu": return a.socket + (a.cooler ? " · Kühler dabei" : " · ohne Kühler") + " · ca. " + a.watt + " W";
      case "board": return a.socket + " · " + a.ff + " · DDR" + a.ddr + (a.wifi ? " · WLAN" : "");
      case "ram": return "DDR" + a.ddr + " · " + a.gb + " GB";
      case "gpu": return (p.sub || "") + " · ca. " + a.watt + " W";
      case "ssd": return String(a.tb).replace(".", ",") + " TB" + (p.sub ? " · " + p.sub : "");
      case "psu": return (a.watt ? a.watt + " W" : "") + (a.sfx ? " · SFX" : "");
      case "case": return "für " + a.fits.join(", ");
      case "cooler": return a.aio ? "AiO-Wasserkühlung" : a.cap > 200 ? "großer Luftkühler" : "Luftkühler";
      case "monitor": return (p.sub || "") + (a.hz ? " · " + a.hz + " Hz" : "");
    }
    return p.sub || "";
  }
  function render() {
    var checks = checkBuild(build), badSlots = {};
    checks.forEach(function (c) { if (c.lvl === "bad" && c.slot) badSlots[c.slot] = 1; });
    $("checks").innerHTML = checks.map(function (c) { return '<div class="chk ' + c.lvl + '"><i>' + (c.lvl === "ok" ? "✓" : c.lvl === "warn" ? "!" : "✕") + "</i><span>" + esc(c.text) + "</span></div>"; }).join("");
    $("slots").innerHTML = SLOTS.map(function (s) {
      var p = build[s.id];
      if (s.id === "cooler" && !p && build.cpu && !needsCooler(build)) return '<div class="slot">' + thumbFor(null, s.cat) + '<div><div class="s-kind">' + s.label + '</div><div class="s-empty">Nicht nötig, Kühler liegt dem Prozessor bei</div></div><div class="s-right"><div class="s-btns"><button type="button" class="btn ghost" data-pick="' + s.id + '">Trotzdem wählen</button></div></div></div>';
      if (!p) return '<div class="slot">' + thumbFor(null, s.cat) + '<div><div class="s-kind">' + s.label + (s.optional ? " · optional" : "") + '</div><div class="s-empty">Noch nichts gewählt</div></div><div class="s-right"><div class="s-btns"><button type="button" class="btn primary" data-pick="' + s.id + '">Wählen</button></div></div></div>';
      var bo = bestOffer(p);
      return '<div class="slot' + (badSlots[s.id] ? " bad" : "") + '">' + thumbFor(p) + '<div style="min-width:0"><div class="s-kind">' + s.label + '</div><div class="s-name">' + esc(p.name) + '</div><div class="s-meta">' + esc(slotMeta(s, p)) + " · bei " + esc(/bestpreis|gunstigster|günstigster/i.test(bo.o.shop || "") ? "günstigstem Händler" : (bo.o.shop || "")) + "</div></div>" +
        '<div class="s-right"><span class="s-price">' + eur(p.price) + '</span><div class="s-btns">' + shopBtn(bo.link, "primary") +
        '<button type="button" class="btn ghost" data-pick="' + s.id + '">Tauschen</button><button type="button" class="btn ghost" data-del="' + s.id + '" aria-label="' + s.label + ' entfernen">✕</button></div></div></div>';
    }).join("");
    var total = sum(build), mon = build.monitor ? build.monitor.price : 0;
    $("total").textContent = eur(total + mon);
    $("total-sub").textContent = mon ? "davon PC " + eur(total) + " · Monitor " + eur(mon) : (total ? "Budget " + eur0(opt.budget) + (total > opt.budget ? " · " + eur0(total - opt.budget) + " darüber" : "") : "");
    saveBuild();
  }
  function saveBuild() {
    var ids = SLOTS.map(function (s) { return build[s.id] ? s.id + ":" + build[s.id].id : ""; }).filter(Boolean).join(",");
    store("hr-cfg-build", ids);
  }
  function loadIds(str) {
    var b = {};
    String(str || "").split(",").forEach(function (pair) {
      var k = pair.split(":")[0], id = pair.slice(k.length + 1);
      var p = all.find(function (x) { return x.id === id; });
      if (p && SLOTS.some(function (s) { return s.id === k && s.cat === p.cat; })) b[k] = p;
    });
    return b;
  }

  /* Teile-Auswahl */
  var pickSlot = null;
  function openPicker(slotId) {
    pickSlot = SLOTS.find(function (s) { return s.id === slotId; });
    $("pk-title").textContent = pickSlot.label + " wählen";
    $("pk-q").value = ""; $("picker").hidden = false; renderPicker(); $("pk-q").focus();
  }
  function renderPicker() {
    var q = n($("pk-q").value).split(/\s+/).filter(Boolean), onlyOk = $("pk-compat").checked;
    var list = (byCat[pickSlot.cat] || []).filter(function (p) { var h = n(p.name + " " + (p.sub || "")); return q.every(function (w) { return h.indexOf(w) > -1; }); })
      .map(function (p) { return { p: p, why: conflicts(pickSlot.id, p, build) }; })
      .filter(function (x) { return !onlyOk || !x.why.length; })
      .sort(function (a, b) { return a.why.length - b.why.length || a.p.price - b.p.price; }).slice(0, 120);
    $("pk-list").innerHTML = list.length ? list.map(function (x) {
      return '<button type="button" class="pk-item' + (x.why.length ? " incompat" : "") + '" data-id="' + esc(x.p.id) + '"><span class="n">' + esc(x.p.name) + '</span><span class="m">' + esc(slotMeta(pickSlot, x.p)) + (x.why.length ? ' · <span class="why">' + esc(x.why.join(", ")) + "</span>" : "") + '</span><span class="p">' + eur(x.p.price) + "</span></button>";
    }).join("") : '<div class="pk-empty">Nichts gefunden' + (onlyOk ? ", das zur Zusammenstellung passt. Nimm den Haken bei „Nur passende Teile“ raus, um alles zu sehen." : ".") + "</div>";
  }
  function closePicker() { $("picker").hidden = true; pickSlot = null; }

  /* Chat */
  function say(html, who) {
    var d = document.createElement("div"); d.className = "msg " + (who || "bot");
    if (who === "me") d.textContent = html; else d.innerHTML = html;
    $("chat").appendChild(d); $("chat").scrollTop = $("chat").scrollHeight; return d;
  }
  function applyOptToForm() {
    $("budget").value = Math.min(4000, Math.max(500, opt.budget)); $("budget-out").textContent = eur0(opt.budget);
    var u = document.querySelector('input[name=use][value="' + opt.use + '"]'); if (u) u.checked = true;
    var g = document.querySelector('input[name=gpu][value="' + opt.gpu + '"]'); if (g) g.checked = true;
    $("wifi").checked = !!opt.wifi; $("monitor").checked = !!opt.monitor;
  }
  function runAssistant(intro) {
    store("hr-cfg-opt", JSON.stringify(opt));
    var res = assemble(opt); lastRes = res;
    if (!res.builds.length) {
      say((intro || "") + "<p>" + esc(res.reason) + "</p>" + (res.cheapest ? '<p><button type="button" class="btn ghost alt" data-budget="' + Math.ceil(res.cheapest.total / 50) * 50 + '">Mit ' + eur0(Math.ceil(res.cheapest.total / 50) * 50) + " planen</button></p>" : ""));
      return;
    }
    var b = res.builds[0].b;
    if (opt.storage) { var big = byCat.SSDs.slice().sort(function (x, y) { return attrs(y).tb - attrs(x).tb || x.price - y.price; })[0]; if (big) b.ssd = big; opt.storage = false; }
    build = Object.assign({}, b); if (!build.cooler) delete build.cooler;
    if (res.monitor) build.monitor = res.monitor; else delete build.monitor;
    render();
    say((intro || "") + explain(res, opt) + (res.up ? '<p><button type="button" class="btn ghost alt" data-budget="' + Math.ceil(res.up.total / 50) * 50 + '">Stärkere Variante übernehmen</button>' + (res.down ? '<button type="button" class="btn ghost alt" data-budget="' + Math.ceil(res.down.total / 50) * 50 + '">Günstigere Variante</button>' : "") + "</p>" : ""));
  }
  var AI = CFG.aiEndpoint ? safeUrl(CFG.aiEndpoint) : null, history = [];
  function catalogBrief() {
    return SLOTS.map(function (s) { return s.cat + ": " + (byCat[s.cat] || []).slice().sort(function (a, b) { return a.price - b.price; }).slice(0, 40).map(function (p) { return p.id + "=" + p.name + " " + Math.round(p.price) + "€"; }).join("; "); }).join("\n");
  }
  async function askAI(text) {
    var wait = say("Denke nach …"); wait.classList.add("typing");
    try {
      var cur = SLOTS.filter(function (s) { return build[s.id]; }).map(function (s) { return s.label + ": " + build[s.id].name + " (" + eur(build[s.id].price) + ")"; }).join("\n");
      history.push({ role: "user", content: text }); history = history.slice(-10);
      var r = await fetch(AI.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, build: cur, options: opt, catalog: catalogBrief() }) });
      if (!r.ok) throw new Error(r.status);
      var j = await r.json();
      wait.remove();
      history.push({ role: "assistant", content: String(j.reply || "") });
      if (j.options && typeof j.options === "object") {
        ["budget", "use", "gpu", "wifi", "monitor"].forEach(function (k) { if (j.options[k] != null) opt[k] = j.options[k]; });
        applyOptToForm(); runAssistant('<p>' + esc(j.reply || "") + "</p>");
      } else say("<p>" + esc(j.reply || "Dazu habe ich gerade keine Antwort.").replace(/\n+/g, "</p><p>") + "</p>");
    } catch (e) {
      wait.remove(); handleLocal(text, "<p><i>Die KI ist gerade nicht erreichbar, ich antworte mit dem eingebauten Assistenten.</i></p>");
    }
  }
  function handleLocal(text, pre) {
    var w = parseWish(text, opt);
    if (w.help) { say((pre || "") + "<p>Ich stelle dir einen PC aus den aktuellen Bestpreisen zusammen. Nenn mir dein <b>Budget</b>, die <b>Auflösung</b> (Full HD, WQHD, 4K) oder ob du <b>streamst und arbeitest</b>, und ob du <b>NVIDIA oder AMD</b> willst. Danach kannst du sagen „stärker“, „günstiger“, „mit Monitor“ oder „mehr Speicher“.</p>"); return; }
    if (w.ask && lastRes && lastRes.builds.length && !w.changed) { say((pre || "") + explain(lastRes, opt)); return; }
    if (w.changed) { opt = w.opt; applyOptToForm(); runAssistant((pre || "") + (w.notes.length ? "<p>" + w.notes.map(esc).join(" ") + "</p>" : "")); return; }
    say((pre || "") + (w.notes.length ? "<p>" + w.notes.map(esc).join(" ") + "</p>" : "<p>Das habe ich nicht ganz verstanden. Schreib mir zum Beispiel „1500 € für WQHD“, „lieber NVIDIA“, „mit Monitor“ oder „günstiger“.</p>"));
  }

  /* Ereignisse */
  $("budget").addEventListener("input", function (e) { opt.budget = +e.target.value; $("budget-out").textContent = eur0(opt.budget); });
  $("quick").addEventListener("submit", function (e) {
    e.preventDefault();
    opt.use = (document.querySelector("input[name=use]:checked") || {}).value || "1440";
    opt.gpu = (document.querySelector("input[name=gpu]:checked") || {}).value || "any";
    opt.wifi = $("wifi").checked; opt.monitor = $("monitor").checked;
    say(eur0(opt.budget) + ", " + USE_TEXT[opt.use] + (opt.gpu !== "any" ? ", " + (opt.gpu === "nvidia" ? "NVIDIA" : "AMD Radeon") : "") + (opt.monitor ? ", mit Monitor" : ""), "me");
    runAssistant();
    // Auf dem Handy direkt zur Antwort springen, sonst bleibt sie unter dem Formular versteckt
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) { var last = $("chat").lastElementChild; if (last) try { last.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (x) {} }
  });
  $("chat-form").addEventListener("submit", function (e) {
    e.preventDefault(); var t = $("chat-text").value.trim(); if (!t) return;
    $("chat-text").value = ""; say(t, "me");
    if (AI) askAI(t); else handleLocal(t);
  });
  $("chat").addEventListener("click", function (e) {
    var b = e.target.closest("[data-budget]"); if (!b) return;
    opt.budget = +b.getAttribute("data-budget"); applyOptToForm(); say("Mit " + eur0(opt.budget) + " planen", "me"); runAssistant();
  });
  $("hints").addEventListener("click", function (e) { var c = e.target.closest("[data-say]"); if (!c) return; $("chat-text").value = c.getAttribute("data-say"); $("chat-form").requestSubmit(); });
  $("slots").addEventListener("click", function (e) {
    var p = e.target.closest("[data-pick]"); if (p) { openPicker(p.getAttribute("data-pick")); return; }
    var d = e.target.closest("[data-del]"); if (d) { delete build[d.getAttribute("data-del")]; render(); }
  });
  $("pk-list").addEventListener("click", function (e) {
    var it = e.target.closest("[data-id]"); if (!it || !pickSlot) return;
    var p = all.find(function (x) { return x.id === it.getAttribute("data-id"); }); if (!p) return;
    build[pickSlot.id] = p; closePicker(); render();
  });
  $("pk-q").addEventListener("input", renderPicker);
  $("pk-compat").addEventListener("change", renderPicker);
  $("pk-close").addEventListener("click", closePicker);
  $("picker").addEventListener("click", function (e) { if (e.target === $("picker")) closePicker(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("picker").hidden) closePicker(); });
  $("clear-build").addEventListener("click", function () { build = {}; render(); });
  function listText() {
    return "Mein PC von Hardware-Radar\n" + SLOTS.filter(function (s) { return build[s.id]; }).map(function (s) { var bo = bestOffer(build[s.id]); return s.label + ": " + build[s.id].name + " – " + eur(build[s.id].price) + " bei " + (/bestpreis|gunstigster|günstigster|geizhals|hardwaredealz/i.test(bo.o.shop || "") ? "günstigstem Händler" : (bo.o.shop || "")) + "\n  " + bo.link.href; }).join("\n") + "\nGesamt: " + $("total").textContent;
  }
  function copy(text, btn, done) {
    function ok() { var t = btn.textContent; btn.textContent = done; setTimeout(function () { btn.textContent = t; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt("Zum Kopieren:", text); });
    else window.prompt("Zum Kopieren:", text);
  }
  $("copy-list").addEventListener("click", function (e) { copy(listText(), e.currentTarget, "Kopiert"); });
  $("share-link").addEventListener("click", function (e) {
    var ids = SLOTS.map(function (s) { return build[s.id] ? s.id + ":" + build[s.id].id : ""; }).filter(Boolean).join(",");
    var url = location.origin + location.pathname + "#pc=" + encodeURIComponent(ids);
    copy(url, e.currentTarget, "Link kopiert");
  });

  /* Start */
  function start(deals, cat) {
    var seen = {};
    ((cat && cat.products) || []).forEach(function (p) { if (p && p.name && typeof p.price === "number") { all.push(p); seen[n(p.name)] = 1; } });
    ((deals && deals.deals) || []).forEach(function (d) { if (d && d.name && typeof d.price === "number" && !seen[n(d.name)]) { all.push(Object.assign({ sub: "" }, d, { id: "d-" + d.id })); seen[n(d.name)] = 1; } });
    SLOTS.forEach(function (s) { byCat[s.cat] = all.filter(function (p) { return p.cat === s.cat && !(s.id === "cooler" && attrs(p).fan); }); });
    var upd = (cat && cat.updated) || (deals && deals.updated);
    if (upd) { var t = new Date(upd); $("stand").textContent = all.length + " Teile · Preise vom " + t.toLocaleDateString("de-DE", { day: "2-digit", month: "long" }) + ", " + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"; }
    $("as-mode").textContent = AI ? "KI-Assistent mit aktuellen Bestpreisen" : "Stellt PCs aus aktuellen Bestpreisen zusammen";
    var h = decodeURIComponent(location.hash.slice(1));
    if (/^pc=/.test(h)) build = loadIds(h.slice(3)); else build = loadIds(store("hr-cfg-build"));
    applyOptToForm(); render();
    $("hints").innerHTML = ["1000 € für Full HD", "1500 € für WQHD, lieber NVIDIA", "2500 € für 4K", "Streaming und Arbeit, 1800 €", "mit Monitor", "günstiger", "stärkere Grafikkarte", "warum diese Teile?"]
      .map(function (s) { return '<button type="button" class="chip" data-say="' + esc(s) + '">' + esc(s) + "</button>"; }).join("");
    // Direktstart per Link, z. B. konfigurator.html#budget=1500&use=1440 (aus den Kaufberatungen)
    var auto = /^budget=(\d{3,5})(?:&use=(1080|1440|2160|work))?(?:&gpu=(any|nvidia|amd))?/.exec(h);
    if (auto) {
      opt.budget = Math.max(500, Math.min(15000, +auto[1])); if (auto[2]) opt.use = auto[2]; if (auto[3]) opt.gpu = auto[3];
      applyOptToForm();
      say(eur0(opt.budget) + ", " + USE_TEXT[opt.use], "me"); runAssistant();
      try { history.replaceState(null, "", location.pathname); } catch (x) {}
      return;
    }
    if (Object.keys(build).length) say("<p>Willkommen zurück! Deine letzte Zusammenstellung ist rechts geladen. Sag mir, was ich ändern soll, oder lass mich neu planen.</p>");
    else say("<p>Hallo! Ich bin der Radar-Assistent. Wähl oben Budget und Einsatz und tippe auf <b>PC zusammenstellen</b>, oder schreib mir einfach, was du brauchst.</p>");
  }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
  if (CFG.affiliate && (CFG.affiliate.amazonTag || CFG.affiliate.awinId)) $("aff-note").hidden = false;
  // Kern-Funktionen für das Erzeugen der fertigen PC-Seiten (tools/build/build.mjs)
  window.HRCfgCore = { assemble: assemble, checkBuild: checkBuild, needWatt: needWatt, attrs: attrs, explain: explain, sum: sum, SLOTS: SLOTS, ready: function () { return !!(byCat.Mainboards && byCat.Mainboards.length); } };
  Promise.all([window.HR_DATA ? Promise.resolve(window.HR_DATA) : getJSON("data/deals.json").catch(function () { return null; }),
               window.HR_CATALOG ? Promise.resolve(window.HR_CATALOG) : getJSON("data/catalog.json").catch(function () { return null; })])
    .then(function (r) { start(r[0], r[1]); })
    .catch(function () { $("stand").textContent = "Preise konnten nicht geladen werden"; });
})();
