// Vercel Serverless Function — Resend e-postalarını sunucu tarafında gonderir.
// API anahtarı burada, Vercel Environment Variable olarak saklanır (process.env).
// Tarayıcı koduna hiçbir zaman düşmez, bu yüzden GitHub'da sızma riski yoktur.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Eksik alan: to, subject, html gerekli" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: "Sunucu yapılandırma hatası: RESEND_API_KEY tanımlı değil" });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: "Kampio <onboarding@resend.dev>", to, subject, html })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "E-posta gönderilemedi", detail: String(e) });
  }
}
