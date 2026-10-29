# Hardware-Radar – öffentliche Website

Statische Website, die ohne Server-Code läuft. Die Angebote stehen in `data/deals.json`, die Seite liest sie beim Aufruf.

## Ordner

| Datei | Wozu |
|---|---|
| `index.html` | Startseite mit Suche, Kategorien, Top-Deals und Angebotsraster |
| `assets/config.js` | **Deine Einstellungen**: AdSense-ID, Werbeblöcke, Amazon-Tag, Cookie-Banner |
| `assets/style.css` | Design (helles und dunkles Farbschema) |
| `assets/app.js` | Seitenlogik, Werbung, Cookie-Banner |
| `assets/fonts/` | Hier kommen die drei Schriftdateien hin (siehe Schritt 1) |
| `data/deals.json` | Bereich **Deals**: aktuelle Schnäppchen mit Preisverlauf |
| `data/catalog.json` | Bereich **Preisvergleich**: beliebte Produkte mit den günstigsten Shops |
| `impressum.html`, `datenschutz.html` | Vorlagen, **vor dem Start ausfüllen** |
| `ads.txt.example` | Vorlage für AdSense (siehe Schritt 4) |

## 1. Schriften einbinden (5 Minuten)

Die Seite lädt bewusst nichts von Google Fonts, weil das in Deutschland ohne Einwilligung datenschutzrechtlich heikel ist. Lade die drei freien Schriften einmal herunter und lege sie in `assets/fonts/`:

1. Öffne https://gwfh.mranftl.com/fonts
2. Suche nacheinander **Unbounded**, **Manrope** und **JetBrains Mono**, wähle jeweils die Stärken 400 bis 700 und lade die `.woff2`-Dateien herunter.
3. Benenne je eine Datei so um: `Unbounded.woff2`, `Manrope.woff2`, `JetBrainsMono.woff2` (am besten die Variante mit der Stärke 600 bzw. 500).

Ohne die Dateien funktioniert die Seite trotzdem, sie nutzt dann die Systemschriften.

## 2. Online stellen (kostenlos)

**Aktuell eingerichtet:** GitHub Pages über GitHub Actions. Der Workflow `Website veröffentlichen` stellt die Seite bei jeder Änderung neu online, der Workflow `Preise aktualisieren` startet dreimal täglich den Crawler und veröffentlicht danach automatisch. Die Adresse ist `https://hardwareradarcom-gif.github.io/hardware-radar/`.

### Alternative: manuell bei GitHub Pages

1. Konto auf https://github.com anlegen.
2. Neues Repository anlegen, z. B. `hardware-radar`, Sichtbarkeit **Public**.
3. Auf „uploading an existing file“ klicken und den **Inhalt** dieses Ordners hochladen (nicht den Ordner selbst). „Commit changes“ klicken.
4. Im Repository: **Settings → Pages → Branch: main / (root) → Save**.
5. Nach ein bis zwei Minuten ist die Seite unter `https://DEINNAME.github.io/hardware-radar/` erreichbar.

Eigene Domain (z. B. `hardware-radar.de`): bei einem Domain-Anbieter kaufen, dann unter Settings → Pages → Custom domain eintragen und die DNS-Einträge setzen, die GitHub dort anzeigt. Für AdSense ist eine eigene Domain praktisch Pflicht.

## 3. Impressum und Datenschutz ausfüllen

In `impressum.html` und `datenschutz.html` alle Angaben in `[eckigen Klammern]` ersetzen und die blauen Hinweiskästen löschen. Ohne vollständiges Impressum keine öffentliche Seite mit Werbung, das kann abgemahnt werden.

## 4. Werbung mit Google AdSense

1. Bei https://adsense.google.com mit der Website-Adresse anmelden. Google prüft die Seite, das dauert meist einige Tage bis Wochen.
2. Deine Publisher-ID (`ca-pub-…`) in `assets/config.js` bei `adsenseClient` eintragen.
3. In AdSense zwei Anzeigenblöcke vom Typ „Display“ anlegen und deren IDs bei `adSlots.leaderboard` und `adSlots.infeed` eintragen.
4. `ads.txt.example` in `ads.txt` umbenennen, deine Publisher-ID eintragen (ohne `ca-`) und hochladen.
5. `showAdPlaceholders` auf `false` setzen, damit keine grauen Platzhalter mehr erscheinen.

**Wichtig zum Cookie-Banner:** Google verlangt für Nutzer im EWR ein von Google zertifiziertes Consent-Tool, damit personalisierte Anzeigen ausgespielt werden. Das eingebaute Banner lädt Werbung erst nach Zustimmung, ist aber nicht zertifiziert. Am einfachsten: in AdSense unter **Datenschutz und Mitteilungen** die kostenlose DSGVO-Mitteilung von Google aktivieren und dann in `config.js` `useBuiltinConsent: false` setzen.

## 5. Affiliate-Links (oft lukrativer als Banner)

Deals und Shop-Angebote können direkt auf die Produktseite im Shop verlinken. Die Seite entfernt dabei fremde Tracking-Kennungen (z. B. das `tag` eines anderen Amazon-Partners oder `utm_`-Parameter) und hängt automatisch **deine** Partner-ID an. Solche Links bekommen ein Sternchen (*), und im Fußbereich erscheint der Pflicht-Hinweis.

**Einrichten in `assets/config.js`:**
- **Amazon PartnerNet** (partnernet.amazon.de): Tracking-ID bei `affiliate.amazonTag` eintragen, z. B. `"hardwareradar-21"`. Amazon verlangt drei Verkäufe in den ersten 180 Tagen.
- **AWIN** (awin.com, viele deutsche Shops wie MediaMarkt, Saturn, Alternate): deine Publisher-ID bei `affiliate.awinId`, dann bei `affiliate.awinMerchants` für jeden Shop, der dich freigeschaltet hat, dessen Advertiser-ID. Welche Shops über AWIN laufen und ihre IDs siehst du nach der Anmeldung im AWIN-Konto. Weitere Shops ergänzt du einfach als neue Zeile.

**Direkte Shop-Links in den Daten:**
- `data/deals.json`: Feld `"shopUrl"` mit der Produktseite im Shop. Ohne `shopUrl` verlinkt der Deal weiter auf die Quelle (z. B. mydealz).
- `data/catalog.json`: pro Angebot in `offers` das Feld `"url"`. Dann erscheint in der Shop-Tabelle „Zum Shop“, und der Hauptknopf führt direkt zum günstigsten Shop.

Links auf Deal-Portale und Preisvergleiche (mydealz, hardwaredealz, Geizhals, idealo) werden nie verändert. Nutze keine Weiterleitungslinks dieser Portale als Shop-Link, sonst geht die Provision an das Portal statt an dich.

## Produktbilder

Jedes Produkt hat einen kleinen Bildplatz. Ohne Bild zeigt die Seite ein Symbol für die Kategorie. Für ein echtes Foto trägst du beim Produkt in `data/deals.json` oder `data/catalog.json` das Feld `"img"` mit einem Bildlink ein, zum Beispiel:

```json
"img": "https://m.media-amazon.com/images/I/….jpg"
```

**Wichtig:** Produktfotos von Herstellern und Shops sind urheberrechtlich geschützt. Nutze nur Bilder, die du verwenden darfst:
- Amazon PartnerNet: Bildlinks aus der SiteStripe-Leiste oder der Product Advertising API
- AWIN und andere Affiliate-Netzwerke: Bild-URLs aus den Produktfeeds der Shops
- Pressebilder von Herstellern, wenn deren Bedingungen die Nutzung erlauben

Bilder einfach von Shop-Seiten zu kopieren oder zu verlinken, kann in Deutschland teure Abmahnungen nach sich ziehen. Lädt ein Bild nicht, zeigt die Seite automatisch wieder das Symbol.

## 6. Tägliche Aktualisierung

Die Preise werden aktuell jeden Morgen in der Claude-Seite „Hardware-Radar“ aktualisiert. Damit die öffentliche Seite das auch bekommt, muss das Update `data/deals.json` und `data/catalog.json` in deinem GitHub-Repository schreiben. Sag Claude dafür einfach, wie dein Repository heißt (z. B. `deinname/hardware-radar`). Claude stellt die tägliche Aufgabe dann so um, dass sie die Datei dort direkt aktualisiert. GitHub Pages veröffentlicht jede Änderung automatisch.

Format eines Eintrags in `data/deals.json`:

```json
{
  "id": "pny-rtx5070ti",
  "name": "PNY GeForce RTX 5070 Ti Overclocked Triple Fan 16GB",
  "cat": "Grafikkarten",
  "price": 1222,
  "ref": 1289,
  "shop": "Amazon",
  "url": "https://… (Quelle, z. B. mydealz-Deal)",
  "shopUrl": "https://… (optional: Produktseite im Shop)",
  "note": "optional",
  "hist": [{"d": "2026-08-27", "p": 1125.86}, {"d": "2026-10-29", "p": 1222}],
  "histLabel": "optional: Quelle der Verlaufsskala",
  "seen": "2026-10-29",
  "tags": "nvidia geforce gpu 5070ti",
  "img": "optional: lizenzierter Bildlink"
}
```

Format eines Produkts in `data/catalog.json` (Preisvergleich):

```json
{
  "id": "asus-dual-geforce-rtx-5050-oc-8gb",
  "name": "ASUS Dual GeForce RTX 5050 OC 8GB",
  "cat": "Grafikkarten",
  "sub": "GeForce RTX 5050",
  "price": 349.99,
  "shop": "MediaMarkt",
  "offers": [
    {"shop": "MediaMarkt", "price": 349.99, "ship": 0, "avail": "Auf Lager", "url": "https://www.mediamarkt.de/… (optional)"},
    {"shop": "Caseking", "price": 450.19, "ship": 4.99, "avail": null}
  ],
  "count": 36,
  "url": "https://… (Seite beim Preisvergleich)",
  "source": "Geizhals",
  "stand": "2026-10-29T15:20",
  "hist": [{"d": "2026-10-29", "p": 349.99}]
}
```

`price` und `shop` sind immer das günstigste Angebot, `ship` ist `null`, wenn die Versandkosten unbekannt sind. Ist `stand` älter als 7 Tage, zeigt die Seite einen Hinweis.

Erlaubte Kategorien: Grafikkarten, Prozessoren, Arbeitsspeicher, SSDs, Mainboards, Monitore, Netzteile, Gehäuse, Kühlung.

## Automatischer Deal-Crawler

Im Ordner `tools/crawler` liegt ein Programm, das selbstständig Shops durchsucht, neue Shops entdeckt, Preise samt Verlauf speichert und Deals erkennt. Es schreibt direkt in `data/catalog.json` und `data/deals.json`, mit direkten Links auf die Produktseiten im Shop. Wie es funktioniert und wie man es einstellt, steht in `tools/crawler/README.md`.

**Damit es automatisch läuft:**
1. Lade den kompletten Ordner (inklusive `.github` und `tools`) in ein GitHub-Repository hoch.
2. Verbinde bei Netlify die Seite mit diesem Repository: *Add new project → Import an existing project → GitHub*. Die Einstellungen kommen aus `netlify.toml`, du musst nichts eintragen.
3. Unter *Actions* im Repository einmal „Preise aktualisieren“ → *Run workflow* starten, um den ersten Lauf zu testen.

Danach läuft der Crawler dreimal täglich über GitHub Actions, und Netlify veröffentlicht jede Änderung automatisch. Netlify Drop (Ordner per Hand hochziehen) aktualisiert sich nicht von selbst.

## Lokal ansehen

Weil die Seite `deals.json` nachlädt, öffnet man sie am besten über einen kleinen lokalen Server, z. B. im Ordner `python3 -m http.server` ausführen und `http://localhost:8000` öffnen. Ein Doppelklick auf `index.html` zeigt in manchen Browsern keine Angebote.

## Rechtliches in Kürze (keine Rechtsberatung)

- Impressum und Datenschutzerklärung vollständig und erreichbar
- Werbung und Affiliate-Links gekennzeichnet
- Werbe-Cookies erst nach Einwilligung
- Wer regelmäßig Einnahmen erzielt, braucht in der Regel eine Gewerbeanmeldung; Einnahmen gehören in die Steuererklärung
