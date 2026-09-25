// Vercel Cron Function — Supabase'deki "reminders" tablosunu her gün kontrol eder.
// Bitiş tarihine 3 ay / 1 ay / 1 hafta kalanlara Resend üzerinden otomatik mail atar.
// Bu dosya kod tarafında GitHub'a eklenir, secret anahtarlar Vercel Environment Variables'tan okunur.

const SUPABASE_URL = "https://yvykqkzkwyhodqzqehcy.supabase.co";

module.exports = async (req, res) => {
  // Güvenlik: eğer CRON_SECRET tanımlıysa, sadece Vercel Cron'un kendisi çalıştırabilsin
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: "Yetkisiz erişim" });
    }
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!SERVICE_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: "Sunucu yapılandırma hatası: gerekli anahtarlar tanımlı değil" });
  }

  try {
    // Aktif tüm hatırlatma kayıtlarını çek
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reminders?aktif=eq.true&select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });
    const reminders = await r.json();

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
          <p><b>${item.banka}</b> bankasındaki promosyon taahhüdünün <b>${baslik}</b>!</p>
          <p>Bitiş tarihi: <b>${bitis.toLocaleDateString("tr-TR")}</b></p>
          <p>Güncel en yüksek promosyon tekliflerini karşılaştırmak için:</p>
          <p><a href="https://www.kampio.com.tr/emekli.html#promo" style="background:#0f6b5b;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Promosyonları Karşılaştır →</a></p>
          <p style="font-size:12px;color:#66736f;margin-top:24px">Bu bilgilendirme mailidir. Artık almak istemiyorsan bu maili yanıtlayarak bize bildirebilirsin.</p>
        </div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Kampio <bildirim@kampio.com.tr>",
          to: item.email,
          subject: `Emekli Promosyonu Hatırlatması — ${baslik}`,
          html
        })
      });

      const guncelleme = {};
      if (asama === "3ay") guncelleme.bildirim_3ay_gonderildi = true;
      if (asama === "1ay") guncelleme.bildirim_1ay_gonderildi = true;
      if (asama === "1hafta") guncelleme.bildirim_1hafta_gonderildi = true;

      await fetch(`${SUPABASE_URL}/rest/v1/reminders?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(guncelleme)
      });

      gonderilenMail++;
    }

    return res.status(200).json({ ok: true, kontrolEdilenKayit: reminders.length, gonderilenMail });
  } catch (e) {
    return res.status(500).json({ error: "Hata oluştu", detail: String(e) });
  }
};
