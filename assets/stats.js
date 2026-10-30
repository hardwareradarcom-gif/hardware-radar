/* Hardware-Radar – Besucherstatistik mit GoatCounter (ohne Cookies, keine personenbezogenen Profile).
   Aktiv nur, wenn in assets/config.js "goatcounter" gesetzt ist. Nicht bei lokalen Tests. */
(function () {
  var code = (window.HR_CONFIG || {}).goatcounter;
  if (!code || !/^[a-z0-9-]+$/.test(code) || !/^(www\.)?hwradar\.de$/.test(location.hostname)) return;
  var s = document.createElement("script");
  s.async = true; s.src = "https://gc.zgo.at/count.js";
  s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
  document.head.appendChild(s);
})();
