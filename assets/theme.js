/* Hell/Dunkel: merkt sich die Wahl, sonst gilt die Systemeinstellung. Wird im <head> geladen, damit nichts aufblitzt. */
(function () {
  var KEY = "hr-theme", root = document.documentElement;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function system() { return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; }
  function current() { return root.getAttribute("data-theme") || system(); }
  function apply(t) {
    if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme");
    var c = current() === "light" ? "#f3f5f8" : "#0b0e13";
    [].forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", c); m.removeAttribute("media"); });
    var b = document.getElementById("theme-toggle");
    if (b) { var light = current() === "light"; b.setAttribute("aria-pressed", String(!light)); b.setAttribute("aria-label", light ? "Dunkles Design einschalten" : "Helles Design einschalten"); b.title = light ? "Dunkles Design" : "Helles Design"; }
  }
  var s = saved(); if (s === "light" || s === "dark") root.setAttribute("data-theme", s);
  document.addEventListener("DOMContentLoaded", function () {
    var head = document.querySelector(".site-head .wrap"); if (!head) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "theme-toggle"; b.className = "theme-toggle";
    b.innerHTML = '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>';
    b.addEventListener("click", function () {
      var next = current() === "light" ? "dark" : "light";
      try { if (next === system()) localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch (e) {}
      apply(next === system() ? null : next); if (next === system()) apply(null);
    });
    head.appendChild(b); apply(root.getAttribute("data-theme"));
  });
  if (window.matchMedia) try { matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () { if (!saved()) apply(null); }); } catch (e) {}
})();
