// Kampio — Cloudflare Worker
// - /api/gold, /api/bist100          : piyasa verisi (Vercel'deki fonksiyonların aynısı)
// - /api/send-welcome-email          : kayıt sonrası hoş geldin e-postası
// - /api/check-reminders             : emekli promosyonu hatırlatmaları (HTTP: yalnızca CRON_SECRET ile; ayrıca günlük cron)
// Diğer bütün istekleri (sayfalar, görseller) Cloudflare statik dosya servisi karşılar; bu kod çalışmaz.
//
// Gizli anahtarlar Cloudflare panelinde Variables and Secrets bölümünde tanımlanır:
//   RESEND_API_KEY, SUPABASE_SERVICE_KEY, CRON_SECRET (ve isteğe bağlı SUPABASE_ANON_KEY)

const SUPABASE_URL = "https://yvykqkzkwyhodqzqehcy.supabase.co";
// Genel (anon) anahtar zaten istemci kodunda açıktır.
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eWtxa3prd3lob2RxenFlaGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTA4NjEsImV4cCI6MjA5Nzg2Njg2MX0.ePq1ETtQiZgB5lu79n3o8FJ9JsQTEFXSQ_D9AsqVMJs";

const ALLOWED_ORIGINS = ["https://www.kampio.com.tr", "https://kampio.com.tr"];
const PREVIEW_ORIGIN = /^https:\/\/kampio\.[a-z0-9-]+\.workers\.dev$/; // deneme adresi
const MAX_ACCOUNT_AGE_MS = 60 * 60 * 1000;


// Supabase yeni "sb_secret_" anahtarları JWT değildir: yalnızca apikey olarak gider.
// Eski JWT (eyJ...) service_role anahtarı ise her iki başlıkla da çalışır.
function sbKeyHeaders(key) {
  return key && key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function originAllowed(origin) {
  return !!origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin));
}

// Cloudflare edge önbelleği: Vercel'deki s-maxage yerine
async function cached(request, ctx, ttlSeconds, producer) {
  const cache = caches.default;
  const key = new Request(new URL(request.url).origin + new URL(request.url).pathname + "?__c=1", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await producer();
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", `public, max-age=${Math.min(ttlSeconds, 60)}, s-maxage=${ttlSeconds}`);
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

/* ───────────────────────── /api/bist100 ───────────────────────── */
async function bist100() {
  const cors = { "Access-Control-Allow-Origin": "*" };
  try {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const data = await r.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number") return json({ value: price, source: "yahoo" }, 200, cors);
    throw new Error("Fiyat bulunamadı");
  } catch (e) {
    return json({ value: 14455, source: "fallback" }, 200, cors);
  }
}

/* ───────────────────────── /api/gold ───────────────────────── */
function parseNum(v) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}
function findEntry(obj, candidates) {
  for (const k of candidates) if (obj[k]) return obj[k];
  for (const k in obj) {
    const lower = k.toLowerCase();
    if (candidates.some((c) => lower.includes(c.toLowerCase().replace(/[^a-z]/gi, "")))) {
      if (obj[k] && typeof obj[k] === "object") return obj[k];
    }
  }
  return null;
}
function sellOf(entry) {
  return entry["Satış"] ?? entry.Selling ?? entry.satis ?? entry.sell ?? entry.Sell;
}

async function gold() {
  let usdTRY = null, eurTRY = null, gbpTRY = null, gramTRY = null;
  let ceyrekTRYDirect = null, yarimTRYDirect = null, tamTRYDirect = null, source = "";

  // 1) Döviz kurları
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await r.json();
    if (data.result === "success") {
      usdTRY = data.rates.TRY;
      eurTRY = data.rates.TRY / data.rates.EUR;
      gbpTRY = data.rates.TRY / data.rates.GBP;
    }
  } catch (e) {}

  // 2) Türkiye piyasası altın fiyatı (Truncgil)
  try {
    const tr = await fetch("https://finans.truncgil.com/v3/today.json");
    const tdata = await tr.json();

    const goldEntry = findEntry(tdata, ["Gram Altın", "GRA", "gram-altin", "GramAltin", "gram_altin", "gram"]);
    if (goldEntry) {
      const parsed = parseNum(sellOf(goldEntry));
      if (parsed && parsed > 1000 && parsed < 50000) { gramTRY = parsed; source = "truncgil"; }
    }
    const ceyrekEntry = findEntry(tdata, ["Çeyrek Altın", "CEYREK", "ceyrek-altin", "CeyrekAltin", "ceyrek_altin", "ceyrek"]);
    if (ceyrekEntry) {
      const parsed = parseNum(sellOf(ceyrekEntry));
      if (parsed && parsed > 1000 && parsed < 100000) ceyrekTRYDirect = parsed;
    }
    const yarimEntry = findEntry(tdata, ["Yarım Altın", "YARIM", "yarim-altin", "YarimAltin", "yarim_altin", "yarim"]);
    if (yarimEntry) {
      const parsed = parseNum(sellOf(yarimEntry));
      if (parsed && parsed > 2000 && parsed < 200000) yarimTRYDirect = parsed;
    }
    const tamEntry = findEntry(tdata, ["Tam Altın", "TAM", "tam-altin", "TamAltin", "tam_altin", "Cumhuriyet Altını", "cumhuriyet"]);
    if (tamEntry) {
      const parsed = parseNum(sellOf(tamEntry));
      if (parsed && parsed > 5000 && parsed < 500000) tamTRYDirect = parsed;
    }
    const usdEntry = tdata["USD"] || tdata["Amerikan Doları"];
    if (usdEntry) {
      const sell = parseNum(sellOf(usdEntry));
      if (sell && sell > 10 && sell < 100) usdTRY = sell;
    }
  } catch (e) {}

  // 3) Truncgil olmazsa canlı yedek: Yahoo ons altın
  if (!gramTRY) {
    try {
      const gr = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/GC=F", {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const gdata = await gr.json();
      const ouncePriceUSD = gdata?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (ouncePriceUSD && usdTRY) {
        gramTRY = (ouncePriceUSD / 31.1035) * usdTRY;
        source = "yahoo-live-fallback";
      }
    } catch (e) {}
  }

  const ceyrekTRY = ceyrekTRYDirect || (gramTRY ? gramTRY * 1.755 : null);
  const yarimTRY = yarimTRYDirect || (gramTRY ? gramTRY * 3.51 : null);
  const tamTRY = tamTRYDirect || (gramTRY ? gramTRY * 7.02 : null);
  const onsUSD = gramTRY && usdTRY ? (gramTRY / usdTRY) * 31.1035 : null;

  return json(
    { usdTRY, eurTRY, gbpTRY, gramTRY, ceyrekTRY, yarimTRY, tamTRY, onsUSD, source, updatedAt: new Date().toISOString() },
    200,
    { "Access-Control-Allow-Origin": "*" }
  );
}

/* ───────────────────────── /api/send-welcome-email ───────────────────────── */
const log = (msg) => console.log("[welcome-email] " + msg);

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildWelcomeHtml(activeCount, topCampaigns) {
  const rows = topCampaigns.map((c) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb">
          <strong style="color:#084c41">${esc(c.bank)}</strong><br>
          <span style="font-size:14px;color:#374151">${esc(c.title)}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right">
          <span style="background:#fff7e6;color:#9a5b00;padding:4px 10px;border-radius:6px;font-weight:700;font-size:13px">${esc(c.reward_label)}</span>
        </td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7faf9;font-family:Inter,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#0f6b5b;padding:36px 40px;text-align:center">
      <div style="margin-bottom:16px"><span style="color:white;font-size:24px;font-weight:900;letter-spacing:-0.5px">Kampio</span></div>
      <h1 style="color:white;font-size:26px;font-weight:900;margin:0 0 8px;letter-spacing:-0.5px">Hoş geldin! 🎉</h1>
      <p style="color:rgba(255,255,255,0.75);margin:0;font-size:15px">Kredi kartı kampanyalarını takip etmeye hazırsın.</p>
    </div>
    <div style="padding:36px 40px">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
        Merhaba! Kampio'ya kayıt olduğun için teşekkürler. Şu an <strong style="color:#084c41">${Number(activeCount) || 0} aktif kampanya</strong> seni bekliyor.
      </p>
      ${rows ? `<h2 style="color:#084c41;font-size:17px;font-weight:800;margin:0 0 16px">🏆 Bu haftanın en iyi kampanyaları</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">${rows}</table>` : ""}
      <div style="margin:28px 0;text-align:center">
        <a href="https://www.kampio.com.tr" style="display:inline-block;background:#0f6b5b;color:white;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Tüm Kampanyaları Gör →</a>
      </div>
      <div style="background:#e7f5f1;border-radius:10px;padding:18px 20px;margin-top:8px">
        <p style="margin:0;font-size:13px;color:#084c41;font-weight:600">💡 <strong>İpucu:</strong> "Yakında Bitenler" filtresini kullanarak son günlerindeki kampanyaları kaçırmadan faydalanabilirsin.</p>
      </div>
    </div>
    <div style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0">© 2026 Kampio · <a href="https://www.kampio.com.tr" style="color:#0f6b5b">kampio.com.tr</a></p>
    </div>
  </div>
</body>
</html>`;
}

async function welcomeEmail(request, env) {
  const origin = request.headers.get("Origin");
  const cors = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (originAllowed(origin)) { cors["Access-Control-Allow-Origin"] = origin; cors["Vary"] = "Origin"; }

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  // Sağlık kontrolü: yalnızca anahtarların tanımlı olup olmadığını (evet/hayır) gösterir.
  if (request.method === "GET" && url.searchParams.get("check")) {
    return json({
      endpoint: "calisiyor",
      RESEND_API_KEY: !!env.RESEND_API_KEY,
      SUPABASE_SERVICE_KEY: !!env.SUPABASE_SERVICE_KEY,
    }, 200, cors);
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
  if (origin && !originAllowed(origin)) { log("reddedildi: izin verilmeyen kaynak " + origin); return json({ error: "İzin verilmeyen kaynak" }, 403, cors); }

  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) { log("HATA: RESEND_API_KEY tanımlı değil"); return json({ error: "Sunucu yapılandırma hatası" }, 500, cors); }

  const ANON = env.SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  // 1) Kimlik doğrulama
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) { log("reddedildi: Authorization başlığı yok"); return json({ error: "Oturum gerekli" }, 401, cors); }

  let user;
  try {
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!ur.ok) { log("reddedildi: Supabase oturumu doğrulamadı (HTTP " + ur.status + ")"); return json({ error: "Geçersiz oturum" }, 401, cors); }
    user = await ur.json();
  } catch (e) {
    log("HATA: Supabase kullanıcı sorgusu başarısız: " + e);
    return json({ error: "Kimlik doğrulanamadı" }, 502, cors);
  }

  const email = user && typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Geçersiz e-posta" }, 400, cors);

  // 2) Sadece yeni açılmış hesaplara gönder
  const created = Date.parse(user.email_confirmed_at || user.confirmed_at || user.created_at || "");
  if (!created || Date.now() - created > MAX_ACCOUNT_AGE_MS) {
    log("atlandı: hesap yeni değil (" + email + ")");
    return json({ skipped: "hesap yeni değil" }, 200, cors);
  }

  // 3) Aynı adrese ikinci kez gönderme
  const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const logHeaders = SERVICE_KEY
    ? sbKeyHeaders(SERVICE_KEY)
    : { apikey: ANON, Authorization: `Bearer ${token}` };
  try {
    if (SERVICE_KEY) {
      const lr = await fetch(
        `${SUPABASE_URL}/rest/v1/email_logs?email=eq.${encodeURIComponent(email)}&type=eq.welcome&select=email&limit=1`,
        { headers: logHeaders }
      );
      if (lr.ok) {
        const rows = await lr.json();
        if (Array.isArray(rows) && rows.length > 0) { log("atlandı: email_logs'ta zaten kayıt var (" + email + ")"); return json({ skipped: "zaten gönderildi" }, 200, cors); }
      }
    }
  } catch (e) { /* log kontrolü başarısızsa süre penceresi yine korur */ }

  // 4) Güncel kampanyalar
  let activeCount = 0, top = [];
  try {
    const cr = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?is_active=eq.true&select=bank,title,reward_label,reward_value&order=reward_value.desc`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }
    );
    if (cr.ok) { const all = await cr.json(); activeCount = all.length; top = all.slice(0, 3); }
  } catch (e) { /* kampanyasız da gönderilebilir */ }

  // 5) Gönder
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Kampio <bildirim@kampio.com.tr>",
        to: email,
        subject: "Kampio'ya hoş geldin! 🎉 Kampanyalar seni bekliyor",
        html: buildWelcomeHtml(activeCount, top),
      }),
    });
    if (!r.ok) {
      let detail = ""; try { detail = await r.text(); } catch (e) {}
      log("HATA: Resend reddetti (HTTP " + r.status + "): " + detail.slice(0, 300));
      return json({ error: "E-posta gönderilemedi" }, 502, cors);
    }
  } catch (e) {
    log("HATA: Resend isteği başarısız: " + e);
    return json({ error: "E-posta gönderilemedi" }, 502, cors);
  }

  // 6) Gönderimi kaydet (en iyi çaba)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
      method: "POST",
      headers: { ...logHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email, type: "welcome" }),
    });
  } catch (e) {}

  log("gönderildi: " + email);
  return json({ ok: true }, 200, cors);
}

/* ───────────────────────── check-reminders ───────────────────────── */
async function runReminders(env) {
  const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!SERVICE_KEY || !RESEND_API_KEY) {
    return { status: 500, body: { error: "Sunucu yapılandırma hatası: gerekli anahtarlar tanımlı değil" } };
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reminders?aktif=eq.true&select=*`, {
      headers: sbKeyHeaders(SERVICE_KEY),
    });
    const reminders = await r.json();
    if (!Array.isArray(reminders)) throw new Error("reminders okunamadı: " + JSON.stringify(reminders).slice(0, 200));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let gonderilenMail = 0;

    for (const item of reminders) {
      const bitis = new Date(item.bitis_tarihi);
      bitis.setHours(0, 0, 0, 0);
      const gunFark = Math.round((bitis - today) / (1000 * 60 * 60 * 24));

      let asama = null;
      if (gunFark === 90 && !item.bildirim_3ay_gonderildi) asama = "3ay";
      else if (gunFark === 30 && !item.bildirim_1ay_gonderildi) asama = "1ay";
      else if (gunFark === 7 && !item.bildirim_1hafta_gonderildi) asama = "1hafta";
      if (!asama) continue;

      const baslik = asama === "3ay" ? "3 ay kaldı" : asama === "1ay" ? "1 ay kaldı" : "1 hafta kaldı";
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#182522">
          <h2 style="color:#084c41">Emekli Promosyonu Hatırlatması</h2>
          <p><b>${esc(item.banka)}</b> bankasındaki promosyon taahhüdünün <b>${baslik}</b>!</p>
          <p>Bitiş tarihi: <b>${bitis.toLocaleDateString("tr-TR")}</b></p>
          <p>Güncel en yüksek promosyon tekliflerini karşılaştırmak için:</p>
          <p><a href="https://www.kampio.com.tr/emekli.html#promo" style="background:#0f6b5b;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Promosyonları Karşılaştır →</a></p>
          <p style="font-size:12px;color:#66736f;margin-top:24px">Bu bilgilendirme mailidir. Artık almak istemiyorsan bu maili yanıtlayarak bize bildirebilirsin.</p>
        </div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Kampio <bildirim@kampio.com.tr>",
          to: item.email,
          subject: `Emekli Promosyonu Hatırlatması — ${baslik}`,
          html,
        }),
      });

      const guncelleme = {};
      if (asama === "3ay") guncelleme.bildirim_3ay_gonderildi = true;
      if (asama === "1ay") guncelleme.bildirim_1ay_gonderildi = true;
      if (asama === "1hafta") guncelleme.bildirim_1hafta_gonderildi = true;

      await fetch(`${SUPABASE_URL}/rest/v1/reminders?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          ...sbKeyHeaders(SERVICE_KEY),
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(guncelleme),
      });

      gonderilenMail++;
    }

    return { status: 200, body: { ok: true, kontrolEdilenKayit: reminders.length, gonderilenMail } };
  } catch (e) {
    return { status: 500, body: { error: "Hata oluştu", detail: String(e) } };
  }
}

/* ───────────────────────── Giriş noktası ───────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    // Ana sayfa: html_handling "none" olduğu için "/" otomatik index.html'e gitmez, burada yönlendiriyoruz.
    if (path === "" && (request.method === "GET" || request.method === "HEAD")) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    if (path === "/api/gold" && request.method === "GET") return cached(request, ctx, 90, gold);
    if (path === "/api/bist100" && request.method === "GET") return cached(request, ctx, 120, bist100);
    if (path === "/api/send-welcome-email") return welcomeEmail(request, env);

    if (path === "/api/check-reminders") {
      // HTTP ile elle çalıştırmak için CRON_SECRET zorunlu; tanımlı değilse kapalı.
      const secret = env.CRON_SECRET;
      if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
        return json({ error: "Yetkisiz erişim" }, 401);
      }
      const out = await runReminders(env);
      return json(out.body, out.status);
    }

    return json({ error: "Bulunamadı" }, 404);
  },

  // Günlük zamanlanmış görev (wrangler.jsonc > triggers.crons)
  async scheduled(event, env, ctx) {
    const out = await runReminders(env);
    console.log("[check-reminders] " + out.status + " " + JSON.stringify(out.body));
  },
};
