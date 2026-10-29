/* Hardware-Radar – Einstellungen
   Hier trägst du deine Werbe- und Affiliate-IDs ein. Alles andere musst du nicht anfassen. */
window.HR_CONFIG = {
  siteName: "Hardware-Radar",

  // Google AdSense: deine Publisher-ID, z. B. "ca-pub-1234567890123456". Leer = keine Werbung.
  adsenseClient: "",
  // Die Anzeigenblock-IDs aus deinem AdSense-Konto (Anzeigen > Nach Anzeigenblock).
  adSlots: {
    leaderboard: "",   // breiter Block unter den Top-Deals
    infeed: ""         // Block zwischen den Angebotskarten
  },
  // Nach wie vielen Karten ein Werbeblock im Raster erscheint.
  infeedEvery: 9,
  // Graue Platzhalter zeigen, solange keine AdSense-ID eingetragen ist (gut zum Testen, vor dem Start auf false).
  showAdPlaceholders: false,

  // Affiliate-Links: Direkte Shop-Links bekommen automatisch deine Partner-ID.
  affiliate: {
    // Amazon PartnerNet: deine Tracking-ID, z. B. "hardwareradar-21". Wird an amazon.de-Links angehängt.
    amazonTag: "",
    // AWIN: deine Publisher-ID (Zahl aus deinem AWIN-Konto).
    awinId: "3139071",
    // AWIN: pro Shop die Advertiser-ID, sobald dich der Shop freigeschaltet hat.
    // Schlüssel = Domain des Shops. Leere Einträge werden ignoriert. Weitere Shops einfach ergänzen.
    awinMerchants: {
      "mediamarkt.de": "",
      "saturn.de": "",
      "alternate.de": "",
      "notebooksbilliger.de": "",
      "cyberport.de": "",
      "galaxus.de": ""
    }
  },

  // Optional: Adresse deines eigenen KI-Endpunkts für den PC-Konfigurator (siehe tools/ai-worker/README.md).
  // Leer = der eingebaute Radar-Assistent antwortet (läuft im Browser, kostenlos, ohne Datenübertragung).
  aiEndpoint: "",

  // true = eingebautes Cookie-Banner. Wenn du stattdessen Googles eigenes Consent-Tool
  // ("Datenschutz und Mitteilungen" in AdSense) nutzt, auf false setzen.
  useBuiltinConsent: true
};
