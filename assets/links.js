/* Hardware-Radar – Shop-Links
   Entfernt fremde Tracking-Kennungen, hängt die eigenen Partner-IDs an (Amazon, AWIN) und baut
   Shop-Suchlinks, wenn keine Produktseite bekannt ist. Links zu Preisportalen werden nie erzeugt.
   Wird im Browser (window.HRLinks) und beim Erzeugen der Produktseiten (Node) genutzt. */
(function (root) {
  "use strict";
  function make(CFG) {
    CFG = CFG || {};
    var STRIP = ["tag", "ascsubtag", "linkcode", "linkid", "creative", "creativeasin", "camp", "awc", "smid", "psc", "th", "gclid", "fbclid", "msclkid", "wt_mc", "wt.mc_id", "emid", "affid", "affiliate", "partner", "pid", "clickref", "srsltid"];
    var PORTALS = ["mydealz.de", "hardwaredealz.com", "geizhals.de", "geizhals.at", "geizhals.eu", "billiger.de", "idealo.de", "guenstiger.de", "preisvergleich.heise.de"];
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
      [/otto\b/i, "OTTO", "https://www.otto.de/suche/"],
      [/ebay/i, "eBay", "https://www.ebay.de/sch/i.html?_nkw="]
    ];
    function safeUrl(u) { try { var x = new URL(u); return (x.protocol === "https:" || x.protocol === "http:") ? x : null; } catch (e) { return null; } }
    function hostIs(h, dom) { h = h.replace(/^www\./, ""); return h === dom || h.slice(-(dom.length + 1)) === "." + dom; }
    function isPortal(url) { var u = safeUrl(url); return !!u && PORTALS.some(function (d) { return hostIs(u.hostname, d); }); }
    function affiliate(url) {
      var u = safeUrl(url); if (!u) return { href: "#", aff: false, shop: false };
      var A = CFG.affiliate || {};
      if (isPortal(u.toString())) return { href: u.toString(), aff: false, shop: false };
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
    function shopOf(name) { for (var i = 0; i < SHOPS.length; i++) if (SHOPS[i][0].test(name || "")) return SHOPS[i]; return null; }
    function shopName(name) { if (/geizhals|hardwaredealz|idealo|mydealz|günstigst/i.test(name || "")) return "Bestpreis im Netz"; var s = shopOf(name); return s ? s[1] : String(name || "Shop").replace(/^www\./, ""); }
    function cleanName(n) { return String(n || "").replace(/\([^)]*\)/g, " ").replace(/["„“]/g, " ").replace(/\s+/g, " ").trim(); }
    /* {href, label, aff, guess} für einen Shop-Knopf oder null */
    function shopLink(url, shop, name) {
      if (url && !isPortal(url)) { var l = affiliate(url); if (l.shop) return { href: l.href, aff: l.aff, label: shopOf(shop) ? "Zu " + shopOf(shop)[1] : "Zum Shop", guess: false }; }
      var s = shopOf(shop); if (!s) return null;
      var q = encodeURIComponent(cleanName(name)), l2 = affiliate(s[2] + q);
      return { href: l2.href, aff: l2.aff, label: "Zu " + s[1], guess: true };
    }
    function fallbackLink(name) { var l = affiliate("https://www.amazon.de/s?k=" + encodeURIComponent(cleanName(name))); return { href: l.href, aff: l.aff, label: "Bei Amazon suchen", guess: true }; }
    function relOf(l) { return l.aff ? "sponsored nofollow noopener" : "nofollow noopener"; }
    /* bester Link für ein Katalogprodukt: günstigstes Angebot mit Link, sonst Shop-Suche, sonst Amazon-Suche */
    function productLink(p) {
      var offers = (p.offers || []).slice().sort(function (a, b) { return a.price - b.price; });
      for (var i = 0; i < offers.length; i++) { var l = shopLink(offers[i].url, offers[i].shop, p.name); if (l) return l; }
      return shopLink(p.url, p.shop, p.name) || fallbackLink(p.name);
    }
    return { safeUrl: safeUrl, hostIs: hostIs, isPortal: isPortal, affiliate: affiliate, shopOf: shopOf, shopName: shopName, cleanName: cleanName, shopLink: shopLink, fallbackLink: fallbackLink, relOf: relOf, productLink: productLink };
  }
  if (typeof module === "object" && module.exports) module.exports = make;
  else root.HRLinks = make(root.HR_CONFIG);
})(typeof window !== "undefined" ? window : this);
