// Vercel Serverless Function — kayıt olan kullanıcıya hoş geldin e-postası gönderir.
//
// GÜVENLİK: Bu endpoint artık serbest "to / subject / html" kabul etmez.
//  - Çağıran, Supabase oturum anahtarı (access_token) ile kimliğini kanıtlamak zorundadır.
//  - E-posta SADECE o kullanıcının kendi adresine, sunucudaki sabit şablonla gider.
//  - Hesap 60 dakikadan eskiyse veya daha önce hoş geldin maili gittiyse gönderilmez.
//  - CORS yalnızca kampio.com.tr alan adlarına açıktır.
// API anahtarları Vercel Environment Variables'tan okunur (RESEND_API_KEY, SUPABASE_SERVICE_KEY).

const SUPABASE_URL = "https://yvykqkzkwyhodqzqehcy.supabase.co";
// Genel (anon) anahtar zaten istemci kodunda açıktır; istersen Vercel'de SUPABASE_ANON_KEY olarak da tanımlayabilirsin.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eWtxa3prd3lob2RxenFlaGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTA4NjEsImV4cCI6MjA5Nzg2Njg2MX0.ePq1ETtQiZgB5lu79n3o8FJ9JsQTEFXSQ_D9AsqVMJs";

const ALLOWED_ORIGINS = ["https://www.kampio.com.tr", "https://kampio.com.tr", "https://kampio.vercel.app"];
const MAX_ACCOUNT_AGE_MS = 60 * 60 * 1000;

// Vercel > Project > Logs ekranında "welcome-email" diye aratarak her denemenin sonucunu görebilirsin.
function log(msg) { console.log("[welcome-email] " + msg); }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildHtml(activeCount, topCampaigns) {
  const rows = topCampaigns.map(c => `
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

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  // Sağlık kontrolü: tarayıcıdan /api/send-welcome-email?check=1 açılırsa yalnızca anahtarların tanımlı olup olmadığını (evet/hayır) gösterir.
  if (req.method === "GET" && req.query && req.query.check) {
    return res.status(200).json({
      endpoint: "calisiyor",
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (origin && !ALLOWED_ORIGINS.includes(origin)) { log("reddedildi: izin verilmeyen kaynak " + origin); return res.status(403).json({ error: "İzin verilmeyen kaynak" }); }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) { log("HATA: RESEND_API_KEY tanımlı değil"); return res.status(500).json({ error: "Sunucu yapılandırma hatası" }); }

  // 1) Kimlik doğrulama: Supabase oturum anahtarını doğrula
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) { log("reddedildi: Authorization başlığı yok"); return res.status(401).json({ error: "Oturum gerekli" }); }

  let user;
  try {
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!ur.ok) { log("reddedildi: Supabase oturumu doğrulamadı (HTTP " + ur.status + ")"); return res.status(401).json({ error: "Geçersiz oturum" }); }
    user = await ur.json();
  } catch (e) {
    log("HATA: Supabase kullanıcı sorgusu başarısız: " + e);
    return res.status(502).json({ error: "Kimlik doğrulanamadı" });
  }

  const email = user && typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Geçersiz e-posta" });

  // 2) Sadece yeni açılmış hesaplara gönder
  // E-posta doğrulaması açıksa sayaç doğrulama anından başlar (kullanıcı linke geç tıklayabilir).
  const created = Date.parse(user.email_confirmed_at || user.confirmed_at || user.created_at || "");
  if (!created || Date.now() - created > MAX_ACCOUNT_AGE_MS) {
    log("atlandı: hesap yeni değil (" + email + ")");
    return res.status(200).json({ skipped: "hesap yeni değil" });
  }

  // 3) Aynı adrese ikinci kez gönderme
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const logHeaders = SERVICE_KEY
    ? { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    : { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  try {
    if (SERVICE_KEY) {
      const lr = await fetch(
        `${SUPABASE_URL}/rest/v1/email_logs?email=eq.${encodeURIComponent(email)}&type=eq.welcome&select=email&limit=1`,
        { headers: logHeaders }
      );
      if (lr.ok) {
        const rows = await lr.json();
        if (Array.isArray(rows) && rows.length > 0) { log("atlandı: email_logs'ta zaten kayıt var (" + email + ")"); return res.status(200).json({ skipped: "zaten gönderildi" }); }
      }
    }
  } catch (e) { /* log kontrolü başarısızsa 15 dk pencere yine korur */ }

  // 4) Güncel kampanyaları sunucudan çek
  let activeCount = 0, top = [];
  try {
    const cr = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?is_active=eq.true&select=bank,title,reward_label,reward_value&order=reward_value.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (cr.ok) { const all = await cr.json(); activeCount = all.length; top = all.slice(0, 3); }
  } catch (e) { /* kampanyasız da gönderilebilir */ }

  // 5) Gönder (alıcı sadece doğrulanmış kullanıcının kendi adresi)
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Kampio <bildirim@kampio.com.tr>",
        to: email,
        subject: "Kampio'ya hoş geldin! 🎉 Kampanyalar seni bekliyor",
        html: buildHtml(activeCount, top)
      })
    });
    if (!r.ok) {
      let detail = ""; try { detail = await r.text(); } catch (e) {}
      log("HATA: Resend reddetti (HTTP " + r.status + "): " + detail.slice(0, 300));
      return res.status(502).json({ error: "E-posta gönderilemedi" });
    }
  } catch (e) {
    log("HATA: Resend isteği başarısız: " + e);
    return res.status(502).json({ error: "E-posta gönderilemedi" });
  }

  // 6) Gönderimi kaydet (en iyi çaba)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/email_logs`, {
      method: "POST",
      headers: { ...logHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email, type: "welcome" })
    });
  } catch (e) {}

  log("gönderildi: " + email);
  return res.status(200).json({ ok: true });
};
