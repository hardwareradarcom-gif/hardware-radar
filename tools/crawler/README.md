# Hardware-Radar-Crawler

Der Crawler sucht automatisch in Online-Shops nach Gaming-Hardware, liest die Preise aus und erkennt Deals. Er findet dabei selbstständig neue Shops. Die Ergebnisse landen in `data/catalog.json` (Preisvergleich) und `data/deals.json` (Deals), die Website zeigt sie sofort an, mit direkten Links auf die Produktseite im Shop.

## So arbeitet er

1. **Shops abarbeiten:** Er startet mit den Shops aus `config.json` → `seeds` und allen Shops, die er früher selbst gefunden hat.
2. **robots.txt beachten:** Vor jedem Shop liest er die `robots.txt`. Was dort gesperrt ist, besucht er nicht. Verbietet ein Shop Bots ganz, lässt er ihn in Ruhe. Eine `Crawl-delay`-Angabe hält er ein.
3. **Produktseiten finden:** über die Sitemaps des Shops (die Liste aller Seiten, die Shops für Suchmaschinen bereitstellen) und über Links auf Kategorie- und Startseiten. Er behält nur Adressen, die nach Hardware aussehen (z. B. „rtx-5070“, „ddr5“, „netzteil“).
4. **Preise lesen:** aus den strukturierten Produktdaten (schema.org/JSON-LD), die fast jeder Shop für Google einbaut: Name, Preis in Euro, Verfügbarkeit, EAN. Andere Währungen ignoriert er.
5. **Gleiche Produkte zusammenführen:** über die EAN/GTIN, sonst Hersteller + Teilenummer, sonst den Namen. So entsteht pro Produkt eine Liste aller Shops mit Preis.
6. **Preisverlauf führen:** pro Produkt und Tag den günstigsten Preis.
7. **Deals erkennen:** wenn der Preis mindestens 10 % unter dem mittleren Preis der letzten 30 Tage liegt oder mindestens 8 % unter dem nächstgünstigen Shop (bei mindestens drei Shops). Beide Schwellen stehen in `config.json` → `deals`.
8. **Neue Shops entdecken:** Er merkt sich, auf welche fremden Seiten Shops verlinken. Die häufigsten prüft er: Ist es ein Shop (Warenkorb, Versandkosten) mit Hardware-Bezug und erlaubt die robots.txt den Zugriff? Dann wird er Kandidat. Liefert er auf seinen Produktseiten auswertbare Preise, wird er fester Bestandteil. Shops, die nichts liefern, werden nach mehreren Versuchen aussortiert. Pro Lauf kommen höchstens 5 neue Shops dazu.

Manuell gepflegte Einträge in den Datendateien bleiben erhalten. Findet der Crawler dasselbe Produkt, ergänzt er dort seine Shop-Angebote.

## Sortiment wächst automatisch

Bei jedem Lauf sorgt der Crawler dafür, dass immer mehr Produkte in die Kategorien kommen:

- **Lücken zuerst füllen:** Für jede Kategorie gibt es ein Ziel (`growth.targetPerCategory`, z. B. 300 Netzteile). Seiten aus Kategorien, die noch weit vom Ziel entfernt sind, besucht er zuerst.
- **Listen und Folgeseiten:** Kategorie- und Listenseiten erkennt er, besucht sie täglich neu und folgt den Folgeseiten (Seite 2, 3, …). So findet er neu eingetroffene Produkte.
- **Neue Begriffe lernen:** Aus den gefundenen Produktnamen merkt er sich Modellnamen und Produktreihen (z. B. „rtx 5060“, „pure power“) und erkennt damit mehr passende Seiten in Sitemaps und Listen. Die gelernten Begriffe stehen in `state.json` unter `learned`.
- **Gezielt nachsuchen:** Für Produkte im Preisvergleich, die noch kein direktes Shop-Angebot haben, sucht er höchstens einmal pro Woche in der Shop-Suche (`searchTemplates`). Das passiert nur, wenn die robots.txt des Shops die Suchseite erlaubt.
- **Zusammenführen:** Findet er ein Produkt, das schon im Preisvergleich steht (gleiche Modellnummer und Bezeichnung), ergänzt er dort sein Shop-Angebot mit direktem Link, statt einen Doppeleintrag anzulegen.
- **Neu markieren:** Produkte, die in den letzten drei Tagen dazugekommen sind, bekommen auf der Website ein „neu“-Abzeichen. Im Preisvergleich gibt es dafür die Sortierung „Neu im Radar“.

Nach jedem Lauf steht im Log und in `state.json` → `runs`, wie viele Produkte jede Kategorie hat.

## Höflich bleiben

- Höchstens eine Anfrage pro Shop alle 3 Sekunden, höchstens 250 Seiten pro Shop und 1500 pro Lauf.
- Er nennt sich `HardwareRadarBot` und gibt deine Kontaktadresse an, damit Shops dich erreichen können.
- Antwortet ein Shop mit „zu viele Anfragen“ (HTTP 429/503), hört er für diesen Lauf auf.
- Amazon, eBay und Preisvergleichsportale sind gesperrt (`blockedDomains`). Amazon verbietet automatisches Auslesen in seinen Nutzungsbedingungen; Amazon-Preise gehören, wenn du Partner bist, über die offizielle Product Advertising API eingebunden.

Bitte die Grenzen nicht hochdrehen. Schreibt dich ein Shop an, dass er nicht durchsucht werden möchte, trage ihn bei `blockedDomains` ein.

## Starten

Lokal (Node.js 18 oder neuer, keine Pakete nötig):

```
node tools/crawler/crawl.mjs            # normaler Lauf, schreibt die Daten
node tools/crawler/crawl.mjs --dry      # Testlauf, speichert nichts
node tools/crawler/crawl.mjs --max 200  # nur 200 Anfragen
```

Automatisch: Die Datei `.github/workflows/crawl.yml` startet den Crawler über GitHub Actions dreimal täglich (6:38, 11:38, 17:38 Uhr) und speichert die neuen Daten im Repository. Ist Netlify mit dem Repository verbunden, geht jede Änderung automatisch online. Für öffentliche Repositories ist GitHub Actions kostenlos.

## Gedächtnis

`state.json` speichert bekannte Shops, besuchte Seiten, Preise und den Verlauf. Löschst du die Datei, fängt der Crawler von vorn an. Unter `runs` stehen die letzten 30 Läufe mit Anzahl Anfragen, aktiven Shops, neuen Shops und gefundenen Deals.

## Grenzen

- Shops ohne strukturierte Produktdaten oder mit starkem Bot-Schutz liefern keine Preise. Viele große Händler blocken Bots, dann bleibt der Shop außen vor.
- Versandkosten stehen selten in den Produktdaten, dann zeigt die Seite „unbekannt“.
- Produktbilder übernimmt er nur von Shops, die in `config.json` → `imageDomains` stehen. Die Liste ist anfangs leer, weil Produktfotos urheberrechtlich geschützt sind. Trag einen Shop erst ein, wenn du seine Bilder nutzen darfst, zum Beispiel weil sein Partnerprogramm (AWIN, Amazon PartnerNet usw.) das erlaubt. Gespeichert wird nur der Bildlink, nicht das Bild selbst. Die Website zeigt das Bild dann klein am Produkt, lädt es nicht, erscheint wieder das Kategorie-Symbol.
