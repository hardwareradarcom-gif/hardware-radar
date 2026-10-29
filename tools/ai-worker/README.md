# Echte KI für den PC-Konfigurator (optional)

Der PC-Konfigurator hat einen eingebauten **Radar-Assistenten**. Er läuft komplett im Browser, kostet nichts und schickt keine Daten weg. Er versteht Wünsche wie „1500 € für WQHD, lieber NVIDIA“, „günstiger“, „mit Monitor“ oder „warum diese Teile?“, sucht unter allen passenden Kombinationen die stärkste fürs Budget und erklärt seine Wahl.

Wenn du zusätzlich eine **echte KI** (Claude) für freie Fragen willst, brauchst du einen kleinen Vermittler, der deinen API-Schlüssel geheim hält. Dafür ist `worker.js` da.

## Einrichten (ca. 15 Minuten)

1. **API-Schlüssel:** Konto auf console.anthropic.com anlegen, Guthaben aufladen (Abrechnung nach Nutzung; mit dem voreingestellten schnellen Modell kostet eine Antwort typischerweise nur Bruchteile eines Cents), unter *API Keys* einen Schlüssel erstellen. Ein Ausgabenlimit unter *Limits* setzen.
2. **Cloudflare Worker:** Kostenloses Konto auf dash.cloudflare.com → *Workers & Pages* → *Create* → *Worker*. Den Inhalt von `worker.js` in den Editor kopieren und *Deploy* klicken.
3. **Einstellungen** des Workers (*Settings → Variables and Secrets*):
   - `ANTHROPIC_API_KEY` als **Secret** mit deinem Schlüssel
   - `ALLOWED_ORIGIN` = `https://hwradar.de`
4. **Website verbinden:** In `assets/config.js` bei `aiEndpoint` die Adresse des Workers eintragen, z. B. `"https://hardware-radar-ai.deinname.workers.dev"`.

Fällt die KI aus oder ist das Limit erreicht, antwortet automatisch wieder der eingebaute Assistent.

## Wichtig vor dem Einschalten

- **Datenschutz:** Mit KI gehen die Chat-Nachrichten über Cloudflare an Anthropic (USA). Ergänze dann in `datenschutz.html` einen Abschnitt „KI-Assistent“: welche Daten (Chat-Text, aktuelle Zusammenstellung), an wen (Cloudflare Inc., Anthropic PBC), Zweck (Beantwortung der Frage), Rechtsgrundlage (Art. 6 Abs. 1 lit. b oder f DSGVO), Drittlandübermittlung (Data Privacy Framework bzw. Standardvertragsklauseln). Weise im Chat darauf hin, keine persönlichen Daten einzugeben.
- **Kosten im Blick behalten:** Der Worker bremst jede IP auf 20 Fragen pro 10 Minuten. Setz zusätzlich bei Anthropic ein monatliches Ausgabenlimit.
- **Den Schlüssel nie** in `config.js` oder eine andere Website-Datei schreiben. Er gehört nur in die Worker-Einstellungen.
