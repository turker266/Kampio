// Vercel Serverless Function — Altın ve döviz verisini sunucu tarafında çeker.
// Öncelik: Turkiye'ye ozel gercek piyasa (Truncgil). Basarisiz olursa,
// SABİT bir rakam yerine CANLI bir yedek kaynaktan (Yahoo Finance ons altın + canlı kur) hesaplar.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=180");

  let usdTRY = null, eurTRY = null, gbpTRY = null, gramTRY = null, source = "";

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

  const ceyrekTRY = gramTRY ? gramTRY * 1.755 : null;

  return res.status(200).json({
    usdTRY, eurTRY, gbpTRY, gramTRY, ceyrekTRY,
    source, updatedAt: new Date().toISOString()
  });
}
