/*
 * Hardware-Radar – Kaufberatungen.
 * Jede Beratung hat einen festen Text und Tabellen, die bei jeder Veröffentlichung aus dem aktuellen Katalog
 * neu berechnet werden. Leistungswerte sind grobe Richtwerte (RTX 5090 = 100) und nur für den Vergleich gedacht.
 */

/* ---------- gemeinsame Bausteine ---------- */
function gpuRows(H, filter) {
  const by = new Map();
  for (const p of H.products) {
    if (p.cat !== "Grafikkarten") continue;
    const gi = H.gpuInfo(p); if (!gi || !filter(p, gi)) continue;
    const chip = H.chipOf(p); if (!chip) continue;
    const cur = by.get(chip); if (!cur || p.price < cur.p.price) by.set(chip, { p, gi, chip });
  }
  return [...by.values()].sort((a, b) => b.gi.perf - a.gi.perf);
}
function gpuTable(H, rows, note) {
  if (!rows.length) return `<p class="g-empty">Gerade gibt es in diesem Preisbereich keine Karte im Radar. ${note || ""}</p>`;
  const best = rows.slice().sort((a, b) => a.p.price / a.gi.perf - b.p.price / b.gi.perf)[0];
  return `<div class="offers-scroll"><table class="g-table"><thead><tr><th>Grafikchip</th><th>Günstigstes Modell</th><th class="num">Preis</th><th class="num">Leistung</th><th class="num">€ pro Punkt</th><th></th></tr></thead><tbody>` +
    rows.map(r => `<tr class="${r === best ? "best" : ""}"><td><b>${H.esc(r.chip)}</b>${r === best ? '<span class="tag-best">bestes Preis-Leistungs-Verhältnis</span>' : ""}</td><td><a href="${H.B}p/${r.p.id}.html">${H.esc(r.p.name)}</a></td><td class="num">${H.eur(r.p.price)}</td><td class="num">${r.gi.perf}</td><td class="num">${(r.p.price / r.gi.perf).toFixed(1).replace(".", ",")}</td><td class="go">${H.btn(H.L.productLink(r.p), "ghost")}</td></tr>`).join("") +
    `</tbody></table></div>`;
}
function list(H, items, n) { return items.length ? `<ul class="minis">${items.slice(0, n || 8).map(p => H.miniRow(p, H.B)).join("")}</ul>` : '<p class="g-empty">Gerade ist hier nichts im Radar.</p>'; }
const cheapest = (H, f) => H.products.filter(f).sort((a, b) => a.price - b.price);
const tb = p => { const m = (p.sub + " " + p.name).match(/(\d+(?:[.,]\d+)?)\s?TB/i); if (m) return parseFloat(m[1].replace(",", ".")); const g = (p.sub + " " + p.name).match(/(\d{3,4})\s?GB/i); return g ? +g[1] / 1000 : null; };
const gb = p => { const m = (p.sub + " " + p.name).match(/(\d{2,3})\s?GB/i); return m ? +m[1] : null; };
const watt = p => { const m = (p.sub + " " + p.name).match(/(\d{3,4})\s?W\b/i); return m ? +m[1] : null; };
const CPU = [
  [/9950x3d/i, "Ryzen 9 9950X3D", 101], [/9900x3d/i, "Ryzen 9 9900X3D", 95], [/9850x3d/i, "Ryzen 7 9850X3D", 102], [/9800x3d/i, "Ryzen 7 9800X3D", 100], [/7800x3d/i, "Ryzen 7 7800X3D", 88], [/7500x3d/i, "Ryzen 5 7500X3D", 80],
  [/9700x/i, "Ryzen 7 9700X", 78], [/9600x/i, "Ryzen 5 9600X", 75], [/7700x/i, "Ryzen 7 7700X", 74], [/7600x/i, "Ryzen 5 7600X", 71], [/ryzen 5 7600\b/i, "Ryzen 5 7600", 70], [/7500f/i, "Ryzen 5 7500F", 68],
  [/5800x3d/i, "Ryzen 7 5800X3D", 72], [/5700x3d/i, "Ryzen 7 5700X3D", 68], [/5600x\b|5600\b/i, "Ryzen 5 5600(X)", 55],
  [/285k/i, "Core Ultra 9 285K", 82], [/265k/i, "Core Ultra 7 265K", 79], [/245k/i, "Core Ultra 5 245K", 72], [/14900k/i, "Core i9-14900K", 84], [/14700k/i, "Core i7-14700K", 80], [/14600k/i, "Core i5-14600K", 74], [/14400f?/i, "Core i5-14400(F)", 64], [/12400f?/i, "Core i5-12400(F)", 55]
];
function cpuRows(H) {
  const by = new Map();
  for (const p of H.products) {
    if (p.cat !== "Prozessoren") continue;
    const r = CPU.find(c => c[0].test(p.name)); if (!r) continue;
    const cur = by.get(r[1]); if (!cur || p.price < cur.p.price) by.set(r[1], { p, model: r[1], score: r[2] });
  }
  return [...by.values()].sort((a, b) => b.score - a.score);
}

/* ---------- die Beratungen ---------- */
export const GUIDES = [
  {
    slug: "grafikkarte-bis-400-euro", cat: "Grafikkarten", short: "Grafikkarte bis 400 €", cfg: "budget=1100&use=1080",
    title: "Die beste Grafikkarte bis 400 Euro für Full HD",
    teaser: "Welche Grafikkarte lohnt sich für Full-HD-Gaming, wenn das Budget knapp ist? Die aktuell günstigsten Karten bis 400 € im Leistungsvergleich.",
    forProduct: (p, x) => p.cat === "Grafikkarten" && p.price <= 400,
    render(H) {
      const rows = gpuRows(H, p => p.price <= 400);
      const near = rows.length ? "" : gpuTable(H, gpuRows(H, p => p.price <= 520));
      return `<h2>Kurz gesagt</h2>
<p>Für Full HD (1920 × 1080) reicht eine Einsteiger-Karte, wenn du bei sehr neuen Spielen die Grafikdetails etwas zurücknimmst. Achte vor allem auf den Grafikspeicher: 8 GB genügen für die meisten Spiele in Full HD, werden in aktuellen Titeln mit hohen Texturen aber knapp. Wenn eine Karte mit 16 GB nur wenig mehr kostet, ist sie die sicherere Wahl für die nächsten Jahre.</p>
<h2>Die aktuell günstigsten Karten bis 400 €</h2>
<p>Pro Grafikchip zeigt die Tabelle das günstigste Modell, das Hardware-Radar gerade findet. Die Spalte „Leistung“ ist ein grober Richtwert (RTX 5090 = 100), „€ pro Punkt“ zeigt, wie viel Leistung du für dein Geld bekommst.</p>
${gpuTable(H, rows, "Grafikkarten sind 2026 spürbar teurer geworden. Hier die günstigsten Karten knapp darüber:")}${near}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Grafikspeicher:</b> 8 GB für Full HD mit mittleren bis hohen Details, 16 GB wenn du die Karte lange nutzen willst.</li>
<li><b>Prozessor nicht vergessen:</b> Eine Einsteiger-Karte braucht keinen Spitzen-Prozessor. Ein aktueller 6-Kerner reicht völlig.</li>
<li><b>Netzteil:</b> Karten dieser Klasse brauchen meist 130 bis 180 Watt. Ein gutes 550- bis 650-Watt-Netzteil genügt (<a href="${H.B}ratgeber/netzteil-wie-viel-watt.html">So rechnest du nach</a>).</li>
<li><b>Preisverlauf prüfen:</b> Grafikkartenpreise schwanken stark. Auf jeder Produktseite siehst du den Verlauf und kannst einen Preisalarm setzen.</li>
</ul>`;
    }
  },
  {
    slug: "grafikkarte-fuer-wqhd", cat: "Grafikkarten", short: "Grafikkarte für WQHD", cfg: "budget=1600&use=1440",
    title: "Die beste Grafikkarte für WQHD (400 bis 800 Euro)",
    teaser: "WQHD ist für viele Spieler der beste Kompromiss aus Bildschärfe und Bildrate. Diese Grafikkarten liefern dafür gerade am meisten Leistung pro Euro.",
    forProduct: (p) => p.cat === "Grafikkarten" && p.price > 400 && p.price <= 800,
    render(H) {
      const rows = gpuRows(H, (p, gi) => p.price > 400 && p.price <= 800 && gi.perf >= 33);
      return `<h2>Kurz gesagt</h2>
<p>Für WQHD (2560 × 1440) mit hohen Details und hohen Bildraten lohnt sich die obere Mittelklasse. 12 GB Grafikspeicher sind hier das Minimum, 16 GB sind für aktuelle Spiele mit Raytracing deutlich entspannter. NVIDIA punktet mit DLSS und meist besserer Raytracing-Leistung, AMD bietet oft mehr Speicher und mehr klassische Leistung pro Euro.</p>
<h2>Die aktuell besten Karten von 400 bis 800 €</h2>
<p>Pro Grafikchip das günstigste Modell im Radar. Leistung als grober Richtwert (RTX 5090 = 100).</p>
${gpuTable(H, rows)}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Speicher:</b> Lieber 16 GB als 12 GB, wenn der Aufpreis klein ist.</li>
<li><b>Prozessor:</b> In WQHD sollte der Prozessor mithalten, sonst bremst er die Karte. Für Gaming sind AMD-Prozessoren mit 3D-Cache besonders stark (<a href="${H.B}ratgeber/gaming-prozessor.html">Prozessor-Ratgeber</a>).</li>
<li><b>Netzteil:</b> Karten dieser Klasse ziehen 180 bis 300 Watt. Rechne mit 650 bis 750 Watt für den ganzen PC.</li>
<li><b>Monitor:</b> Ein WQHD-Monitor mit 144 Hz oder mehr holt die Leistung dieser Karten auch auf den Bildschirm.</li>
</ul>`;
    }
  },
  {
    slug: "grafikkarte-fuer-4k", cat: "Grafikkarten", short: "Grafikkarte für 4K", cfg: "budget=2800&use=2160",
    title: "Grafikkarten für 4K und High-End-Gaming",
    teaser: "Für 4K mit hohen Details braucht es die stärksten Karten. Der Vergleich zeigt, was sie gerade kosten und wo sich der Aufpreis lohnt.",
    forProduct: (p) => p.cat === "Grafikkarten" && p.price > 800,
    render(H) {
      const rows = gpuRows(H, (p, gi) => gi.perf >= 50);
      return `<h2>Kurz gesagt</h2>
<p>4K (3840 × 2160) ist die anspruchsvollste Auflösung. Selbst die schnellsten Karten nutzen hier oft Upscaling wie DLSS oder FSR, um hohe Bildraten zu erreichen. Mit jeder Stufe nach oben steigt der Preis stärker als die Leistung. Rechne deshalb genau, ob dir die letzten Prozent den Aufpreis wert sind.</p>
<h2>High-End-Karten im Vergleich</h2>
${gpuTable(H, rows)}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Netzteil und Stecker:</b> Die stärksten Karten ziehen 300 bis über 550 Watt und nutzen meist den 12V-2x6-Stecker. Ein ATX-3.1-Netzteil mit passendem Kabel ist hier Pflicht.</li>
<li><b>Gehäuse:</b> High-End-Karten sind oft über 33 cm lang und sehr dick. Prüfe die maximale Grafikkartenlänge des Gehäuses.</li>
<li><b>Prozessor:</b> In 4K zählt der Prozessor weniger als in Full HD, ein aktueller 8-Kerner reicht aber nicht immer für sehr hohe Bildraten.</li>
</ul>`;
    }
  },
  {
    slug: "gaming-prozessor", cat: "Prozessoren", short: "Gaming-Prozessor", cfg: "budget=1500&use=1440",
    title: "Der beste Prozessor für Gaming",
    teaser: "Welcher Prozessor bringt in Spielen am meisten? Warum AMDs 3D-Cache so viel ausmacht und welche CPUs gerade am günstigsten sind.",
    forProduct: (p) => p.cat === "Prozessoren",
    render(H) {
      const rows = cpuRows(H);
      return `<h2>Kurz gesagt</h2>
<p>In Spielen zählen vor allem schneller Cache und hohe Taktraten, viele Kerne bringen dagegen wenig. Besonders stark sind AMD-Prozessoren mit <b>3D V-Cache</b> (erkennbar an „X3D“). Für einen neuen Gaming-PC ist die Plattform <b>AM5</b> mit DDR5-Speicher die zukunftssichere Wahl. Wer aufrüsten will und noch ein AM4-Board hat, kann mit einem Ryzen 7 5700X3D oder 5800X3D günstig viel Leistung nachrüsten.</p>
<h2>Gaming-Prozessoren im Vergleich</h2>
<p>Pro Modell das günstigste Angebot im Radar. „Gaming“ ist ein grober Richtwert (Ryzen 7 9800X3D = 100).</p>
${rows.length ? `<div class="offers-scroll"><table class="g-table"><thead><tr><th>Prozessor</th><th class="num">Preis</th><th class="num">Gaming</th><th class="num">€ pro Punkt</th><th></th></tr></thead><tbody>` +
        rows.map(r => `<tr><td><a href="${H.B}p/${r.p.id}.html"><b>${H.esc(r.model)}</b></a><br><small>${H.esc(r.p.name)}</small></td><td class="num">${H.eur(r.p.price)}</td><td class="num">${r.score}</td><td class="num">${(r.p.price / r.score).toFixed(2).replace(".", ",")}</td><td class="go">${H.btn(H.L.productLink(r.p), "ghost")}</td></tr>`).join("") + `</tbody></table></div>` : '<p class="g-empty">Gerade sind keine Prozessoren im Radar.</p>'}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Sockel:</b> Prozessor und Mainboard müssen zusammenpassen (AM5, AM4, LGA1700 oder LGA1851). Der PC-Konfigurator prüft das automatisch.</li>
<li><b>Boxed oder Tray:</b> „Boxed“ heißt mit Verpackung und manchmal mit Kühler. Die X3D-Modelle kommen ohne Kühler, du brauchst also einen eigenen.</li>
<li><b>Grafikeinheit:</b> Modelle mit „F“ (Intel) bzw. ein Ryzen 5 7500F haben keine eingebaute Grafik. Das ist egal, solange du eine Grafikkarte nutzt.</li>
</ul>`;
    }
  },
  {
    slug: "arbeitsspeicher-ram-2026", cat: "Arbeitsspeicher", short: "Arbeitsspeicher 2026",
    title: "Arbeitsspeicher 2026: Wie viel RAM brauchst du und lohnt sich der Kauf gerade?",
    teaser: "RAM ist 2026 so teuer wie lange nicht. Wie viel Arbeitsspeicher ein Gaming-PC wirklich braucht und wo 32 GB gerade am günstigsten sind.",
    forProduct: (p) => p.cat === "Arbeitsspeicher",
    render(H) {
      const ddr5 = cheapest(H, p => p.cat === "Arbeitsspeicher" && /ddr5/i.test(p.sub + " " + p.name));
      const ddr4 = cheapest(H, p => p.cat === "Arbeitsspeicher" && /ddr4/i.test(p.sub + " " + p.name));
      const pulse = (H.pulse || []).filter(x => /RAM|GB/.test(x.label));
      return `<h2>Kurz gesagt</h2>
<p><b>32 GB</b> sind 2026 die richtige Größe für einen Gaming-PC. 16 GB reichen für viele Spiele noch, werden mit Browser, Discord und Streaming im Hintergrund aber schnell knapp. 64 GB bringen beim Spielen keinen Vorteil. Für AM5-Prozessoren ist <b>DDR5-6000</b> mit niedriger Latenz (CL30 bis CL36) der beste Kompromiss.</p>
<h2>Warum RAM gerade so teuer ist</h2>
<p>Seit Ende 2025 sind die Preise für Arbeitsspeicher stark gestiegen, weil Hersteller viel Produktion auf Speicher für KI-Rechenzentren umgestellt haben.${pulse.length ? " Die aktuellen Marktdaten im Radar: " + pulse.map(x => `<b>${H.esc(x.label)}: ${H.esc(x.value)}</b> (${H.esc(x.source)})`).join(", ") + "." : ""} Für dich heißt das: Kaufe nur so viel RAM, wie du wirklich brauchst, und vergleiche die Preise genau. Die Unterschiede zwischen den Shops sind gerade oft groß.</p>
<h2>DDR5 – die günstigsten Kits im Radar</h2>
${list(H, ddr5, 8)}
${ddr4.length ? `<h2>DDR4 für ältere PCs</h2><p>Nur sinnvoll, wenn du einen PC mit AM4- oder älterem Intel-Mainboard aufrüstest.</p>${list(H, ddr4, 4)}` : ""}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Zwei Module:</b> Kaufe ein Kit aus 2 × 16 GB statt eines einzelnen Moduls. Mit zwei Modulen läuft der Speicher im schnelleren Dual-Channel-Modus.</li>
<li><b>EXPO oder XMP:</b> Schalte das Profil im BIOS ein, sonst läuft der Speicher langsamer als angegeben.</li>
<li><b>Preisalarm:</b> Wenn du nicht sofort kaufen musst, setze auf der Produktseite einen Preisalarm.</li>
</ul>`;
    }
  },
  {
    slug: "ssd-kaufberatung", cat: "SSDs", short: "SSD-Kaufberatung",
    title: "SSD-Kaufberatung: Die beste NVMe-SSD für Spiele",
    teaser: "Wie groß sollte die SSD sein, und bringt PCIe 5.0 beim Spielen etwas? Die günstigsten NVMe-SSDs im Radar, sortiert nach Preis pro Terabyte.",
    forProduct: (p) => p.cat === "SSDs",
    render(H) {
      const ssds = H.products.filter(p => p.cat === "SSDs" && tb(p)).map(p => ({ p, tb: tb(p), per: p.price / tb(p) })).sort((a, b) => a.per - b.per);
      return `<h2>Kurz gesagt</h2>
<p>Für einen Gaming-PC ist eine <b>NVMe-SSD mit PCIe 4.0 und 2 TB</b> die beste Wahl. Viele aktuelle Spiele sind über 100 GB groß, 1 TB ist deshalb schnell voll. PCIe-5.0-SSDs sind auf dem Papier doppelt so schnell, die Ladezeiten in Spielen verkürzen sie aber kaum. Sie werden außerdem heißer und kosten mehr.</p>
<h2>Die günstigsten SSDs pro Terabyte</h2>
${ssds.length ? `<div class="offers-scroll"><table class="g-table"><thead><tr><th>SSD</th><th class="num">Größe</th><th class="num">Preis</th><th class="num">€ pro TB</th><th></th></tr></thead><tbody>` +
        ssds.slice(0, 10).map((r, i) => `<tr class="${i === 0 ? "best" : ""}"><td><a href="${H.B}p/${r.p.id}.html">${H.esc(r.p.name)}</a></td><td class="num">${String(r.tb).replace(".", ",")} TB</td><td class="num">${H.eur(r.p.price)}</td><td class="num">${H.eur(r.per)}</td><td class="go">${H.btn(H.L.productLink(r.p), "ghost")}</td></tr>`).join("") + `</tbody></table></div>` : '<p class="g-empty">Gerade sind keine SSDs im Radar.</p>'}
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>M.2-Steckplatz:</b> Fast jedes aktuelle Mainboard hat mindestens zwei M.2-Plätze. Prüfe, ob einer davon PCIe 4.0 unterstützt.</li>
<li><b>Kühlkörper:</b> Viele Mainboards haben einen M.2-Kühler. Dann brauchst du keine SSD mit eigenem Kühlkörper.</li>
<li><b>DRAM-Cache:</b> SSDs mit DRAM-Cache halten bei großen Kopiervorgängen länger durch, für Spiele ist der Unterschied aber klein.</li>
</ul>`;
    }
  },
  {
    slug: "netzteil-wie-viel-watt", cat: "Netzteile", short: "Netzteil: wie viel Watt?",
    title: "Netzteil: Wie viel Watt braucht mein Gaming-PC?",
    teaser: "Zu schwach ist gefährlich, zu stark ist Geldverschwendung. So rechnest du die richtige Netzteil-Leistung aus, mit Beispielen für aktuelle Grafikkarten.",
    forProduct: (p) => p.cat === "Netzteile",
    render(H) {
      const need = (cpu, gpu) => Math.ceil((cpu + gpu + 90) * 1.25 / 50) * 50;
      const ex = [["RTX 5050 / RX 9060", 130], ["RTX 5060 Ti / RX 9060 XT", 180], ["RTX 5070 / RX 9070", 250], ["RTX 5070 Ti / RX 9070 XT", 304], ["RTX 5080", 360], ["RTX 5090", 575]];
      const psus = cheapest(H, p => p.cat === "Netzteile");
      return `<h2>Kurz gesagt</h2>
<p>Addiere die Leistungsaufnahme von Prozessor und Grafikkarte, rechne etwa 90 Watt für Mainboard, Speicher, Lüfter und Laufwerke dazu und plane <b>25 % Reserve</b> ein. Die Reserve fängt kurze Lastspitzen ab und lässt das Netzteil im leisen, effizienten Bereich arbeiten. Genau so rechnet auch unser PC-Konfigurator.</p>
<h2>Beispiele mit einem typischen Gaming-Prozessor (120 W)</h2>
<div class="offers-scroll"><table class="g-table"><thead><tr><th>Grafikkarte</th><th class="num">Grafikkarte</th><th class="num">Empfohlenes Netzteil</th></tr></thead><tbody>${ex.map(e => `<tr><td>${e[0]}</td><td class="num">ca. ${e[1]} W</td><td class="num"><b>${need(120, e[1])} W</b></td></tr>`).join("")}</tbody></table></div>
<h2>Worauf du achten solltest</h2>
<ul class="g-ul">
<li><b>Qualität vor Watt:</b> Ein gutes 750-Watt-Netzteil ist besser als ein billiges mit 1000 Watt. Achte auf 80 PLUS Gold oder besser und auf einen bekannten Hersteller.</li>
<li><b>ATX 3.1 und 12V-2x6:</b> Aktuelle NVIDIA-Karten nutzen den 12V-2x6-Stecker. Netzteile nach ATX 3.1 bringen das passende Kabel mit.</li>
<li><b>Modular:</b> Bei vollmodularen Netzteilen steckst du nur die Kabel ein, die du brauchst. Das macht den Aufbau leichter.</li>
</ul>
<h2>Netzteile im Radar</h2>
${list(H, psus, 8)}`;
    }
  },
  {
    slug: "gaming-pc-zusammenstellen", cat: null, short: "Gaming-PC zusammenstellen", cfg: "budget=1500&use=1440",
    title: "Gaming-PC selbst zusammenstellen: So teilst du dein Budget auf",
    teaser: "Wie viel vom Budget gehört in die Grafikkarte, wie viel in Prozessor und Speicher? Eine einfache Aufteilung für 1.000 bis 3.000 Euro, mit fertigen Vorschlägen.",
    forProduct: () => false,
    render(H) {
      const budgets = [[1000, "1080", "Full HD"], [1500, "1440", "WQHD"], [2000, "1440", "WQHD mit hohen Bildraten"], [3000, "2160", "4K"]];
      return `<h2>Kurz gesagt</h2>
<p>Die Grafikkarte bestimmt am stärksten, wie gut Spiele laufen. Plane für sie etwa <b>35 bis 45 %</b> des Budgets ein. Prozessor und Mainboard zusammen bekommen etwa 25 %, der Rest verteilt sich auf Arbeitsspeicher, SSD, Netzteil, Gehäuse und Kühler. Wegen der hohen RAM-Preise 2026 fällt der Speicher gerade stärker ins Gewicht als früher.</p>
<h2>Grobe Aufteilung</h2>
<div class="offers-scroll"><table class="g-table"><thead><tr><th>Teil</th><th class="num">Anteil</th><th class="num">bei 1.500 €</th></tr></thead><tbody>
<tr><td>Grafikkarte</td><td class="num">35–45 %</td><td class="num">ca. 525–675 €</td></tr>
<tr><td>Prozessor</td><td class="num">15–20 %</td><td class="num">ca. 225–300 €</td></tr>
<tr><td>Arbeitsspeicher (32 GB)</td><td class="num">15–25 %</td><td class="num">ca. 225–375 €</td></tr>
<tr><td>Mainboard</td><td class="num">8–10 %</td><td class="num">ca. 120–150 €</td></tr>
<tr><td>SSD (2 TB)</td><td class="num">7–10 %</td><td class="num">ca. 105–150 €</td></tr>
<tr><td>Netzteil, Gehäuse, Kühler</td><td class="num">12–15 %</td><td class="num">ca. 180–225 €</td></tr>
</tbody></table></div>
<h2>Fertige Vorschläge aus aktuellen Bestpreisen</h2>
<p>Der PC-Konfigurator rechnet alle passenden Kombinationen durch und zeigt dir die stärkste für dein Budget. Ein Klick genügt:</p>
<div class="g-budgets">${budgets.map(b => `<a class="g-budget" href="${H.B}konfigurator.html#budget=${b[0]}&use=${b[1]}"><b>${H.eur0(b[0])}</b><span>${b[2]}</span></a>`).join("")}</div>
<h2>Die wichtigsten Regeln</h2>
<ul class="g-ul">
<li><b>Sockel prüfen:</b> Prozessor und Mainboard müssen denselben Sockel haben, der Arbeitsspeicher den passenden Typ (DDR4 oder DDR5).</li>
<li><b>Nicht am Netzteil sparen:</b> Es versorgt alle Teile. Wie viel Watt du brauchst, steht im <a href="${H.B}ratgeber/netzteil-wie-viel-watt.html">Netzteil-Ratgeber</a>.</li>
<li><b>Monitor mitdenken:</b> Eine starke Karte bringt wenig an einem 60-Hz-Monitor in Full HD.</li>
</ul>`;
    }
  }
];
