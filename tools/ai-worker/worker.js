/*
 * Hardware-Radar KI-Endpunkt (Cloudflare Worker)
 * Nimmt Chat-Nachrichten aus dem PC-Konfigurator entgegen und fragt Claude (Anthropic API).
 * Der API-Schlüssel bleibt geheim im Worker, die Website sieht ihn nie.
 *
 * Einstellungen im Cloudflare-Dashboard (Settings -> Variables):
 *   ANTHROPIC_API_KEY  (als "Secret")         dein Schlüssel von console.anthropic.com
 *   ALLOWED_ORIGIN     z. B. https://hwradar.de
 *   MODEL              optional, Standard: claude-haiku-5-5 (schnell und günstig)
 */
const RATE = new Map(); // einfache Bremse pro IP: höchstens 20 Anfragen pro 10 Minuten

const SYSTEM = `Du bist der Radar-Assistent von Hardware-Radar, einer deutschen Website für Gaming-PC-Deals.
Du hilfst Nutzern, einen Gaming-PC zusammenzustellen. Antworte immer auf Deutsch, freundlich, knapp (höchstens 120 Wörter), ohne Markdown.
Du bekommst die aktuelle Zusammenstellung, die Einstellungen des Nutzers und einen Auszug aus dem Katalog mit aktuellen Preisen.
Empfiehl nur Teile, die im Katalog stehen, und nenne Preise nur aus dem Katalog. Erfinde keine Benchmarks.
Wenn der Nutzer sein Budget, die Auflösung, die Grafikkarten-Marke, WLAN oder einen Monitor ändern will, setze "options", dann rechnet die Website die Zusammenstellung neu.
Antworte ausschließlich mit JSON in dieser Form:
{"reply": "Text an den Nutzer", "options": {"budget": Zahl in Euro, "use": "1080"|"1440"|"2160"|"work", "gpu": "any"|"nvidia"|"amd", "wifi": true|false, "monitor": true|false}}
Lass "options" weg (oder einzelne Felder), wenn sich nichts ändern soll.`;

function cors(origin, allowed) {
  const ok = allowed && origin === allowed;
  return { "Access-Control-Allow-Origin": ok ? origin : allowed || "null", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const h = cors(origin, env.ALLOWED_ORIGIN);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (req.method !== "POST") return json({ error: "Nur POST" }, 405, h);
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ error: "Nicht erlaubt" }, 403, h);

    const ip = req.headers.get("CF-Connecting-IP") || "?";
    const now = Date.now(), win = 10 * 60 * 1000, list = (RATE.get(ip) || []).filter(t => now - t < win);
    if (list.length >= 20) return json({ reply: "Kurze Pause bitte, du hast gerade sehr viele Fragen gestellt. Versuch es in ein paar Minuten wieder." }, 429, h);
    list.push(now); RATE.set(ip, list);

    let body;
    try { body = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400, h); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Keine Frage" }, 400, h);
    const context = `Einstellungen: ${JSON.stringify(body.options || {}).slice(0, 400)}\nAktuelle Zusammenstellung:\n${String(body.build || "noch leer").slice(0, 2000)}\nKatalog (Auszug, id=Name Preis):\n${String(body.catalog || "").slice(0, 12000)}`;
    messages[messages.length - 1] = { role: "user", content: context + "\n\nNutzer: " + messages[messages.length - 1].content };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: env.MODEL || "claude-haiku-5-5", max_tokens: 600, system: SYSTEM, messages })
    });
    if (!r.ok) return json({ reply: "Die KI ist gerade nicht erreichbar." }, 502, h);
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("").trim();
    let out = { reply: text };
    try { const m = text.match(/\{[\s\S]*\}/); if (m) { const j = JSON.parse(m[0]); out = { reply: String(j.reply || ""), options: j.options && typeof j.options === "object" ? j.options : undefined }; } } catch {}
    if (out.options) {
      const o = out.options, clean = {};
      if (Number.isFinite(+o.budget) && +o.budget >= 300 && +o.budget <= 15000) clean.budget = Math.round(+o.budget);
      if (["1080", "1440", "2160", "work"].includes(String(o.use))) clean.use = String(o.use);
      if (["any", "nvidia", "amd"].includes(o.gpu)) clean.gpu = o.gpu;
      if (typeof o.wifi === "boolean") clean.wifi = o.wifi;
      if (typeof o.monitor === "boolean") clean.monitor = o.monitor;
      out.options = Object.keys(clean).length ? clean : undefined;
    }
    return json(out, 200, h);
  }
};
