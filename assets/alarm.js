/* Hardware-Radar – Preisalarm
   Zielpreise werden nur im Browser gespeichert (localStorage "hr-alarms"). Bei jedem Besuch vergleicht die Seite
   sie mit den aktuellen Preisen aus data/catalog.json und meldet erreichte Ziele. Kein Konto, keine E-Mail. */
(function () {
  "use strict";
  var KEY = "hr-alarms", SEEN = "hr-alarms-seen";
  var me = document.currentScript && document.currentScript.getAttribute("src") || "assets/alarm.js";
  var BASE = me.replace(/assets\/alarm\.js.*$/, "");
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) { return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function num(v) { var x = parseFloat(String(v).replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : null; }
  var prices = null; // id -> {price, shop, name}

  function fetchPrices() {
    if (prices) return Promise.resolve(prices);
    var src = window.HR_CATALOG ? Promise.resolve(window.HR_CATALOG) : fetch(BASE + "data/catalog.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; });
    return src.then(function (c) {
      prices = {};
      ((c && c.products) || []).forEach(function (p) { if (p && p.id && typeof p.price === "number") prices[p.id] = { price: p.price, shop: p.shop, name: p.name }; });
      return prices;
    }).catch(function () { prices = {}; return prices; });
  }
  function hits(a, pr) { return Object.keys(a).filter(function (id) { return pr[id] && pr[id].price <= a[id].t; }); }

  /* ---------- Glocke im Kopf ---------- */
  var bell, panel;
  function mountBell() {
    var head = document.querySelector(".site-head .wrap"); if (!head || bell) return;
    bell = document.createElement("button");
    bell.type = "button"; bell.className = "theme-toggle alarm-bell"; bell.id = "alarm-bell"; bell.setAttribute("aria-haspopup", "dialog");
    bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg><span class="bell-n" hidden></span>';
    bell.addEventListener("click", openPanel);
    var t = document.getElementById("theme-toggle");
    if (t) head.insertBefore(bell, t); else head.appendChild(bell);
    updateBell();
  }
  function updateBell() {
    if (!bell) return;
    var a = load(), n = Object.keys(a).length, h = prices ? hits(a, prices).length : 0, b = bell.querySelector(".bell-n");
    bell.title = n ? n + " Preisalarm" + (n > 1 ? "e" : "") + (h ? ", " + h + " erreicht" : "") : "Preisalarme";
    bell.setAttribute("aria-label", bell.title);
    bell.hidden = !n; b.hidden = !n; b.textContent = h || n; b.classList.toggle("hit", h > 0);
  }
  function openPanel() {
    if (!panel) {
      panel = document.createElement("div"); panel.className = "alarm-panel"; panel.hidden = true;
      panel.innerHTML = '<div class="alarm-box" role="dialog" aria-modal="true" aria-labelledby="al-t"><div class="al-head"><h2 id="al-t">Deine Preisalarme</h2><button type="button" class="btn ghost al-x" aria-label="Schließen">✕</button></div><div class="al-list"></div><p class="al-note">Gespeichert nur in diesem Browser. Die Seite prüft deine Zielpreise bei jedem Besuch mit den aktuellen Preisen, eine E-Mail gibt es nicht.</p></div>';
      document.body.appendChild(panel);
      panel.addEventListener("click", function (e) {
        if (e.target === panel || e.target.closest(".al-x")) { panel.hidden = true; return; }
        var d = e.target.closest("[data-del]"); if (d) { var a = load(); delete a[d.getAttribute("data-del")]; save(a); renderPanel(); updateBell(); syncForms(); }
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) panel.hidden = true; });
    }
    renderPanel(); panel.hidden = false; var x = panel.querySelector(".al-x"); if (x) x.focus();
  }
  function renderPanel() {
    var a = load(), ids = Object.keys(a), list = panel.querySelector(".al-list");
    if (!ids.length) { list.innerHTML = '<p class="al-empty">Noch keine Preisalarme. Öffne ein Produkt und setze dort deinen Wunschpreis.</p>'; return; }
    ids.sort(function (x, y) { var px = prices && prices[x], py = prices && prices[y]; return ((py && py.price <= a[y].t) - (px && px.price <= a[x].t)) || a[x].n.localeCompare(a[y].n); });
    list.innerHTML = ids.map(function (id) {
      var al = a[id], cur = prices && prices[id], hit = cur && cur.price <= al.t;
      return '<div class="al-row' + (hit ? " hit" : "") + '"><div class="al-name"><a href="' + BASE + "p/" + encodeURIComponent(id) + '.html">' + esc(al.n) + "</a>" +
        '<span>Ziel ' + eur(al.t) + " · " + (cur ? "jetzt " + eur(cur.price) + (hit ? " – erreicht!" : "") : "aktuell kein Preis") + "</span></div>" +
        '<button type="button" class="btn ghost" data-del="' + esc(id) + '">Löschen</button></div>';
    }).join("");
  }

  /* ---------- Hinweis bei erreichtem Ziel ---------- */
  function toast(ids, a) {
    var seen = {}; try { seen = JSON.parse(sessionStorage.getItem(SEEN) || "{}"); } catch (e) {}
    var fresh = ids.filter(function (id) { return !seen[id]; }); if (!fresh.length) return;
    fresh.forEach(function (id) { seen[id] = 1; }); try { sessionStorage.setItem(SEEN, JSON.stringify(seen)); } catch (e) {}
    var id = fresh[0], p = prices[id];
    var t = document.createElement("div"); t.className = "alarm-toast"; t.setAttribute("role", "status");
    t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg>' +
      '<div><b>Preisalarm erreicht' + (fresh.length > 1 ? " (" + fresh.length + ")" : "") + '</b><span>' + esc(a[id].n) + " kostet jetzt " + eur(p.price) + " bei " + esc(p.shop) + " (dein Ziel: " + eur(a[id].t) + ").</span></div>" +
      '<a class="btn primary" href="' + BASE + "p/" + encodeURIComponent(id) + '.html">Ansehen</a><button type="button" class="btn ghost" aria-label="Schließen">✕</button>';
    t.querySelector("button").addEventListener("click", function () { t.remove(); });
    document.body.appendChild(t);
  }

  /* ---------- Formular auf der Produktseite ---------- */
  function syncForms() {
    var a = load();
    [].forEach.call(document.querySelectorAll("form.alarm-form"), function (f) {
      var id = f.getAttribute("data-id"), al = a[id], st = f.querySelector(".al-state"), inp = f.querySelector("input"), del = f.querySelector(".al-del");
      if (al) { st.innerHTML = "Alarm aktiv: Wir melden uns hier auf der Seite, sobald der Preis bei <b>" + eur(al.t) + "</b> oder darunter liegt."; inp.value = String(al.t).replace(".", ","); del.hidden = false; }
      else { st.textContent = "Noch kein Alarm gesetzt."; del.hidden = true; }
    });
  }
  function bindForms() {
    [].forEach.call(document.querySelectorAll("form.alarm-form"), function (f) {
      var id = f.getAttribute("data-id"), price = parseFloat(f.getAttribute("data-price")), inp = f.querySelector("input");
      if (!inp.value) inp.value = String(Math.floor(price * 0.9)).replace(".", ",");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = num(inp.value); if (!t) { inp.focus(); inp.setCustomValidity("Bitte einen Preis in Euro eingeben"); inp.reportValidity(); inp.setCustomValidity(""); return; }
        var a = load(); a[id] = { t: t, n: f.getAttribute("data-name"), p: price, at: new Date().toISOString().slice(0, 10) }; save(a);
        mountBell(); syncForms(); updateBell();
      });
      f.querySelector(".al-del").addEventListener("click", function () { var a = load(); delete a[id]; save(a); syncForms(); updateBell(); });
    });
    syncForms();
  }

  function start() {
    bindForms();
    if (Object.keys(load()).length) mountBell();
    fetchPrices().then(function (pr) {
      var a = load(), h = hits(a, pr);
      updateBell(); if (h.length) toast(h, a);
    });
  }
  window.HRAlarm = { load: load, open: openPanel };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 0); }); else setTimeout(start, 0);
})();
