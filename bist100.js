// Vercel Serverless Function — BIST 100 verisini sunucu tarafında çeker.
// Tarayıcıdan doğrudan çağrılmıyor, CORS sorunlarını önlemek için burada işleniyor.
// Ücretsiz, anahtar gerektirmeyen genel Yahoo Finance endpoint'i kullanılıyor.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");

  try {
    const r = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;

    if (typeof price === "number") {
      return res.status(200).json({ value: price, source: "yahoo" });
    }
    throw new Error("Fiyat bulunamadı");
  } catch (e) {
    // Yahoo başarısız olursa, makul bir yedek (fallback) değer döndür.
    return res.status(200).json({ value: 14455, source: "fallback" });
  }
}
