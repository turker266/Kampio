// Vercel Serverless Function — Altın ve döviz verisini sunucu tarafında çeker.
// Öncelik: Turkiye'ye ozel gercek piyasa (Truncgil). Basarisiz olursa,
// SABİT bir rakam yerine CANLI bir yedek kaynaktan (Yahoo Finance ons altın + canlı kur) hesaplar.

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=180");

  let usdTRY = null, eurTRY = null, gbpTRY = null, gramTRY = null, ceyrekTRYDirect = null, yarimTRYDirect = null, tamTRYDirect = null, source = "";

  // 1) Doviz kurlari (ucretsiz, anahtarsiz)
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await r.json();
    if (data.result === "success") {
      usdTRY = data.rates.TRY;
      eurTRY = data.rates.TRY / data.rates.EUR;
      gbpTRY = data.rates.TRY / data.rates.GBP;
    }
  } catch (e) {}

  // 2) Turkiye gercek piyasa altin fiyati (Truncgil)
  try {
    const tr = await fetch("https://finans.truncgil.com/v3/today.json");
    const tdata = await tr.json();

    function parseNum(v) {
      if (v === undefined || v === null) return null;
      const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? null : n;
    }
    function findEntry(obj, candidates) {
      for (const k of candidates) if (obj[k]) return obj[k];
      for (const k in obj) {
        const lower = k.toLowerCase();
        if (candidates.some(c => lower.includes(c.toLowerCase().replace(/[^a-z]/gi, "")))) {
          if (obj[k] && typeof obj[k] === "object") return obj[k];
        }
      }
      return null;
    }

    const goldEntry = findEntry(tdata, ["Gram Altın", "GRA", "gram-altin", "GramAltin", "gram_altin", "gram"]);
    if (goldEntry) {
      const sell = goldEntry["Satış"] ?? goldEntry.Selling ?? goldEntry.satis ?? goldEntry.sell ?? goldEntry.Sell;
      const parsed = parseNum(sell);
      if (parsed && parsed > 1000 && parsed < 50000) { gramTRY = parsed; source = "truncgil"; }
    }

    const ceyrekEntry = findEntry(tdata, ["Çeyrek Altın", "CEYREK", "ceyrek-altin", "CeyrekAltin", "ceyrek_altin", "ceyrek"]);
    if (ceyrekEntry) {
      const sell = ceyrekEntry["Satış"] ?? ceyrekEntry.Selling ?? ceyrekEntry.satis ?? ceyrekEntry.sell ?? ceyrekEntry.Sell;
      const parsed = parseNum(sell);
      if (parsed && parsed > 1000 && parsed < 100000) { ceyrekTRYDirect = parsed; }
    }

    const yarimEntry = findEntry(tdata, ["Yarım Altın", "YARIM", "yarim-altin", "YarimAltin", "yarim_altin", "yarim"]);
    if (yarimEntry) {
      const sell = yarimEntry["Satış"] ?? yarimEntry.Selling ?? yarimEntry.satis ?? yarimEntry.sell ?? yarimEntry.Sell;
      const parsed = parseNum(sell);
      if (parsed && parsed > 2000 && parsed < 200000) { yarimTRYDirect = parsed; }
    }

    const tamEntry = findEntry(tdata, ["Tam Altın", "TAM", "tam-altin", "TamAltin", "tam_altin", "Cumhuriyet Altını", "cumhuriyet"]);
    if (tamEntry) {
      const sell = tamEntry["Satış"] ?? tamEntry.Selling ?? tamEntry.satis ?? tamEntry.sell ?? tamEntry.Sell;
      const parsed = parseNum(sell);
      if (parsed && parsed > 5000 && parsed < 500000) { tamTRYDirect = parsed; }
    }

    // Truncgil'den USD kuru da alinabiliyorsa (daha isabetli olabilir), onu tercih et
    const usdEntry = tdata["USD"] || tdata["Amerikan Doları"];
    if (usdEntry) {
      const sell = parseNum(usdEntry["Satış"] ?? usdEntry.Selling ?? usdEntry.sell);
      if (sell && sell > 10 && sell < 100) usdTRY = sell;
    }
  } catch (e) {}

  // 3) Truncgil basarisiz olduysa: SABİT sayi yerine CANLI yedek (Yahoo Finance ons altin)
  if (!gramTRY) {
    try {
      const gr = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const gdata = await gr.json();
      const ouncePriceUSD = gdata?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (ouncePriceUSD && usdTRY) {
        gramTRY = (ouncePriceUSD / 31.1035) * usdTRY;
        source = "yahoo-live-fallback";
      }
    } catch (e) {}
  }

  // Her iki kaynak da basarisiz olursa (cok nadir), en azindan hata donduralim, sessizce yanlis rakam vermeyelim
  if (!usdTRY) usdTRY = null;
  if (!gramTRY) gramTRY = null;

  const ceyrekTRY = ceyrekTRYDirect || (gramTRY ? gramTRY * 1.755 : null);
  const yarimTRY = yarimTRYDirect || (gramTRY ? gramTRY * 3.51 : null);
  const tamTRY = tamTRYDirect || (gramTRY ? gramTRY * 7.02 : null);
  const onsUSD = (gramTRY && usdTRY) ? (gramTRY / usdTRY) * 31.1035 : null;

  return res.status(200).json({
    usdTRY, eurTRY, gbpTRY, gramTRY, ceyrekTRY, yarimTRY, tamTRY, onsUSD,
    source, updatedAt: new Date().toISOString()
  });
}
