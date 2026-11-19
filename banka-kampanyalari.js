/* Kampio — banka sayfalarında canlı kampanya listesi
 * Veri: Supabase `campaigns` tablosu (ana sayfadaki kampanyalarla aynı kaynak).
 * Süresi geçen ya da pasif kampanyalar otomatik gösterilmez.
 * Kullanım: <div class="campaign-list" id="bankCampaigns" data-bank="akbank"> + bu dosya.
 */
(function () {
  "use strict";
  var URL_ = "https://yvykqkzkwyhodqzqehcy.supabase.co";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eWtxa3prd3lob2RxenFlaGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyOTA4NjEsImV4cCI6MjA5Nzg2Njg2MX0.ePq1ETtQiZgB5lu79n3o8FJ9JsQTEFXSQ_D9AsqVMJs";
  var box = document.getElementById("bankCampaigns");
  if (!box) return;
  var want = (box.getAttribute("data-bank") || "").toLowerCase();

  function norm(s) {
    return String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
      .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function fmt(d) {
    var p = String(d).split("-");
    return parseInt(p[2], 10) + " " + MONTHS[parseInt(p[1], 10) - 1] + " " + p[0];
  }
  function todayStr() {
    var n = new Date();
    return n.getFullYear() + "-" + ("0" + (n.getMonth() + 1)).slice(-2) + "-" + ("0" + n.getDate()).slice(-2);
  }
  function daysLeft(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((new Date(d + "T00:00:00") - t) / 86400000);
  }
  function setStat(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  function card(c) {
    var left = daysLeft(c.end_date);
    var leftTxt = left <= 0 ? "Bugün bitiyor" : left === 1 ? "Yarın bitiyor" : left + " gün kaldı";
    var terms = String(c.terms || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var link = /^https?:\/\//i.test(c.source_url || "") ? c.source_url : "";
    return '<div class="campaign-card">' +
      '<div class="campaign-card-top"><h2>' + esc(c.title) + "</h2>" +
      (c.reward_label ? '<span class="reward-badge">' + esc(c.reward_label) + "</span>" : "") + "</div>" +
      "<p>" + esc(c.short_description || c.full_description || "") + "</p>" +
      '<div class="campaign-meta">' +
      (c.category ? '<span class="meta-tag">' + esc(c.category) + "</span>" : "") +
      '<span class="meta-tag red">Son: ' + esc(fmt(c.end_date)) + " · " + leftTxt + "</span></div>" +
      (terms.length ? '<ul class="terms-list">' + terms.slice(0, 5).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (link ? '<a class="campaign-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Resmi kampanya sayfası →</a>' : "") +
      "</div>";
  }

  function empty(msg) {
    box.innerHTML = '<div class="campaign-card"><p style="margin:0">' + msg +
      ' Tüm bankaların güncel kampanyalarını <a href="/" style="color:#0f6b5b;font-weight:700">ana sayfada</a> karşılaştırabilirsiniz.</p></div>';
  }

  var q = URL_ + "/rest/v1/campaigns?is_active=eq.true&end_date=gte." + todayStr() +
    "&select=id,title,bank,category,reward_label,end_date,short_description,full_description,terms,source_url&order=end_date.asc&limit=200";
  fetch(q, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (rows) {
      var list = rows.filter(function (c) { return norm(c.bank).indexOf(want) !== -1; });
      setStat("bkCount", String(list.length));
      if (!list.length) {
        setStat("bkNext", "—");
        return empty("Şu an bu banka için listelenen aktif kampanya bulunmuyor.");
      }
      setStat("bkNext", fmt(list[0].end_date).replace(/ \d{4}$/, ""));
      box.innerHTML = list.map(card).join("");
    })
    .catch(function () {
      setStat("bkCount", "—"); setStat("bkNext", "—");
      empty("Kampanyalar şu an yüklenemedi.");
    });
})();
