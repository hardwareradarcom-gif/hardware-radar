/* Hardware-Radar – PC aufrüsten
   Du gibst deine jetzigen Teile ein, der Assistent erkennt Engpässe und sucht im aktuellen Katalog das Upgrade
   mit dem größten Leistungsgewinn fürs Budget: nur Grafikkarte, nur Prozessor (gleicher Sockel), neue Plattform
   (Prozessor + Mainboard + RAM) oder eine Kombination. Netzteil und Arbeitsspeicher werden mitgeprüft.
   Alle Leistungswerte sind grobe Richtwerte (Grafik: RTX 5090 = 100, Prozessor: Ryzen 7 9800X3D = 100). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var HL = window.HRLinks;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) { return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function eur0(n) { return Math.round(n).toLocaleString("de-DE") + " €"; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- Datenbank: ältere und aktuelle Teile ---------- */
  // [Muster, Name, Leistung, Watt, VRAM]
  var GPUS = [
    [/rtx ?5090/, "GeForce RTX 5090", 100, 575, 32], [/rtx ?5080/, "GeForce RTX 5080", 72, 360, 16], [/rtx ?5070 ?ti/, "GeForce RTX 5070 Ti", 61, 300, 16], [/rtx ?5070/, "GeForce RTX 5070", 50, 250, 12],
    [/rtx ?5060 ?ti.*16|16.*rtx ?5060 ?ti/, "GeForce RTX 5060 Ti 16 GB", 39, 180, 16], [/rtx ?5060 ?ti/, "GeForce RTX 5060 Ti 8 GB", 37, 180, 8], [/rtx ?5060/, "GeForce RTX 5060", 33, 150, 8], [/rtx ?5050/, "GeForce RTX 5050", 26, 130, 8],
    [/rtx ?4090/, "GeForce RTX 4090", 77, 450, 24], [/rtx ?4080 ?s/, "GeForce RTX 4080 Super", 66, 320, 16], [/rtx ?4080/, "GeForce RTX 4080", 64, 320, 16], [/rtx ?4070 ?ti ?s/, "GeForce RTX 4070 Ti Super", 57, 285, 16],
    [/rtx ?4070 ?ti/, "GeForce RTX 4070 Ti", 52, 285, 12], [/rtx ?4070 ?s/, "GeForce RTX 4070 Super", 48, 220, 12], [/rtx ?4070/, "GeForce RTX 4070", 42, 200, 12], [/rtx ?4060 ?ti/, "GeForce RTX 4060 Ti", 32, 165, 8], [/rtx ?4060/, "GeForce RTX 4060", 27, 115, 8],
    [/rtx ?3090 ?ti/, "GeForce RTX 3090 Ti", 50, 450, 24], [/rtx ?3090/, "GeForce RTX 3090", 45, 350, 24], [/rtx ?3080 ?ti/, "GeForce RTX 3080 Ti", 44, 350, 12], [/rtx ?3080/, "GeForce RTX 3080", 40, 320, 10],
    [/rtx ?3070 ?ti/, "GeForce RTX 3070 Ti", 34, 290, 8], [/rtx ?3070/, "GeForce RTX 3070", 32, 220, 8], [/rtx ?3060 ?ti/, "GeForce RTX 3060 Ti", 28, 200, 8], [/rtx ?3060/, "GeForce RTX 3060", 21, 170, 12], [/rtx ?3050/, "GeForce RTX 3050", 15, 130, 8],
    [/rtx ?2080 ?ti/, "GeForce RTX 2080 Ti", 30, 250, 11], [/rtx ?2080 ?s/, "GeForce RTX 2080 Super", 26, 250, 8], [/rtx ?2080/, "GeForce RTX 2080", 25, 215, 8], [/rtx ?2070 ?s/, "GeForce RTX 2070 Super", 23, 215, 8],
    [/rtx ?2070/, "GeForce RTX 2070", 20, 175, 8], [/rtx ?2060 ?s/, "GeForce RTX 2060 Super", 19, 175, 8], [/rtx ?2060/, "GeForce RTX 2060", 16, 160, 6],
    [/(gtx ?)?1660 ?(ti|s)/, "GeForce GTX 1660 Super/Ti", 13, 125, 6], [/(gtx ?)?1660/, "GeForce GTX 1660", 12, 120, 6], [/(gtx ?)?1650 ?s/, "GeForce GTX 1650 Super", 10, 100, 4], [/(gtx ?)?1650/, "GeForce GTX 1650", 8, 75, 4],
    [/(gtx ?)?1080 ?ti/, "GeForce GTX 1080 Ti", 22, 250, 11], [/(gtx ?)?1080/, "GeForce GTX 1080", 17, 180, 8], [/(gtx ?)?1070 ?ti/, "GeForce GTX 1070 Ti", 15, 180, 8], [/(gtx ?)?1070/, "GeForce GTX 1070", 13.5, 150, 8],
    [/(gtx ?)?1060.*3 ?gb/, "GeForce GTX 1060 3 GB", 9, 120, 3], [/(gtx ?)?1060/, "GeForce GTX 1060 6 GB", 10, 120, 6], [/(gtx ?)?1050 ?ti/, "GeForce GTX 1050 Ti", 6, 75, 4], [/gtx ?1050/, "GeForce GTX 1050", 5, 75, 2],
    [/gtx ?980 ?ti/, "GeForce GTX 980 Ti", 13, 250, 6], [/gtx ?980/, "GeForce GTX 980", 10, 165, 4], [/gtx ?970/, "GeForce GTX 970", 8, 145, 4], [/gtx ?960/, "GeForce GTX 960", 5, 120, 2],
    [/(rx ?)?9070 ?xt/, "Radeon RX 9070 XT", 60, 304, 16], [/(rx ?)?9070 ?gre/, "Radeon RX 9070 GRE", 46, 220, 12], [/(rx ?)?9070/, "Radeon RX 9070", 53, 220, 16],
    [/(rx ?)?9060 ?xt.*\b8 ?gb/, "Radeon RX 9060 XT 8 GB", 35, 160, 8], [/(rx ?)?9060 ?xt/, "Radeon RX 9060 XT 16 GB", 38, 160, 16], [/rx ?9060/, "Radeon RX 9060", 32, 140, 8],
    [/(rx ?)?7900 ?xtx/, "Radeon RX 7900 XTX", 66, 355, 24], [/(rx ?)?7900 ?xt/, "Radeon RX 7900 XT", 57, 315, 20], [/(rx ?)?7900 ?gre/, "Radeon RX 7900 GRE", 49, 260, 16], [/(rx ?)?7800 ?xt/, "Radeon RX 7800 XT", 46, 263, 16],
    [/(rx ?)?7700 ?xt/, "Radeon RX 7700 XT", 39, 245, 12], [/(rx ?)?7600 ?xt/, "Radeon RX 7600 XT", 28, 190, 16], [/rx ?7600/, "Radeon RX 7600", 27, 165, 8],
    [/(rx ?)?6950 ?xt/, "Radeon RX 6950 XT", 48, 335, 16], [/(rx ?)?6900 ?xt/, "Radeon RX 6900 XT", 44, 300, 16], [/(rx ?)?6800 ?xt/, "Radeon RX 6800 XT", 42, 300, 16], [/rx ?6800/, "Radeon RX 6800", 36, 250, 16],
    [/(rx ?)?6750 ?xt/, "Radeon RX 6750 XT", 31, 250, 12], [/(rx ?)?6700 ?xt/, "Radeon RX 6700 XT", 29, 230, 12], [/rx ?6700/, "Radeon RX 6700", 26, 175, 10], [/(rx ?)?6650 ?xt/, "Radeon RX 6650 XT", 24, 180, 8],
    [/(rx ?)?6600 ?xt/, "Radeon RX 6600 XT", 23, 160, 8], [/rx ?6600/, "Radeon RX 6600", 20, 132, 8], [/(rx ?)?6500 ?xt/, "Radeon RX 6500 XT", 9, 107, 4],
    [/(rx ?)?5700 ?xt/, "Radeon RX 5700 XT", 20, 225, 8], [/rx ?5700/, "Radeon RX 5700", 18, 180, 8], [/(rx ?)?5600 ?xt/, "Radeon RX 5600 XT", 16, 150, 6], [/(rx ?)?5500 ?xt/, "Radeon RX 5500 XT", 10, 130, 8],
    [/vega ?64/, "Radeon RX Vega 64", 15, 295, 8], [/vega ?56/, "Radeon RX Vega 56", 13, 210, 8], [/rx ?590/, "Radeon RX 590", 11, 225, 8], [/rx ?580/, "Radeon RX 580", 10, 185, 8], [/rx ?570/, "Radeon RX 570", 8.5, 150, 4], [/rx ?480/, "Radeon RX 480", 9.5, 150, 8],
    [/arc ?b580/, "Intel Arc B580", 30, 190, 12], [/arc ?b570/, "Intel Arc B570", 26, 150, 10], [/arc ?a770/, "Intel Arc A770", 22, 225, 16], [/arc ?a750/, "Intel Arc A750", 20, 225, 8], [/arc ?a580/, "Intel Arc A580", 17, 185, 8], [/arc ?a380/, "Intel Arc A380", 6, 75, 6]
  ];
  // [Muster, Name, Gaming, Sockel, RAM-Typ, Watt]
  var A5 = "AM5", A4 = "AM4", I17 = "LGA1700", I18 = "LGA1851", I12 = "LGA1200", I11 = "LGA1151", I15 = "LGA1150";
  var CPUS = [
    [/9950 ?x3d/, "Ryzen 9 9950X3D", 101, A5, "DDR5", 170], [/9900 ?x3d/, "Ryzen 9 9900X3D", 95, A5, "DDR5", 140], [/9850 ?x3d/, "Ryzen 7 9850X3D", 102, A5, "DDR5", 130], [/9800 ?x3d/, "Ryzen 7 9800X3D", 100, A5, "DDR5", 130],
    [/7950 ?x3d/, "Ryzen 9 7950X3D", 92, A5, "DDR5", 140], [/7900 ?x3d/, "Ryzen 9 7900X3D", 85, A5, "DDR5", 130], [/7800 ?x3d/, "Ryzen 7 7800X3D", 88, A5, "DDR5", 120], [/7600 ?x3d/, "Ryzen 5 7600X3D", 82, A5, "DDR5", 110], [/7500 ?x3d/, "Ryzen 5 7500X3D", 80, A5, "DDR5", 110],
    [/9950 ?x\b/, "Ryzen 9 9950X", 82, A5, "DDR5", 200], [/9900 ?x\b/, "Ryzen 9 9900X", 80, A5, "DDR5", 160], [/9700 ?x\b/, "Ryzen 7 9700X", 78, A5, "DDR5", 110], [/9600 ?x\b/, "Ryzen 5 9600X", 75, A5, "DDR5", 100], [/ryzen 5 9600\b|\b9600\b/, "Ryzen 5 9600", 74, A5, "DDR5", 90],
    [/7950 ?x\b/, "Ryzen 9 7950X", 78, A5, "DDR5", 200], [/7900 ?x\b/, "Ryzen 9 7900X", 76, A5, "DDR5", 170], [/7700 ?x\b/, "Ryzen 7 7700X", 74, A5, "DDR5", 130], [/ryzen 7 7700\b|\b7700\b(?! ?k)/, "Ryzen 7 7700", 72, A5, "DDR5", 90],
    [/7600 ?x\b/, "Ryzen 5 7600X", 71, A5, "DDR5", 120], [/ryzen 5 7600\b|\b7600\b(?! ?k)/, "Ryzen 5 7600", 70, A5, "DDR5", 90], [/7500 ?f/, "Ryzen 5 7500F", 68, A5, "DDR5", 90], [/8700 ?g/, "Ryzen 7 8700G", 62, A5, "DDR5", 90], [/8600 ?g/, "Ryzen 5 8600G", 58, A5, "DDR5", 90], [/8500 ?g/, "Ryzen 5 8500G", 50, A5, "DDR5", 70],
    [/5800 ?x3d/, "Ryzen 7 5800X3D", 72, A4, "DDR4", 110], [/5700 ?x3d/, "Ryzen 7 5700X3D", 68, A4, "DDR4", 110], [/5600 ?x3d/, "Ryzen 5 5600X3D", 66, A4, "DDR4", 100],
    [/5950 ?x/, "Ryzen 9 5950X", 60, A4, "DDR4", 140], [/5900 ?x/, "Ryzen 9 5900X", 59, A4, "DDR4", 140], [/5800 ?x\b|5800\b/, "Ryzen 7 5800X", 58, A4, "DDR4", 120], [/5700 ?x\b/, "Ryzen 7 5700X", 57, A4, "DDR4", 80], [/5700 ?g/, "Ryzen 7 5700G", 50, A4, "DDR4", 80], [/ryzen 7 5700\b/, "Ryzen 7 5700", 54, A4, "DDR4", 80],
    [/5600 ?x\b/, "Ryzen 5 5600X", 55, A4, "DDR4", 80], [/5600 ?g/, "Ryzen 5 5600G", 47, A4, "DDR4", 70], [/5600 ?t|ryzen 5 5600\b|\b5600\b/, "Ryzen 5 5600", 53, A4, "DDR4", 80], [/5500/, "Ryzen 5 5500", 48, A4, "DDR4", 70],
    [/3950 ?x/, "Ryzen 9 3950X", 47, A4, "DDR4", 140], [/3900 ?x/, "Ryzen 9 3900X", 45, A4, "DDR4", 140], [/3800 ?x/, "Ryzen 7 3800X", 45, A4, "DDR4", 110], [/3700 ?x/, "Ryzen 7 3700X", 44, A4, "DDR4", 90], [/3600 ?x/, "Ryzen 5 3600X", 43, A4, "DDR4", 95], [/3600/, "Ryzen 5 3600", 42, A4, "DDR4", 80],
    [/3500 ?x?/, "Ryzen 5 3500", 39, A4, "DDR4", 70], [/3400 ?g/, "Ryzen 5 3400G", 30, A4, "DDR4", 70], [/3300 ?x/, "Ryzen 3 3300X", 38, A4, "DDR4", 70], [/3100/, "Ryzen 3 3100", 33, A4, "DDR4", 65],
    [/2700 ?x/, "Ryzen 7 2700X", 36, A4, "DDR4", 105], [/2700/, "Ryzen 7 2700", 34, A4, "DDR4", 70], [/2600 ?x?/, "Ryzen 5 2600(X)", 33, A4, "DDR4", 80], [/2400 ?g/, "Ryzen 5 2400G", 26, A4, "DDR4", 65],
    [/1800 ?x/, "Ryzen 7 1800X", 31, A4, "DDR4", 95], [/1700 ?x?(?!\d)/, "Ryzen 7 1700(X)", 30, A4, "DDR4", 80], [/1600 ?x?(?!\d)/, "Ryzen 5 1600(X)", 28, A4, "DDR4", 80], [/1500 ?x/, "Ryzen 5 1500X", 25, A4, "DDR4", 65], [/1400/, "Ryzen 5 1400", 23, A4, "DDR4", 65],
    [/285 ?k/, "Core Ultra 9 285K", 82, I18, "DDR5", 250], [/265 ?k/, "Core Ultra 7 265K", 79, I18, "DDR5", 220], [/245 ?k/, "Core Ultra 5 245K", 72, I18, "DDR5", 160], [/ultra 5 225|\b225f?\b/, "Core Ultra 5 225", 65, I18, "DDR5", 120],
    [/14900/, "Core i9-14900K", 84, I17, "DDR4/DDR5", 250], [/14700/, "Core i7-14700K", 80, I17, "DDR4/DDR5", 250], [/14600/, "Core i5-14600K", 74, I17, "DDR4/DDR5", 180], [/14400/, "Core i5-14400", 60, I17, "DDR4/DDR5", 120], [/14100/, "Core i3-14100", 50, I17, "DDR4/DDR5", 90],
    [/13900/, "Core i9-13900K", 82, I17, "DDR4/DDR5", 250], [/13700/, "Core i7-13700K", 77, I17, "DDR4/DDR5", 220], [/13600/, "Core i5-13600K", 72, I17, "DDR4/DDR5", 180], [/13500/, "Core i5-13500", 64, I17, "DDR4/DDR5", 130], [/13400/, "Core i5-13400", 58, I17, "DDR4/DDR5", 110], [/13100/, "Core i3-13100", 48, I17, "DDR4/DDR5", 90],
    [/12900/, "Core i9-12900K", 70, I17, "DDR4/DDR5", 220], [/12700/, "Core i7-12700K", 66, I17, "DDR4/DDR5", 190], [/12600/, "Core i5-12600K", 62, I17, "DDR4/DDR5", 150], [/12400/, "Core i5-12400", 55, I17, "DDR4/DDR5", 100], [/12100/, "Core i3-12100", 47, I17, "DDR4/DDR5", 80],
    [/11900/, "Core i9-11900K", 53, I12, "DDR4", 200], [/11700/, "Core i7-11700K", 51, I12, "DDR4", 190], [/11600/, "Core i5-11600K", 49, I12, "DDR4", 150], [/11400/, "Core i5-11400", 46, I12, "DDR4", 110],
    [/10900/, "Core i9-10900K", 49, I12, "DDR4", 200], [/10850/, "Core i9-10850K", 48, I12, "DDR4", 200], [/10700/, "Core i7-10700(K)", 47, I12, "DDR4", 160], [/10600/, "Core i5-10600K", 43, I12, "DDR4", 125], [/10400/, "Core i5-10400", 40, I12, "DDR4", 90], [/10100/, "Core i3-10100", 34, I12, "DDR4", 70],
    [/9900/, "Core i9-9900K", 45, I11, "DDR4", 170], [/9700/, "Core i7-9700K", 42, I11, "DDR4", 150], [/9600/, "Core i5-9600K", 37, I11, "DDR4", 120], [/9400/, "Core i5-9400(F)", 34, I11, "DDR4", 80], [/9100/, "Core i3-9100", 28, I11, "DDR4", 70],
    [/8700/, "Core i7-8700(K)", 39, I11, "DDR4", 130], [/8600/, "Core i5-8600K", 34, I11, "DDR4", 110], [/8400/, "Core i5-8400", 32, I11, "DDR4", 80], [/8100/, "Core i3-8100", 26, I11, "DDR4", 70],
    [/7700/, "Core i7-7700(K)", 31, I11, "DDR4", 110], [/7600/, "Core i5-7600K", 28, I11, "DDR4", 95], [/6700/, "Core i7-6700K", 29, I11, "DDR4", 100], [/6600/, "Core i5-6600K", 25, I11, "DDR4", 95], [/6500/, "Core i5-6500", 23, I11, "DDR4", 70],
    [/4790/, "Core i7-4790K", 25, I15, "DDR3", 100], [/4770/, "Core i7-4770K", 23, I15, "DDR3", 100], [/4690/, "Core i5-4690K", 21, I15, "DDR3", 90], [/4590|4460|4570/, "Core i5-4590", 19, I15, "DDR3", 85]
  ];
  function norm(s) {
    return String(s || "").toLowerCase().replace(/nvidia|geforce|amd|radeon|intel|core|prozessor|grafikkarte/g, " ")
      .replace(/\b(rtx|gtx|rx|arc)(\d)/g, "$1 $2").replace(/(\d)(ti|xtx|xt|super|gre)\b/g, "$1 $2").replace(/\s+/g, " ").trim();
  }
  function findGpu(s) {
    var n = norm(s); if (!n) return null;
    var tries = [n]; if (!/rtx|gtx|rx|arc|vega/.test(n)) tries.push("rtx " + n);
    for (var t = 0; t < tries.length; t++) for (var i = 0; i < GPUS.length; i++) if (GPUS[i][0].test(tries[t])) return { name: GPUS[i][1], perf: GPUS[i][2], watt: GPUS[i][3], vram: GPUS[i][4] };
    return null;
  }
  function findCpu(s) {
    var raw = String(s || "").toLowerCase(), n = norm(s); if (!n) return null;
    var intel = /\bi[3579]\b|\bi[3579]-|core|ultra|intel|pentium/.test(raw) || (/\d{4,5} ?k[fs]?\b/.test(n) && !/ryzen/.test(raw)) || /\b1[0-4]\d{3}/.test(n) || /\b2[2-8]5 ?k?f?\b/.test(n);
    var amd = /ryzen|x3d|\bamd\b/.test(raw);
    n = n.replace(/\bi[3579][ -]?/g, "").replace(/\bultra [579] /, "");
    var groups = intel && !amd ? ["intel"] : amd && !intel ? ["amd"] : ["amd", "intel"];
    for (var g = 0; g < groups.length; g++) for (var i = 0; i < CPUS.length; i++) {
      var c = CPUS[i], isAmd = c[1].indexOf("Ryzen") === 0;
      if ((groups[g] === "amd") !== isAmd) continue;
      if (c[0].test(n)) return { name: c[1], score: c[2], socket: c[3], ddr: c[4], watt: c[5] };
    }
    return null;
  }

  /* ---------- Katalog lesen ---------- */
  var cat = { gpu: [], cpu: [], board: [], ram: [], psu: [] };
  function boardSocket(p) {
    var k = (p.sub + " " + p.name).toLowerCase();
    if (/\b(am5|b650e?|b850|x670e?|x870e?|a620)\b/.test(k)) return A5;
    if (/\b(am4|b550|x570|b450|a520|x470)\b/.test(k)) return A4;
    if (/\b(lga ?1851|z890|b860|h810)\b/.test(k)) return I18;
    if (/\b(lga ?1700|z790|b760|h770|h610|z690|b660|h670)\b/.test(k)) return I17;
    return null;
  }
  function cpuSocket(p) { var k = (p.sub || "").toLowerCase(); return /am5/.test(k) ? A5 : /am4/.test(k) ? A4 : /1851/.test(k) ? I18 : /1700/.test(k) ? I17 : null; }
  function loadCatalog(c) {
    (c && c.products || []).forEach(function (p) {
      if (!p || typeof p.price !== "number" || !p.id) return;
      var k = (p.sub + " " + p.name).toLowerCase();
      if (p.cat === "Grafikkarten") { if (/ai pro|arc pro|workstation|quadro/.test(k)) return; var g = findGpu(p.sub + " " + p.name); if (g) cat.gpu.push({ p: p, perf: g.perf, watt: g.watt, vram: g.vram, chip: g.name }); }
      else if (p.cat === "Prozessoren") { var cc = findCpu(p.name); var so = cpuSocket(p) || (cc && cc.socket); if (cc && so) cat.cpu.push({ p: p, score: cc.score, socket: so, watt: cc.watt, model: cc.name, cooler: /boxed/.test(k) && !/x3d|\bk\b|kf\b|ultra/.test(k) }); }
      else if (p.cat === "Mainboards") { var bs = boardSocket(p); if (bs) cat.board.push({ p: p, socket: bs, ddr: bs === I17 ? (/ddr4/.test(k) ? "DDR4" : "DDR5") : bs === A4 ? "DDR4" : "DDR5" }); }
      else if (p.cat === "Arbeitsspeicher") { var t = /ddr5/.test(k) ? "DDR5" : /ddr4/.test(k) ? "DDR4" : null, gb = (k.match(/(\d{2,3}) ?gb/) || [])[1]; if (t && gb && !/so-?dimm|ecc/.test(k)) cat.ram.push({ p: p, ddr: t, gb: +gb }); }
      else if (p.cat === "Netzteile") { var w = (k.match(/(\d{3,4}) ?w\b/) || [])[1]; if (w) cat.psu.push({ p: p, watt: +w, sfx: /sfx/.test(k) }); }
    });
    ["gpu", "cpu", "board", "ram", "psu"].forEach(function (k) { cat[k].sort(function (a, b) { return a.p.price - b.p.price; }); });
  }

  /* ---------- Bewertung ---------- */
  var NEED = { "1080": { gpu: 38, cpu: 95 }, "1440": { gpu: 58, cpu: 82 }, "2160": { gpu: 85, cpu: 66 } };
  function eff(cpuScore, gpuPerf, use) { var n = NEED[use] || NEED["1440"], a = gpuPerf / n.gpu, b = cpuScore / n.cpu; return Math.pow(Math.pow(a, -3) + Math.pow(b, -3), -1 / 3); }
  function needWatt(cpuW, gpuW) { return Math.ceil((cpuW + gpuW + 90) * 1.25 / 50) * 50; }
  function cheapestPsu(w) { return cat.psu.find(function (x) { return x.watt >= w && !x.sfx; }) || cat.psu.find(function (x) { return x.watt >= w; }) || null; }
  function ram32(ddr) { return cat.ram.find(function (r) { return r.ddr === ddr && r.gb >= 32; }) || null; }

  function plan(cur) {
    var base = eff(cur.cpu.score, cur.gpu.perf, cur.use), out = [];
    var ramWeak = cur.ram < 16 ? 0.12 : cur.ram < 32 ? 0.03 : 0;  // Malus für zu wenig RAM
    function add(o) {
      var parts = o.parts.filter(Boolean), cost = parts.reduce(function (s, x) { return s + x.item.p.price; }, 0);
      var cpu = o.cpu || cur.cpu, gpu = o.gpu || cur.gpu;
      var need = needWatt(cpu.watt, gpu.watt), psu = null;
      if (cur.psu && cur.psu < need) { var ps = cheapestPsu(need); if (!ps) return; psu = ps; parts.push({ role: "Netzteil", item: ps, why: "Dein " + cur.psu + "-W-Netzteil reicht für die neuen Teile nicht, empfohlen sind " + need + " W." }); cost += ps.p.price; }
      var ramFix = o.ramNew ? 0 : ramWeak;
      var gain = eff(cpu.score, gpu.perf, cur.use) * (1 - ramFix) / (base * (1 - ramWeak)) - 1;
      out.push({ label: o.label, parts: parts, cost: cost, gain: gain, need: need, cpu: cpu, gpu: gpu, ramNew: o.ramNew, notes: o.notes || [] });
    }
    // 1) nur Grafikkarte
    cat.gpu.forEach(function (g) { if (g.perf > cur.gpu.perf * 1.15) add({ label: "Neue Grafikkarte", gpu: { perf: g.perf, watt: g.watt, name: g.chip }, parts: [{ role: "Grafikkarte", item: g, why: g.chip + " statt " + cur.gpu.name }] }); });
    // 2) Prozessor im gleichen Sockel
    var same = cat.cpu.filter(function (c) { return c.socket === cur.cpu.socket && c.score > cur.cpu.score + 4; });
    same.forEach(function (c) { add({ label: "Neuer Prozessor (passt auf dein Mainboard)", cpu: { score: c.score, watt: c.watt, name: c.model }, parts: [{ role: "Prozessor", item: c, why: c.model + " passt in deinen Sockel " + cur.cpu.socket }], notes: cur.cpu.socket === A4 ? ["Bei älteren AM4-Mainboards (300er- und 400er-Chipsatz) vorher ein BIOS-Update machen, sonst startet der neue Prozessor nicht."] : cur.cpu.socket === I17 ? ["Bei Mainboards mit 600er-Chipsatz (z. B. B660, Z690) für Prozessoren der 13. und 14. Generation vorher ein BIOS-Update machen."] : [] }); });
    // 3) neue Plattform: Prozessor + Mainboard + RAM
    var plats = [];
    [A5, I18, I17].forEach(function (so) {
      if (so === cur.cpu.socket) return;
      cat.cpu.filter(function (c) { return c.socket === so && c.score > cur.cpu.score + 8; }).forEach(function (c) {
        var boards = cat.board.filter(function (b) { return b.socket === so && (so !== I17 || b.ddr === "DDR5"); }); if (!boards.length) return;
        var reuseRam = cur.ramType === "DDR5" && cur.ram >= 32, r = reuseRam ? null : ram32("DDR5"); if (!reuseRam && !r) return;
        plats.push({ c: c, b: boards[0], r: r, cost: c.p.price + boards[0].p.price + (r ? r.p.price : 0) });
      });
    });
    plats.sort(function (a, b) { return a.cost - b.cost; });
    plats.forEach(function (pl) {
      var notes = ["Neue Plattform heißt: Prozessor, Mainboard und Arbeitsspeicher wechseln. Grafikkarte, SSD, Netzteil und Gehäuse kannst du meist weiter nutzen."];
      if (!pl.c.cooler) notes.push(cur.cpu.socket === A4 && pl.c.socket === A5 ? "Viele AM4-Kühler passen auch auf AM5. Prüfe das beim Hersteller deines Kühlers." : pl.c.socket === I18 && cur.cpu.socket === I17 ? "LGA1700-Kühler passen in der Regel auch auf LGA1851." : "Dieser Prozessor kommt ohne Kühler. Prüfe, ob dein Kühler einen Montagesatz für " + pl.c.socket + " hat, sonst brauchst du einen neuen.");
      var base3 = { label: "Neue Plattform (" + pl.c.socket + ")", cpu: { score: pl.c.score, watt: pl.c.watt, name: pl.c.model }, ramNew: !!pl.r, notes: notes,
        parts: [{ role: "Prozessor", item: pl.c, why: pl.c.model }, { role: "Mainboard", item: pl.b, why: "günstigstes passendes " + pl.c.socket + "-Mainboard" }, pl.r ? { role: "Arbeitsspeicher", item: pl.r, why: "32 GB DDR5 für die neue Plattform" } : null] };
      add(base3);
      // 4) Plattform + Grafikkarte
      cat.gpu.forEach(function (g) { if (g.perf > cur.gpu.perf * 1.15) add({ label: "Neue Plattform + Grafikkarte", cpu: base3.cpu, gpu: { perf: g.perf, watt: g.watt, name: g.chip }, ramNew: base3.ramNew, notes: notes, parts: base3.parts.concat([{ role: "Grafikkarte", item: g, why: g.chip + " statt " + cur.gpu.name }]) }); });
    });
    // 5) Prozessor (gleicher Sockel) + Grafikkarte
    same.slice(0, 8).forEach(function (c) { cat.gpu.forEach(function (g) { if (g.perf > cur.gpu.perf * 1.15) add({ label: "Neuer Prozessor + Grafikkarte", cpu: { score: c.score, watt: c.watt, name: c.model }, gpu: { perf: g.perf, watt: g.watt, name: g.chip }, parts: [{ role: "Prozessor", item: c, why: c.model + " passt in deinen Sockel" }, { role: "Grafikkarte", item: g, why: g.chip + " statt " + cur.gpu.name }] }); }); });
    // RAM-Upgrade als Zusatz, wenn Budget übrig
    out.forEach(function (o) {
      if (o.ramNew || cur.ram >= 32 || (cur.ramType === "DDR3" && o.cpu === cur.cpu)) return;
      var r = ram32(cur.ramType === "DDR5" || o.cpu.socket === A5 ? "DDR5" : "DDR4"); if (!r) return;
      o.ramAdd = { role: "Arbeitsspeicher", item: r, why: cur.ram + " GB sind " + (cur.ram < 16 ? "zu wenig" : "knapp") + " für aktuelle Spiele, 32 GB sind die Empfehlung" };
    });
    return { base: base, all: out };
  }
  function choose(res, budget) {
    var fit = res.all.filter(function (o) { return o.cost <= budget && o.gain >= 0.1; });
    fit.sort(function (a, b) { return b.gain - a.gain || a.cost - b.cost; });
    var best = fit[0] || null;
    // fast genauso viel Leistung für deutlich weniger Geld? Dann lieber das günstigere Upgrade
    if (best) { var floor = Math.max(best.gain * 0.85, best.gain - 0.08), cheap = fit.filter(function (o) { return o.gain >= floor; }).sort(function (a, b) { return a.cost - b.cost; })[0]; if (cheap) best = cheap; }
    if (best) { best = Object.assign({}, best, { parts: best.parts.slice() }); if (best.ramAdd && best.cost + best.ramAdd.item.p.price <= budget) { best.parts.push(best.ramAdd); best.cost += best.ramAdd.item.p.price; best.gain += 0.02; } }
    // Preis-Leistungs-Tipp: größter Gewinn pro Euro mit mindestens 15 % Gewinn
    var value = fit.filter(function (o) { return o.gain >= 0.15 && (!best || o.label !== best.label || o.cost < best.cost * 0.75); }).sort(function (a, b) { return b.gain / b.cost - a.gain / a.cost; })[0] || null;
    if (value && best && value.cost >= best.cost) value = null;
    var more = res.all.filter(function (o) { return o.cost > budget && o.cost <= budget * 1.6 && (!best || o.gain > best.gain + 0.2); }).sort(function (a, b) { return (a.cost - budget) / Math.max(0.01, a.gain) - (b.cost - budget) / Math.max(0.01, b.gain); })[0] || null;
    return { best: best, value: value, more: more };
  }

  /* ---------- Anzeige ---------- */
  function bar(v, max, cls) { return '<span class="ug-bar"><i class="' + (cls || "") + '" style="width:' + Math.max(3, Math.min(100, v / max * 100)).toFixed(0) + '%"></i></span>'; }
  function partRow(x) {
    var l = HL.productLink(x.item.p);
    return '<li><span class="ug-role">' + esc(x.role) + '</span><a class="ug-name" href="p/' + encodeURIComponent(x.item.p.id) + '.html">' + esc(x.item.p.name) + '</a><span class="ug-why">' + esc(x.why) + '</span><span class="ug-price">' + eur(x.item.p.price) + '</span><a class="btn primary" href="' + esc(l.href) + '" target="_blank" rel="' + HL.relOf(l) + '">' + esc(l.label) + (l.aff ? '<span class="aff">*</span>' : "") + "</a></li>";
  }
  function optionCard(o, title, cls) {
    return '<section class="ug-opt ' + (cls || "") + '"><div class="ug-opt-h"><div><span class="p-sub">' + esc(title) + '</span><h3>' + esc(o.label) + '</h3></div><div class="ug-gain"><b>+' + Math.round(o.gain * 100) + ' %</b><span>Leistung in Spielen (grob)</span></div></div>' +
      '<ul class="ug-parts">' + o.parts.map(partRow).join("") + '</ul><div class="ug-sum"><span>Summe</span><b>' + eur(o.cost) + "</b></div>" +
      (o.notes.length ? '<ul class="ug-notes">' + o.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") + "</section>";
  }
  function tipsFor(cur, ch) {
    var t = [], n = NEED[cur.use], a = cur.gpu.perf / n.gpu, b = cur.cpu.score / n.cpu;
    if (cur.ram < 16) t.push("<b>Arbeitsspeicher:</b> " + cur.ram + " GB sind für aktuelle Spiele zu wenig. Das führt zu Rucklern und langen Ladezeiten. 32 GB sind die Empfehlung, mindestens 16 GB.");
    else if (cur.ram < 32) t.push("<b>Arbeitsspeicher:</b> 16 GB reichen für die meisten Spiele noch. Mit Discord, Browser und Streaming im Hintergrund lohnen sich 32 GB.");
    if (cur.gpu.vram && cur.gpu.vram <= 6) t.push("<b>Grafikspeicher:</b> Deine Karte hat nur " + cur.gpu.vram + " GB. Viele neue Spiele brauchen 8 GB oder mehr, auch in Full HD.");
    else if (cur.gpu.vram === 8 && cur.use !== "1080") t.push("<b>Grafikspeicher:</b> 8 GB werden in " + (cur.use === "2160" ? "4K" : "WQHD") + " mit hohen Texturen knapp. Achte bei einer neuen Karte auf 12 bis 16 GB.");
    if (/DDR3/.test(cur.cpu.ddr)) t.push("<b>Plattform:</b> Dein System nutzt noch DDR3. Ein Aufrüsten einzelner Teile lohnt sich hier kaum, ein neuer Unterbau aus Prozessor, Mainboard und RAM bringt am meisten.");
    if ((cur.cpu.socket === I11 || cur.cpu.socket === I12) && b < a) t.push("<b>Sockel " + cur.cpu.socket + ":</b> Für deinen Sockel gibt es keine neuen Prozessoren mehr. Ein Prozessor-Upgrade heißt hier immer: neue Plattform.");
    if (cur.cpu.socket === A4) t.push("<b>AM4-Tipp:</b> Ein Ryzen 7 5700X3D oder 5800X3D ist das stärkste Gaming-Upgrade für dein Mainboard und deinen DDR4-Speicher, ganz ohne Plattformwechsel. Vorher BIOS aktualisieren.");
    if (!cur.psu) t.push("<b>Netzteil:</b> Du hast keine Netzteil-Leistung angegeben. Prüfe vor dem Kauf einer stärkeren Grafikkarte das Typenschild deines Netzteils.");
    if (ch.best && ch.best.parts.some(function (x) { return x.role === "Grafikkarte"; })) t.push("<b>Alte Grafikkarte verkaufen:</b> Gebraucht bringt deine " + esc(cur.gpu.name) + " oft noch einen Teil des Preises zurück, zum Beispiel über Kleinanzeigen.");
    t.push("<b>Bevor du kaufst:</b> Treiber und BIOS aktualisieren, Hintergrundprogramme schließen und die Temperaturen prüfen. Manchmal liegt ein Ruckeln gar nicht an der Hardware.");
    return t;
  }
  function render(cur, budget) {
    var res = plan(cur), ch = choose(res, budget), n = NEED[cur.use], a = cur.gpu.perf / n.gpu, b = cur.cpu.score / n.cpu;
    var verdict = a < 0.45 && b < 0.45 ? "Prozessor <b>und</b> Grafikkarte sind für aktuelle Spiele in dieser Auflösung schwach. Am meisten bringt ein neuer Unterbau mit neuer Grafikkarte, mit kleinem Budget zuerst die Grafikkarte." :
      b < a * 0.78 ? "Dein <b>Prozessor bremst</b> die Grafikkarte. Ein schnellerer Prozessor bringt hier mehr als eine neue Karte." :
      a < b * 0.78 ? "Deine <b>Grafikkarte ist der Engpass</b>. Eine stärkere Karte bringt den größten Sprung." :
      "Prozessor und Grafikkarte sind <b>gut ausbalanciert</b>. Für spürbar mehr Leistung brauchst du meist beides oder eine deutlich stärkere Karte.";
    var useTxt = { "1080": "Full HD", "1440": "WQHD", "2160": "4K" }[cur.use];
    var html = '<section class="ug-ana"><h3>Dein PC heute</h3><dl>' +
      "<div><dt>Prozessor</dt><dd><span><b>" + esc(cur.cpu.name) + "</b> · Sockel " + esc(cur.cpu.socket) + "</span>" + bar(cur.cpu.score, 100) + "<small>Gaming-Leistung " + cur.cpu.score + " von 100</small></dd></div>" +
      "<div><dt>Grafikkarte</dt><dd><span><b>" + esc(cur.gpu.name) + "</b>" + (cur.gpu.vram ? " · " + cur.gpu.vram + " GB" : "") + "</span>" + bar(cur.gpu.perf, 100) + "<small>Leistung " + String(cur.gpu.perf).replace(".", ",") + " von 100 (RTX 5090 = 100)</small></dd></div>" +
      "<div><dt>Arbeitsspeicher</dt><dd><b>" + cur.ram + " GB " + esc(cur.ramType) + "</b></dd></div>" +
      "<div><dt>Netzteil</dt><dd><b>" + (cur.psu ? cur.psu + " W" : "unbekannt") + "</b></dd></div></dl>" +
      '<p class="ug-verdict">' + verdict + " Bewertet für " + useTxt + ".</p></section>";
    if (ch.best) html += optionCard(ch.best, "Beste Wahl für " + eur0(budget), "best");
    else html += '<section class="ug-opt"><h3>Für ' + eur0(budget) + " finde ich gerade kein lohnendes Upgrade</h3><p>Mit dem Budget gibt es im Katalog keine Kombination, die mindestens 5 % mehr Leistung bringt." + (ch.more ? " Mit etwas mehr Budget geht es, siehe unten." : "") + "</p></section>";
    if (ch.value) html += optionCard(ch.value, "Preis-Leistungs-Tipp", "alt");
    if (ch.more) html += optionCard(ch.more, "Mit " + eur0(Math.ceil(ch.more.cost / 50) * 50) + " Budget", "alt");
    html += '<section class="ug-tips"><h3>Tipps für deinen PC</h3><ul>' + tipsFor(cur, ch).map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul></section>" +
      '<p class="b-note">Leistungsgewinne sind grobe Schätzungen aus öffentlichen Tests und hängen stark vom Spiel ab. Prüfe vor dem Kauf die Maße (Grafikkartenlänge, Kühlerhöhe) und die Anschlüsse deines Netzteils.</p>';
    $("ug-result").innerHTML = html;
  }

  /* ---------- Bedienung ---------- */
  function datalists() {
    $("ug-cpu-list").innerHTML = CPUS.map(function (c) { return '<option value="' + esc(c[1]) + '">'; }).join("");
    $("ug-gpu-list").innerHTML = GPUS.map(function (g) { return '<option value="' + esc(g[1]) + '">'; }).join("");
  }
  function readForm() {
    var cpu = findCpu($("ug-cpu").value), gpu = findGpu($("ug-gpu").value);
    var ramType = $("ug-ramtype").value === "auto" ? (cpu ? (cpu.ddr === "DDR4/DDR5" ? "DDR4" : cpu.ddr) : "DDR4") : $("ug-ramtype").value;
    return { cpu: cpu, gpu: gpu, ram: +$("ug-ram").value, ramType: ramType, psu: +$("ug-psu").value || 0, use: (document.querySelector("input[name=ug-use]:checked") || {}).value || "1440", budget: +$("ug-budget").value };
  }
  function hint() {
    var c = findCpu($("ug-cpu").value), g = findGpu($("ug-gpu").value);
    $("ug-cpu-ok").textContent = $("ug-cpu").value.trim() ? (c ? "✓ " + c.name + " · Sockel " + c.socket : "Nicht erkannt. Tippe z. B. „Ryzen 5 3600“ oder „i5-9400F“.") : "";
    $("ug-gpu-ok").textContent = $("ug-gpu").value.trim() ? (g ? "✓ " + g.name + (g.vram ? " · " + g.vram + " GB" : "") : "Nicht erkannt. Tippe z. B. „GTX 1070“ oder „RX 6600“.") : "";
    $("ug-cpu-ok").className = "ug-ok" + (c ? "" : " bad"); $("ug-gpu-ok").className = "ug-ok" + (g ? "" : " bad");
    var rt = $("ug-ramtype"); if (rt.value === "auto" && c) $("ug-ramtype-auto").textContent = "automatisch (" + (c.ddr === "DDR4/DDR5" ? "DDR4 oder DDR5" : c.ddr) + ")";
  }
  function go(e) {
    if (e) e.preventDefault();
    var f = readForm();
    if (!f.cpu || !f.gpu) { hint(); (f.cpu ? $("ug-gpu") : $("ug-cpu")).focus(); return; }
    store("hr-ug", JSON.stringify({ cpu: $("ug-cpu").value, gpu: $("ug-gpu").value, ram: f.ram, ramType: $("ug-ramtype").value, psu: f.psu, use: f.use, budget: f.budget }));
    render(f, f.budget);
    if (window.matchMedia && matchMedia("(max-width: 960px)").matches) try { $("ug-result").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (x) {}
  }
  function setMode(m) {
    var up = m === "upgrade";
    $("mode-new").setAttribute("aria-selected", String(!up)); $("mode-up").setAttribute("aria-selected", String(up));
    document.querySelector(".cfg-grid").hidden = up; $("upgrade").hidden = !up;
    $("cfg-lede-new").hidden = up; $("cfg-lede-up").hidden = !up;
    try { history.replaceState(null, "", up ? "#aufruesten" : location.pathname); } catch (x) {}
  }
  function init(catalog) {
    loadCatalog(catalog); datalists();
    try { var s = JSON.parse(store("hr-ug") || "null"); if (s) { $("ug-cpu").value = s.cpu || ""; $("ug-gpu").value = s.gpu || ""; $("ug-ram").value = s.ram || 16; $("ug-ramtype").value = s.ramType || "auto"; $("ug-psu").value = s.psu || 0; var u = document.querySelector('input[name=ug-use][value="' + s.use + '"]'); if (u) u.checked = true; if (s.budget) $("ug-budget").value = s.budget; } } catch (x) {}
    $("ug-budget-out").textContent = eur0(+$("ug-budget").value);
    $("ug-budget").addEventListener("input", function () { $("ug-budget-out").textContent = eur0(+this.value); });
    ["ug-cpu", "ug-gpu"].forEach(function (id) { $(id).addEventListener("input", hint); });
    $("ug-ramtype").addEventListener("change", hint);
    $("ug-form").addEventListener("submit", go);
    $("ug-examples").addEventListener("click", function (e) { var b = e.target.closest("[data-ex]"); if (!b) return; var x = b.getAttribute("data-ex").split("|"); $("ug-cpu").value = x[0]; $("ug-gpu").value = x[1]; $("ug-ram").value = x[2]; $("ug-psu").value = x[3]; hint(); go(); });
    hint();
    if ($("ug-cpu").value && $("ug-gpu").value && !$("upgrade").hidden) go();
  }
  $("mode-new").addEventListener("click", function () { setMode("new"); });
  $("mode-up").addEventListener("click", function () { setMode("upgrade"); if ($("ug-cpu").value && $("ug-gpu").value && !$("ug-result").innerHTML.trim()) go(); else $("ug-cpu").focus(); });
  if (/^#aufruesten/.test(location.hash)) setMode("upgrade");
  var src = window.HR_CATALOG ? Promise.resolve(window.HR_CATALOG) : fetch("data/catalog.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; });
  src.then(init).catch(function () { $("ug-result").innerHTML = '<p class="b-note">Die Preise konnten nicht geladen werden. Lade die Seite bitte neu.</p>'; });
  window.HRUpgrade = { findCpu: findCpu, findGpu: findGpu, plan: plan, choose: choose, cat: cat };
})();
