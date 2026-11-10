/* Kompiter — Kampio'nun küçük asistanı
 * Hazır sorularla çalışır, serbest yazı ve yapay zekâ yok.
 * Kampanya verisi sayfadaki canlı `campaigns` listesinden okunur (yalnızca ana sayfada).
 * Başka sayfalara eklemek için: <script src="/kompiter.js" defer></script>
 */
(function () {
  "use strict";
  if (window.__kompiterLoaded) return;
  window.__kompiterLoaded = true;

  /* ───────── Yardımcılar ───────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function track(name, label) {
    try { if (typeof gtag === "function") gtag("event", name, { event_category: "kompiter", event_label: label }); } catch (e) {}
  }
  function store(get, key, val) {
    try { if (get) return sessionStorage.getItem(key); sessionStorage.setItem(key, val); } catch (e) {}
    return null;
  }
  var isHome = !!document.getElementById("appView") && typeof showView === "function";

  /* ───────── Ana sayfada #campaignSection linkini aç ───────── */
  function openCampaignSection() {
    try {
      if (isHome) {
        showView("app");
        setTimeout(function () {
          var el = document.getElementById("campaignSection");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 350);
      } else {
        location.href = "/#campaignSection";
      }
    } catch (e) { location.href = "/#campaignSection"; }
  }
  if (isHome && location.hash === "#campaignSection") {
    setTimeout(openCampaignSection, 400);
  }

  /* ───────── Robot (özgün çizim) ───────── */
  function robotSvg(cls) {
    return '<svg class="kp-robot ' + (cls || "") + '" viewBox="0 0 80 92" aria-hidden="true" focusable="false">' +
      '<g class="kp-float">' +
      '<line x1="40" y1="9" x2="40" y2="19" stroke="#0f6b5b" stroke-width="3" stroke-linecap="round"/>' +
      '<circle class="kp-ant" cx="40" cy="7" r="4.5" fill="#f59e0b"/>' +
      '<rect x="4" y="33" width="9" height="17" rx="4.5" fill="#084c41"/>' +
      '<rect x="67" y="33" width="9" height="17" rx="4.5" fill="#084c41"/>' +
      '<rect x="10" y="18" width="60" height="46" rx="17" fill="#0f6b5b"/>' +
      '<rect x="10" y="18" width="60" height="46" rx="17" fill="none" stroke="#1a8a76" stroke-width="2"/>' +
      '<rect x="17" y="26" width="46" height="31" rx="13" fill="#062f29"/>' +
      '<g class="kp-eyes"><ellipse cx="31" cy="40" rx="5" ry="6" fill="#fbbf24"/><ellipse cx="49" cy="40" rx="5" ry="6" fill="#fbbf24"/>' +
      '<circle cx="32.6" cy="38" r="1.6" fill="#fff" opacity=".85"/><circle cx="50.6" cy="38" r="1.6" fill="#fff" opacity=".85"/></g>' +
      '<path d="M34 50.5 q6 5 12 0" stroke="#fbbf24" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<rect x="21" y="67" width="38" height="21" rx="10" fill="#e7f5f1" stroke="#0f6b5b" stroke-width="2"/>' +
      '<circle cx="40" cy="77.5" r="6.5" fill="#0f6b5b"/>' +
      '<text x="40" y="80.6" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="9" fill="#fff">K</text>' +
      '<circle cx="15.5" cy="77" r="4.5" fill="#0f6b5b"/>' +
      '<circle class="kp-hand" cx="64.5" cy="77" r="4.5" fill="#0f6b5b"/>' +
      '</g></svg>';
  }

  /* ───────── Stil ───────── */
  var css = [
    ".kp-root{position:fixed;right:16px;bottom:16px;z-index:900;font-family:'Inter',system-ui,sans-serif;font-size:14px;line-height:1.45;color:#182522}",
    ".kp-root *{box-sizing:border-box}",
    ".kp-launcher{display:block;width:68px;height:78px;border:0;background:none;padding:0;cursor:pointer;filter:drop-shadow(0 8px 14px rgba(8,76,65,.28));-webkit-tap-highlight-color:transparent}",
    ".kp-launcher:focus-visible{outline:3px solid #f59e0b;outline-offset:3px;border-radius:16px}",
    ".kp-launcher:hover .kp-robot{transform:rotate(-5deg) scale(1.05)}",
    ".kp-robot{width:100%;height:100%;display:block;transition:transform .2s}",
    ".kp-float{animation:kpFloat 3.2s ease-in-out infinite}",
    ".kp-eyes{transform-box:fill-box;transform-origin:center;animation:kpBlink 5s infinite}",
    ".kp-ant{animation:kpAnt 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
    ".kp-hand{transform-box:fill-box;transform-origin:50% 100%}",
    ".kp-wave .kp-hand{animation:kpWave .7s ease-in-out 3}",
    "@keyframes kpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    "@keyframes kpBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}",
    "@keyframes kpAnt{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.65}}",
    "@keyframes kpWave{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}",
    ".kp-hello{position:absolute;right:72px;bottom:34px;background:#fff;border:1px solid #dbe8e4;border-radius:14px 14px 4px 14px;padding:10px 30px 10px 14px;box-shadow:0 10px 28px rgba(15,107,91,.18);font-weight:700;color:#084c41;width:max-content;max-width:210px;font-size:13px;opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity .25s,transform .25s}",
    ".kp-hello.kp-show{opacity:1;transform:none;pointer-events:auto;cursor:pointer}",
    ".kp-hello button{position:absolute;top:2px;right:4px;border:0;background:none;color:#8a958f;font-size:16px;cursor:pointer;padding:4px 6px;line-height:1}",
    ".kp-panel{position:absolute;right:0;bottom:84px;width:372px;max-width:calc(100vw - 24px);height:min(560px,calc(100vh - 116px));background:#fff;border:1px solid #dbe8e4;border-radius:18px;box-shadow:0 24px 60px rgba(8,76,65,.25);display:none;flex-direction:column;overflow:hidden}",
    ".kp-open .kp-panel{display:flex;animation:kpPop .22s ease-out}",
    "@keyframes kpPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}",
    ".kp-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0f6b5b,#084c41);color:#fff}",
    ".kp-head .kp-av{width:38px;height:44px;background:#e7f5f1;border-radius:12px;padding:2px 3px 0;flex-shrink:0}",
    ".kp-head .kp-av .kp-float,.kp-head .kp-av .kp-eyes,.kp-head .kp-av .kp-ant{animation:none}",
    ".kp-head b{display:block;font-size:15px;font-weight:900;letter-spacing:-.2px}",
    ".kp-head span{font-size:12px;opacity:.85}",
    ".kp-x{margin-left:auto;border:0;background:rgba(255,255,255,.15);color:#fff;width:30px;height:30px;border-radius:9px;font-size:18px;cursor:pointer;line-height:1}",
    ".kp-x:hover{background:rgba(255,255,255,.28)}",
    ".kp-body{flex:1;overflow-y:auto;padding:14px;background:#f7faf9;scroll-behavior:smooth}",
    ".kp-msg{display:flex;gap:8px;margin-bottom:10px;align-items:flex-end}",
    ".kp-msg .kp-av{width:28px;height:32px;flex-shrink:0;background:#e7f5f1;border-radius:9px;padding:1px 2px 0}",
    ".kp-msg .kp-av .kp-float,.kp-msg .kp-av .kp-eyes,.kp-msg .kp-av .kp-ant{animation:none}",
    ".kp-bub{background:#fff;border:1px solid #dbe8e4;border-radius:14px 14px 14px 4px;padding:10px 13px;max-width:calc(100% - 38px);color:#182522;font-size:14px;line-height:1.55}",
    ".kp-bub b{color:#084c41}",
    ".kp-user{justify-content:flex-end}",
    ".kp-user .kp-bub{background:#0f6b5b;color:#fff;border:0;border-radius:14px 14px 4px 14px;font-weight:600}",
    ".kp-typing{display:inline-flex;gap:4px;padding:3px 0}",
    ".kp-typing i{width:6px;height:6px;border-radius:50%;background:#8bb8ad;animation:kpDot 1s infinite}",
    ".kp-typing i:nth-child(2){animation-delay:.15s}.kp-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes kpDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}",
    ".kp-opts{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 12px 36px}",
    ".kp-opt{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #d0ece5;background:#fff;color:#084c41;border-radius:999px;padding:8px 13px;font:700 13px/1.2 'Inter',system-ui,sans-serif;cursor:pointer;text-decoration:none;transition:all .15s;text-align:left}",
    ".kp-opt:hover{background:#e7f5f1;border-color:#0f6b5b}",
    ".kp-opt.kp-link{background:#0f6b5b;border-color:#0f6b5b;color:#fff}",
    ".kp-opt.kp-link:hover{background:#084c41}",
    ".kp-opt.kp-ghost{border-style:dashed;color:#66736f;font-weight:600}",
    ".kp-opt:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}",
    ".kp-camp{display:block;width:100%;text-align:left;border:1px solid #dbe8e4;background:#fff;border-radius:12px;padding:10px 12px;margin:0 0 7px;cursor:pointer;font-family:inherit;transition:all .15s}",
    ".kp-camp:hover{border-color:#0f6b5b;box-shadow:0 4px 14px rgba(15,107,91,.1)}",
    ".kp-camp small{display:block;font-size:11px;font-weight:800;color:#0f6b5b;text-transform:uppercase;letter-spacing:.04em}",
    ".kp-camp strong{display:block;font-size:13.5px;color:#182522;margin:2px 0}",
    ".kp-camp em{font-style:normal;font-size:12px;color:#66736f;font-weight:600}",
    ".kp-camps{margin:2px 0 10px 36px}",
    ".kp-foot{padding:8px 14px 10px;font-size:11px;color:#8a958f;background:#fff;border-top:1px solid #e5ece9;line-height:1.4}",
    "@media (max-width:520px){.kp-root{right:10px;bottom:10px}.kp-panel{position:fixed;right:8px;left:8px;bottom:86px;width:auto;max-width:none;height:min(540px,calc(100vh - 110px))}.kp-hello{right:66px}}",
    "@media (prefers-reduced-motion:reduce){.kp-float,.kp-eyes,.kp-ant,.kp-wave .kp-hand,.kp-open .kp-panel{animation:none!important}.kp-body{scroll-behavior:auto}}"
  ].join("\n");

  /* ───────── İçerik ───────── */
  function emlakNode() {
    var now = new Date(), m = now.getMonth() + 1, y = now.getFullYear(), t;
    if (m === 11) {
      t = "Emlak vergisinin <b>2. taksit</b> dönemi şu an açık: <b>1-30 Kasım " + y + "</b>. Son gün 30 Kasım" + (y === 2026 ? " Pazartesi" : "") + ". Süresinde ödenmezse aylık gecikme zammı işler.";
    } else if (m >= 3 && m <= 5) {
      t = "Emlak vergisinin <b>1. taksit</b> dönemi şu an açık: <b>Mart-Mayıs</b> arası. 2. taksit her yıl Kasım ayında ödenir.";
    } else {
      t = "Emlak vergisi iki taksittir: <b>1. taksit Mart-Mayıs</b>, <b>2. taksit Kasım</b> ayında ödenir. Tarihler ve ödeme yolları yazımızda.";
    }
    return { text: t, opts: [{ l: "Emlak vergisi yazısı", href: "/emlak-vergisi-1-ve-2-taksit-odeme-tarihleri-2026.html", link: 1 }] };
  }

  var NODES = {
    root: {
      text: "Merhaba! Ben <b>Kompiter</b>, Kampio'nun küçük asistanıyım. 🤖<br>Bugün ne arıyorsunuz?",
      opts: [
        { l: "🎁 Kampanyalar", go: "camp" },
        { l: "💰 Mevduat ve yatırım", go: "mev" },
        { l: "🏠 Krediler ve borç", go: "kred" },
        { l: "🧾 Vergi ve maaş", go: "vergi" }
      ]
    },
    camp: {
      text: "Kampanya tarafında şunlara bakabilirsiniz:",
      opts: [
        { l: "⏰ Yakında bitenler", fn: "campSoon" },
        { l: "🏆 En yüksek ödüller", fn: "campTop" },
        { l: "Emekli promosyonu", go: "emekli" },
        { l: "%0 faizli seçenekler", go: "sifir" }
      ]
    },
    emekli: {
      text: "Emekli promosyon tutarları bankaya ve maaşı aldığınız kuruma göre değişiyor, her ay güncelleniyor. Bankaları yan yana karşılaştırabilirsiniz.",
      opts: [{ l: "Emekli promosyonlarını gör", href: "/emekli.html", link: 1 }]
    },
    sifir: {
      text: "Bankaların %0 faizli nakit avans ve taksit kampanyalarını tek sayfada topluyoruz. Süre ve tutar bankaya göre farklı.",
      opts: [{ l: "%0 faizli kampanyalar", href: "/sifir-faiz.html", link: 1 }]
    },
    mev: {
      text: "Mevduat ve yatırım için neye bakmak istersiniz?",
      opts: [
        { l: "En yüksek mevduat faizi", go: "mevOran" },
        { l: "Mevduat getirisi hesapla", go: "mevHesap" },
        { l: "Para piyasası fonu mu, mevduat mı?", go: "ppf" },
        { l: "1 ay mı, 3 ay mı vade?", go: "vade" },
        { l: "Günlük faiz getirili hesap", go: "gunluk" }
      ]
    },
    mevOran: {
      text: "Mevduat oranları sık değişiyor. Bankaların güncel TL oranlarını ve vadeye göre getiriyi mevduat sayfasında karşılaştırabilirsiniz.",
      opts: [{ l: "Mevduat oranlarını gör", href: "/mevduat.html", link: 1 }]
    },
    mevHesap: {
      text: "Tutarı, vadeyi ve faiz oranını girerek stopaj sonrası net getiriyi hesaplayabilirsiniz.",
      opts: [{ l: "Faiz hesaplama aracı", href: "/faiz-hesaplama.html", link: 1 }]
    },
    ppf: {
      text: "Kısaca: <b>vadeli mevduatın getirisi baştan bellidir</b> ve mevduat sigortası kapsamındadır. <b>Para piyasası fonunun getirisi garanti değildir</b> ama paranız vadeye bağlı kalmaz. Bireylerde fon stopajı %17,5, mevduatta vadeye göre %10-17,5. Rakamlı karşılaştırma yazımızda.",
      opts: [{ l: "Karşılaştırma yazısı", href: "/para-piyasasi-fonu-mu-vadeli-mevduat-mi.html", link: 1 }]
    },
    vade: {
      text: "Vade seçimi net getiriyi değiştirir. 1 aylık ve 3 aylık vadeyi örneklerle karşılaştırdığımız yazıya bakın.",
      opts: [{ l: "Vade seçimi yazısı", href: "/mevduatta-1-ay-mi-3-ay-mi-vade-secmeli.html", link: 1 }]
    },
    gunluk: {
      text: "Günlük faiz getirili hesapta paranız vadeye bağlı kalmadan her gün faiz işler. Vadeli mevduattan farkı yazımızda.",
      opts: [{ l: "Farkı oku", href: "/gunluk-faiz-getirili-vadesiz-hesap-nedir-mevduattan-farki.html", link: 1 }]
    },
    kred: {
      text: "Kredi ve borç tarafında size yardımcı olayım:",
      opts: [
        { l: "Kredi taksidi hesapla", go: "krHesap" },
        { l: "Konut kredisi masrafları", go: "konut" },
        { l: "Kredi kartı borcu", go: "kkBorc" },
        { l: "Findeks kredi notu", go: "findeks" },
        { l: "Başvuru neden reddedilir?", go: "red" }
      ]
    },
    krHesap: {
      text: "Tutar ve vadeye göre aylık taksit ve toplam geri ödemeyi hesaplayabilirsiniz.",
      opts: [{ l: "Kredi hesaplama", href: "/kredi.html", link: 1 }]
    },
    konut: {
      text: "Taksitten ayrı olarak <b>tapu harcı</b> (alıcı %2), tapu döner sermaye bedeli, bankanın <b>tahsis ücreti</b> (en fazla binde 5), <b>ekspertiz</b> ve zorunlu <b>DASK</b> çıkar. 3 milyon TL'lik evde, 1,5 milyon TL kredi için masraf yaklaşık 90 bin TL (DASK ve sigorta hariç).",
      opts: [
        { l: "Masraf yazısı", href: "/konut-kredisi-masraflari-ekspertiz-tapu-harci-dosya-masrafi-dask-hayat-sigortasi.html", link: 1 },
        { l: "DASK nasıl yapılır?", href: "/dask-zorunlu-deprem-sigortasi-nasil-yapilir.html", link: 1 }
      ]
    },
    kkBorc: {
      text: "Kart borcunu taşımanın yolları (borç transferi, nakit avans, ihtiyaç kredisi) farklı maliyetler taşır. Ayrıca asgari ödeme ve son ödeme tarihi yazılarımız var.",
      opts: [
        { l: "Borç transferi nasıl yapılır?", href: "/kredi-karti-borc-transferi-nasil-yapilir-borcu-baska-karta-tasima.html", link: 1 },
        { l: "Asgari ödeme yaparsam ne olur?", href: "/kredi-karti-asgari-odeme-faiz.html", link: 1 },
        { l: "Taksitleri erken kapatmak", href: "/kredi-karti-taksit-erken-kapama-tek-cekim-avantaji-2026.html", link: 1 }
      ]
    },
    findeks: {
      text: "Findeks notunun ne olduğunu ve nasıl yükseltilebileceğini anlattığımız yazıya bakabilirsiniz.",
      opts: [{ l: "Findeks yazısı", href: "/findeks-kredi-notu-nedir-nasil-yukseltilir.html", link: 1 }]
    },
    red: {
      text: "Konut kredisi başvurusunun reddedilme nedenleri ve sonuçlanma süresi yazımızda.",
      opts: [{ l: "Yazıyı oku", href: "/konut-kredisi-basvurusu-neden-reddedilir.html", link: 1 }]
    },
    vergi: {
      text: "Vergi ve maaş için neye bakmak istersiniz?",
      opts: [
        { l: "Emlak vergisi ne zaman?", go: "emlak" },
        { l: "MTV ne zaman?", go: "mtv" },
        { l: "Net maaş hesapla", go: "maas" },
        { l: "Kira artış oranı", go: "kira" },
        { l: "Maaş haczi", go: "hacz" }
      ]
    },
    mtv: {
      text: "Motorlu taşıtlar vergisi yılda iki taksittir: <b>Ocak</b> ve <b>Temmuz</b>. Ödeme yolları ve son günler yazımızda.",
      opts: [{ l: "MTV yazısı", href: "/mtv-1-ve-2-taksit-odeme-tarihleri-2026.html", link: 1 }]
    },
    maas: {
      text: "Brüt maaşınızdan net maaşı ve kesintileri hesaplayabilirsiniz.",
      opts: [{ l: "Maaş hesaplama", href: "/maas.html", link: 1 }]
    },
    kira: {
      text: "Kira artış oranının neye göre belirlendiğini ve hesaplamasını yazımızda anlattık.",
      opts: [{ l: "Kira artışı yazısı", href: "/kira-artis-orani-hesaplama-2026.html", link: 1 }]
    },
    hacz: {
      text: "Maaş haczinde kesinti sınırı ve oran yazımızda.",
      opts: [{ l: "Maaş haczi yazısı", href: "/maas-haczi-orani-kesinti-siniri-2026.html", link: 1 }]
    }
  };
  NODES.emlak = null; // dinamik

  /* ───────── Kampanya listeleri (canlı veri) ───────── */
  function liveCampaigns() {
    if (!isHome || typeof campaigns === "undefined" || !Array.isArray(campaigns)) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return campaigns.filter(function (c) {
      return c && c.isActive !== false && c.endDate && new Date(c.endDate + "T00:00:00") >= t;
    });
  }
  function daysTo(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(d + "T00:00:00") - t) / 86400000);
  }
  function campCards(list) {
    return '<div class="kp-camps">' + list.map(function (c) {
      var d = daysTo(c.endDate);
      var left = d <= 0 ? "Bugün bitiyor" : d + " gün kaldı";
      return '<button type="button" class="kp-camp" data-camp="' + esc(c.id) + '"><small>' + esc(c.bank) + " · " + esc(c.rewardLabel) +
        "</small><strong>" + esc(c.title) + "</strong><em>⏰ " + left + "</em></button>";
    }).join("") + "</div>";
  }

  /* ───────── Arayüz ───────── */
  var root, body, panel, launcher, hello, started = false, busy = false;

  function build() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    root = document.createElement("div");
    root.className = "kp-root";
    root.innerHTML =
      '<div class="kp-hello" id="kpHello" role="status"><button type="button" aria-label="Kapat" id="kpHelloX">×</button>Merhaba! Ben Kompiter 👋<br><span style="font-weight:500;color:#405048">Size yardımcı olabilir miyim?</span></div>' +
      '<div class="kp-panel" id="kpPanel" role="dialog" aria-label="Kompiter asistanı" aria-modal="false">' +
        '<div class="kp-head"><div class="kp-av">' + robotSvg() + '</div><div><b>Kompiter</b><span>Kampio asistanı</span></div>' +
        '<button type="button" class="kp-x" id="kpClose" aria-label="Kapat">×</button></div>' +
        '<div class="kp-body" id="kpBody" aria-live="polite"></div>' +
        '<div class="kp-foot">Kompiter hazır cevaplarla çalışır; yatırım ya da mali tavsiye vermez. Güncel koşulları bankanızdan teyit edin.</div>' +
      "</div>" +
      '<button type="button" class="kp-launcher kp-wave" id="kpLauncher" aria-label="Kompiter asistanını aç" aria-expanded="false">' + robotSvg() + "</button>";
    document.body.appendChild(root);
    body = root.querySelector("#kpBody");
    panel = root.querySelector("#kpPanel");
    launcher = root.querySelector("#kpLauncher");
    hello = root.querySelector("#kpHello");

    launcher.addEventListener("click", toggle);
    root.querySelector("#kpClose").addEventListener("click", close);
    hello.addEventListener("click", function (e) { if (e.target.id !== "kpHelloX") open(); });
    root.querySelector("#kpHelloX").addEventListener("click", function (e) { e.stopPropagation(); hideHello(); store(0, "kpHelloSeen", "1"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("kp-open")) { close(); launcher.focus(); } });
    body.addEventListener("click", onBodyClick);

    if (!store(1, "kpHelloSeen")) {
      setTimeout(function () {
        if (!root.classList.contains("kp-open")) { hello.classList.add("kp-show"); store(0, "kpHelloSeen", "1"); }
      }, 4500);
      setTimeout(hideHello, 15000);
    }
    setInterval(function () { // zaman zaman el sallar
      if (!root.classList.contains("kp-open")) { launcher.classList.remove("kp-wave"); void launcher.offsetWidth; launcher.classList.add("kp-wave"); }
    }, 25000);
  }
  function hideHello() { hello.classList.remove("kp-show"); }
  function open() {
    root.classList.add("kp-open"); launcher.setAttribute("aria-expanded", "true"); hideHello();
    if (!started) { started = true; botSay(NODES.root); track("kompiter_open", location.pathname); }
  }
  function close() { root.classList.remove("kp-open"); launcher.setAttribute("aria-expanded", "false"); }
  function toggle() { root.classList.contains("kp-open") ? close() : open(); }
  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function userSay(t) {
    var d = document.createElement("div"); d.className = "kp-msg kp-user";
    d.innerHTML = '<div class="kp-bub">' + esc(t) + "</div>"; body.appendChild(d); scrollDown();
  }
  function botSay(node, extraHtml) {
    busy = true;
    var wrap = document.createElement("div"); wrap.className = "kp-msg";
    wrap.innerHTML = '<div class="kp-av">' + robotSvg() + '</div><div class="kp-bub"><span class="kp-typing"><i></i><i></i><i></i></span></div>';
    body.appendChild(wrap); scrollDown();
    setTimeout(function () {
      wrap.querySelector(".kp-bub").innerHTML = node.text;
      if (extraHtml) body.insertAdjacentHTML("beforeend", extraHtml);
      var o = document.createElement("div"); o.className = "kp-opts";
      (node.opts || []).forEach(function (op) { o.appendChild(optEl(op)); });
      if (node !== NODES.root) {
        o.appendChild(optEl({ l: "↩ Başa dön", go: "root", ghost: 1 }));
      }
      body.appendChild(o); scrollDown(); busy = false;
    }, 420);
  }
  function optEl(op) {
    var el;
    if (op.href) {
      el = document.createElement("a"); el.href = op.href;
      el.addEventListener("click", function () { track("kompiter_link", op.href); });
    } else {
      el = document.createElement("button"); el.type = "button";
      el.setAttribute("data-go", op.go || ""); if (op.fn) el.setAttribute("data-fn", op.fn);
    }
    el.className = "kp-opt" + (op.link ? " kp-link" : "") + (op.ghost ? " kp-ghost" : "");
    el.textContent = op.l + (op.link ? " →" : "");
    el.setAttribute("data-label", op.l);
    return el;
  }
  function lockOld() { // eski seçenek satırlarını pasifleştir
    var all = body.querySelectorAll(".kp-opts");
    for (var i = 0; i < all.length; i++) {
      all[i].style.opacity = ".55";
      var bs = all[i].querySelectorAll("button.kp-opt");
      for (var j = 0; j < bs.length; j++) bs[j].disabled = true;
    }
  }
  function nodeFor(id) { return id === "emlak" ? emlakNode() : NODES[id]; }

  function onBodyClick(e) {
    var camp = e.target.closest(".kp-camp");
    if (camp) {
      var id = camp.getAttribute("data-camp");
      track("kompiter_campaign", id); close();
      try { openDetail(id); } catch (err) { openCampaignSection(); }
      return;
    }
    var b = e.target.closest("button.kp-opt");
    if (!b || busy || b.disabled) return;
    var label = b.getAttribute("data-label"), go = b.getAttribute("data-go"), fn = b.getAttribute("data-fn");
    track("kompiter_choice", label);
    lockOld(); userSay(label);
    if (fn === "campSoon" || fn === "campTop") return campAnswer(fn);
    if (fn === "campAll") { close(); return openCampaignSection(); }
    if (go) botSay(nodeFor(go));
  }

  function campAnswer(kind) {
    var list = liveCampaigns();
    if (!list || !list.length) {
      return botSay({
        text: isHome
          ? "Şu an listelenecek aktif kampanya göremiyorum. Kampanyalar bölümüne bakabilirsiniz."
          : "Güncel kampanyaları ana sayfadaki kampanya bölümünde listeliyoruz. Oraya götüreyim mi?",
        opts: [{ l: "Kampanyalara git", fn: "campAll" }]
      });
    }
    var sel, intro;
    if (kind === "campSoon") {
      sel = list.slice().sort(function (a, b) { return daysTo(a.endDate) - daysTo(b.endDate); }).slice(0, 4);
      intro = "Süresi en yakın bitecek <b>" + sel.length + "</b> kampanya:";
    } else {
      sel = list.slice().sort(function (a, b) { return (b.rewardValue || 0) - (a.rewardValue || 0); }).slice(0, 4);
      intro = "Ödül değeri en yüksek <b>" + sel.length + "</b> kampanya:";
    }
    botSay({ text: intro + " Detay için birine dokunun.", opts: [{ l: "Tüm kampanyalar (" + list.length + ")", fn: "campAll" }] }, campCards(sel));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
