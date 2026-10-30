/* =========================================================
   오름에듀테크 — 연혁 페이지
   디자인 원본: zipfiles/009.zip · untitled/project/오름에듀테크 연혁.dc.html

   하는 일:
     ① 히어로 — 다섯 기둥이 시차를 두고 돌아가며 사진을 넘긴다(9초마다)
     ② 연표 — 화면 중앙 높이를 따라 구슬 하나만 내려가고(채움선 없음), 지나간 해만 켠다.
        구슬이 인증서 구획의 'Certification' 라벨에 닿으면 튕기며 파문이 퍼지고,
        그 박자에 라벨·가운데 인증서에 색이 돌며 제목·캐러셀이 떠오른다.
     ③ 인증서 원통 캐러셀
     ④ 헤더 테마·숨김, 등장 리빌
   ========================================================= */
(function () {
  "use strict";

  var TUNING = {
    heroInterval: 9000,   // 사진 넘김 간격(ms)
    wideAt: 900,          // 이 폭부터 가운데 선 연표
    hideAt: 120,          // 이 이상 내려간 상태에서 아래로 스크롤하면 헤더를 숨긴다(px)
    dragMin: 40,          // 이만큼 끌어야 한 장 넘어간다(px)
    revealStagger: 80,
    revealGroup: 3
  };

  // [사진, 작가, 작가 Unsplash id, 대체 텍스트]. 작가가 없으면 표기를 숨긴다
  var HERO = [
    ["assets/hero-ocheon.jpg", "", "", "오천고 자기주도학습센터에서 공부하는 학생들"],
    ["assets/unsplash/hist-hero-2.jpg", "Changbok Ko", "kochangbok", "서울시립대학교의 빈 강의실"],
    ["assets/unsplash/hist-hero-3.jpg", "byquincy", "byquincy", "한국 학교의 교실"]
  ];
  // 기둥 경계(%). 넓은 화면 5개, 휴대폰 3개 — 휴대폰은 바깥 두 얇은 기둥(8.3%)을 옆 기둥에 합친다.
  // 세로선(.hhero__rules)도 같은 경계에만 선다(history.css 휴대폰 블록)
  var BOUNDS_WIDE = [0, 8.333, 33.333, 66.667, 91.667, 100];
  var BOUNDS_NARROW = [0, 33.333, 66.667, 100];

  var CERTS = [
    { cat: "특허·연구", year: "2024", title: "연구개발전담부서 인정서", desc: "", issuer: "한국산업기술진흥협회", img: "rnd.png" },
    { cat: "사업 신고", year: "2021", title: "출판사 신고확인증", desc: "", issuer: "서울특별시 서초구청", img: "publisher.png" },
    { cat: "기업인증", year: "2025", title: "직접생산확인증명서", desc: "소프트웨어 엔지니어링업", issuer: "한국중소벤처기업유통원", img: "direct.png" },
    { cat: "사업 신고", year: "2024", title: "이러닝사업자 신고확인서", desc: "", issuer: "(사)한국에듀테크산업협회", img: "elearning.png" },
    { cat: "사업 신고", year: "2025", title: "평생교육시설 신고증", desc: "오름원격평생교육원", issuer: "서울특별시강남서초교육지원청", img: "lifelong.png" },
    { cat: "기업인증", year: "2025", title: "벤처기업확인서", desc: "혁신성장유형", issuer: "벤처기업확인기관", img: "venture.png" },
    { cat: "특허·연구", year: "2025", title: "특허증", desc: "인공지능 기반 개인 맞춤형 대학 입시 정보 진단 및 컨설팅 제공 방법·장치·시스템", short: "AI 대입 진단·컨설팅", issuer: "지식재산처", img: "patent.png" },
    { cat: "특허·연구", year: "2026", title: "특허증", desc: "인공지능 기반 온라인 수업 효과성 및 참여도 통합 평가 시스템 및 방법", short: "AI 수업 효과·참여도 평가", issuer: "지식재산처", img: "patent2.png" }
  ];

  var $ = function (sel) { return document.querySelector(sel); };
  var motion = function () { return document.documentElement.classList.contains("motion"); };
  var isWide = function () { return window.innerWidth >= TUNING.wideAt; };
  // 휴대폰 폭. history.css 의 '휴대폰' 블록과 같은 미디어쿼리 문자열이어야 한다 (메인 app.js 와 같은 값)
  var narrowMq = window.matchMedia("(max-width: 759.98px)");


  /* ============ ① 히어로 — 기둥 넘김 ============ */

  var heroIdx = 0, heroPrev = null, cols = [];

  function buildHero() {
    if (!$("#hheroMedia")) return;
    buildCols();
    // 휴대폰 ↔ 넓은 화면을 넘나들면 기둥 수가 바뀐다
    narrowMq.addEventListener("change", buildCols);
    if (motion()) {
      setInterval(function () {
        heroPrev = heroIdx;
        heroIdx = (heroIdx + 1) % HERO.length;
        paintHero();
      }, TUNING.heroInterval);
    }
  }

  function buildCols() {
    var media = $("#hheroMedia");
    var BOUNDS = narrowMq.matches ? BOUNDS_NARROW : BOUNDS_WIDE;
    media.style.background = "none";
    media.textContent = "";
    cols = [];
    for (var j = 0; j < BOUNDS.length - 1; j++) {
      var l = BOUNDS[j], w = BOUNDS[j + 1] - l;
      var col = document.createElement("div");
      col.className = "hhero__col";
      col.style.left = l + "%";
      col.style.width = w + "%";
      var faces = HERO.map(function (h) {
        var face = document.createElement("div");
        face.className = "hhero__face";
        var img = document.createElement("div");
        img.className = "hhero__img";
        img.style.left = (-l / w * 100) + "%";
        img.style.width = (100 / w * 100) + "%";
        img.style.backgroundImage = "url(\"" + h[0] + "\")";
        face.appendChild(img);
        col.appendChild(face);
        return face;
      });
      media.appendChild(col);
      cols.push(faces);
    }
    paintHero();
  }

  // 나가는 면은 왼쪽 기둥부터 -90° 로 접히고, 들어오는 면은 그 뒤를 따라 펴진다
  function paintHero() {
    cols.forEach(function (faces, j) {
      faces.forEach(function (face, i) {
        var on = i === heroIdx, out = i === heroPrev && !on;
        face.style.zIndex = on ? 2 : out ? 1 : 0;
        face.style.transform = on ? "rotateY(0deg)" : out ? "rotateY(-90deg)" : "rotateY(90deg)";
        face.style.transition = on ? "transform .8s cubic-bezier(.2,.7,.3,1) " + (0.55 + j * 0.1) + "s"
          : out ? "transform .55s cubic-bezier(.6,0,.8,.4) " + (j * 0.1) + "s" : "none";
      });
    });
  }


  /* ============ ② 연표 ============ */

  var line = $("#htl"), bead = $("#htlBead");
  var label = $("#certLabel"), certSec = $("#certs");
  var years = document.querySelectorAll("[data-yr]");
  var lit = null, litTimer = null;

  // 색이 켜지는 시점 — 구슬이 눌렸다 튀어 오르며 첫 파문이 퍼질 때(history.css beadHit/beadRipple)
  var HIT_DELAY = 260;

  function setLit(v, delay) {
    clearTimeout(litTimer);
    var apply = function () {
      if (label) label.classList.toggle("is-lit", v);
      if (certSec) {
        certSec.classList.toggle("is-lit", v);
        // 제목·캐러셀 등장은 한 번만 — 다시 올라가도 숨기지 않는다
        if (v) certSec.classList.add("is-open");
      }
    };
    if (delay) litTimer = setTimeout(apply, delay); else apply();
  }

  function updateTimeline() {
    if (!line) return;
    var wide = isWide();
    var r = line.getBoundingClientRect();
    var vh = window.innerHeight;
    var lab = label ? label.getBoundingClientRect() : null;

    // 좁은 화면 — 구슬이 없다. 라벨이 화면 아래 20% 안쪽으로 들어오면 바로 켠다
    if (!wide) {
      var inView = !!lab && lab.top < vh * 0.8;
      if (inView !== lit) { lit = inView; if (lit) setLit(true, 0); }
      Array.prototype.forEach.call(years, function (y) { y.classList.remove("is-off"); });
      return;
    }

    var firstDot = line.querySelector("[data-dot]");
    var minPos = firstDot ? firstDot.getBoundingClientRect().top - r.top + firstDot.offsetHeight / 2 : 0;
    var stop = lab ? lab.top - r.top - 22 : r.height;
    var pos = Math.max(minPos, Math.min(stop, vh * 0.5 - r.top));

    // 구슬이 라벨 바로 위(stop)에 닿는 순간이 부딪힘
    var nowLit = !!lab && pos >= stop - 1;
    if (nowLit !== lit) {
      var first = lit === null;
      lit = nowLit;
      if (bead) {
        bead.classList.remove("is-hit");
        bead.style.opacity = "";
        if (lit && first) bead.style.opacity = "0";   // 이미 지나친 위치에서 새로고침 — 연출 없이 결과만
        else if (lit) { void bead.offsetWidth; bead.classList.add("is-hit"); }   // reflow 로 애니메이션을 처음부터
      }
      setLit(lit, lit && !first ? HIT_DELAY : 0);
    }

    if (bead) bead.style.top = pos + "px";

    var n = 0;
    Array.prototype.forEach.call(years, function (y) {
      var d = y.querySelector("[data-dot]");
      if (pos >= (d || y).getBoundingClientRect().top - r.top) n++;
    });
    n = Math.max(1, n);
    Array.prototype.forEach.call(years, function (y, i) { y.classList.toggle("is-off", i >= n); });
  }


  /* ============ ②-1 화면 전환 — 흰색 → 검정 ============
     여백 560px 의 한가운데가 화면 중앙을 지나면 body 에 .is-dark 를 붙인다.
     배경색만 CSS 트랜지션(0.6초)으로 빠르게 검정이 되고, 내용은 그대로 둔 채 글자색만
     밝게 뒤집힌다(history.css). 위로 돌아가 중앙 위로 다시 올라가면 흰색으로 돌아온다.
     인증서 구획은 그보다 최소 560px 아래라, 들어올 때는 이미 배경이 검정이다 — 이음매가 없다. */

  var gap = $(".hcert-gap");
  var tone = null;   // 0 = 흰 화면, 1 = 어두운 화면 (헤더 테마가 읽는다)

  function updateTone() {
    if (!gap) return;
    var vh = window.innerHeight;
    // 기준점 = 여백 560px(마지막 연도 아래 여백 260 + .hcert-gap 300)의 한가운데.
    // 이 점이 화면 중앙을 지나면 바뀐다 — 흰 여백을 절반쯤 내려온 때다.
    var gapMid = gap.getBoundingClientRect().bottom - 280;
    // 안전장치: 'Certification' 라벨(흰 글씨)이 화면에 들어오면 무조건 어둡게.
    // 구획 자체는 배경이 투명이라 위쪽 빈 여백까지는 흰 바탕에 보여도 경계가 생기지 않는다.
    // (키가 큰 화면에서는 중앙 기준보다 라벨이 먼저 들어온다)
    var certIn = !!label && label.getBoundingClientRect().top < vh;
    var dark = gapMid < vh * 0.5 || certIn;
    var next = dark ? 1 : 0;
    if (next === tone) return;
    var first = tone === null;
    tone = next;
    var b = document.body;
    // 첫 판정(예: 인증서 위치에서 새로고침)은 트랜지션 없이 바로 — 흰 화면이 번쩍이지 않게
    if (first) b.style.transition = "none";
    b.classList.toggle("is-dark", dark);
    if (first) { void b.offsetWidth; b.style.transition = ""; }
  }


  /* ============ ③ 인증서 캐러셀 ============ */

  var stage = $("#certStage");
  var cards = [], certIdx = Math.floor((CERTS.length - 1) / 2), prevD = {};
  var dragX = null, dragged = false;

  function buildCerts() {
    if (!stage) return;
    CERTS.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "hcard";
      b.setAttribute("aria-label", c.title + (c.desc ? " — " + c.desc : ""));
      b.innerHTML =
        '<div class="hcard__cap"><p></p><p></p></div>' +
        '<div class="hcard__frame"><div class="hcard__img"></div></div>';
      b.querySelector(".hcard__cap p:first-child").textContent = c.title;
      var d = b.querySelector(".hcard__cap p + p");
      // 카드 캡션은 한 줄 — 긴 설명(특허 명칭 등)은 short 로 줄여 보이고, 전문은 desc 에 남겨 카드의 aria-label 로 읽힌다
      if (c.short || c.desc) d.textContent = c.short || c.desc; else d.remove();
      b.querySelector(".hcard__img").style.backgroundImage = "url(\"assets/certs/" + c.img + "\")";
      b.addEventListener("click", function () {
        if (dragged) { dragged = false; return; }
        // 지금 화면 기준 가장 가까운 방향의 칸 수(prevD) 만큼 한 칸씩 돌린다
        // 가운데 카드는 누를 일이 없다(자세히 보기는 2026-10-29 뺐다). 옆 카드만 가운데로 돌린다
        if (i !== certIdx) spin(prevD[i]);
      });
      stage.appendChild(b);
      cards.push(b);
    });

    stage.addEventListener("pointerdown", function (e) { dragX = e.clientX; dragged = false; });
    window.addEventListener("pointerup", function (e) {
      if (dragX == null) return;
      var dx = e.clientX - dragX;
      dragX = null;
      if (Math.abs(dx) > TUNING.dragMin) { dragged = true; step(dx < 0 ? 1 : -1); }
    });
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });
    layoutCerts();
  }

  // 한 칸 이동. 사용자가 직접 넘기면(드래그·화살표) 진행 중이던 연속 회전은 멈춘다
  function step(d, keepSpin) {
    if (!keepSpin) clearTimeout(spinTimer);
    var n = CERTS.length;
    certIdx = ((certIdx + d) % n + n) % n;
    layoutCerts();
    autoplay();   // 직접 넘겼든 자동이든 다음 자동 넘김은 지금부터 3초 뒤
  }

  // 자동 넘김 — 3초마다 오른쪽 카드가 가운데로 한 칸씩 온다(→ 화살표와 같은 방향).
  // 구획이 화면에 보이고 열린 뒤(.is-open)에만 돌고, 마우스를 올리거나 카드에 초점이 있거나
  // 탭이 숨겨져 있으면 그 차례는 건너뛰고 다시 3초를 기다린다.
  var AUTO_MS = 3000;
  var autoTimer = null, certHover = false, certVisible = false;
  function autoplay() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      var paused = !certVisible || certHover || document.hidden ||
        !(certSec && certSec.classList.contains("is-open")) ||
        (stage && stage.contains(document.activeElement));
      if (paused) autoplay(); else step(1, true);
    }, AUTO_MS);
  }
  function bindAutoplay() {
    if (!stage) return;
    stage.addEventListener("pointerenter", function () { certHover = true; });
    stage.addEventListener("pointerleave", function () { certHover = false; autoplay(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        certVisible = es[0].isIntersecting;
        if (certVisible) autoplay();
      }, { threshold: 0.3 }).observe(stage);
    } else certVisible = true;
    autoplay();
  }

  // 여러 칸 떨어진 카드를 누르면 한 번에 건너뛰지 않고 한 칸씩 잇달아 돌린다.
  // 각 칸의 이동(.8s)이 끝나기 전에 다음 칸이 출발해 원통이 끊김 없이 굴러가는 것처럼 보인다.
  var SPIN_STEP = 150;   // 칸 사이 간격(ms)
  var spinTimer = null;
  function spin(k) {
    clearTimeout(spinTimer);
    if (!k) return;
    var dir = k > 0 ? 1 : -1, left = Math.abs(k);
    (function next() {
      step(dir, true);
      if (--left > 0) spinTimer = setTimeout(next, SPIN_STEP);
    })();
  }

  // 카드를 반지름 R 짜리 원통 위에 늘어놓는다. 원본 renderVals 의 certCards 와 같은 식
  function layoutCerts() {
    if (!stage) return;
    var wide = isWide();
    var vw = window.innerWidth;
    var W = Math.min(vw, 1800) - (wide ? 80 : 40);
    var n = CERTS.length;
    var fi = 3;
    var cwOf = function (h) { return (h - fi * 2) * 230 / 325 + fi * 2; };   // 카드 비율 230:325 (+테두리)
    var chOf = function (w) { return (w - fi * 2) * 325 / 230 + fi * 2; };

    // ① 폭 기준 크기 — 원본 식. 휴대폰은 원본(240)보다 키운다 — 가운데 카드가 1.2배라 화면 폭 안에 든다
    var cw = wide ? Math.round(Math.max(240, Math.min(320, W * 0.19)))
           : narrowMq.matches ? Math.min(280, vw - 110) : Math.min(240, vw - 130);
    var ch = chOf(cw);

    // ② 높이 기준 상한 — 구획이 한 화면(100svh)에 다 들어오도록.
    //    무대 높이 = 확대 여유(가운데 카드는 아래를 축으로 1.2배 → 위로 0.2ch) + 카드 + 캡션(1.2배 확대 포함)
    var GROW = 0.2, CAP = 118, TOPPAD = 8;
    if (certSec) {
      var cs = getComputedStyle(certSec), ss = getComputedStyle(stage);
      var head = certSec.querySelector(".hcert__head");
      var avail = window.innerHeight
        - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - (head ? head.offsetHeight : 0) - parseFloat(ss.marginTop);
      var chFit = (avail - TOPPAD - CAP) / (1 + GROW);
      if (chFit < ch) ch = Math.max(220, chFit);
    }
    ch = Math.round(ch);
    cw = Math.round(cwOf(ch));
    var cardTop = Math.round(ch * GROW + TOPPAD);
    stage.style.height = (cardTop + ch + CAP) + "px";

    cards.forEach(function (card, i) {
      var d = ((i - certIdx) % n + n) % n;
      if (d > n / 2) d -= n;
      var ad = Math.abs(d), on = d === 0;
      // 끝에서 반대편 끝으로 건너뛰는 카드(원통 뒤를 도는 카드)만 순간이동시킨다 —
      // 가로질러 날아가지 않게. 위치 변화가 절반(n/2)을 넘는 경우가 그것뿐이다.
      // (예전엔 '1칸 넘게 변하면'이라 여러 칸 이동 시 모든 카드가 순간이동했다)
      var jump = prevD[i] != null && Math.abs(prevD[i] - d) > n / 2;
      prevD[i] = d;
      var R = wide ? 1700 : 900, th = d * (cw + (wide ? 26 : 14)) / R;
      var tx = R * Math.sin(th) + Math.sign(d) * cw * 0.1, tz = -R * (1 - Math.cos(th)), deg = th * 180 / Math.PI;

      var s = card.style;
      s.width = cw + "px"; s.height = ch + "px";
      s.marginLeft = (-cw / 2) + "px"; s.top = cardTop + "px";
      s.transition = jump ? "none" : "transform .8s cubic-bezier(.22,1,.36,1), opacity .5s ease, filter .5s ease";
      s.transform = "translateX(" + tx + "px) translateZ(" + tz + "px) rotateY(" + deg + "deg) scale(" + (on ? 1.2 : 1) + ")";
      s.opacity = ad <= 3 ? 1 : 0;
      s.filter = on ? "none" : "brightness(" + (ad === 1 ? 0.62 : ad === 2 ? 0.5 : 0.4) + ")" + (ad >= 3 ? " blur(5px)" : "");
      s.zIndex = 20 - ad;
      s.pointerEvents = ad > 3 ? "none" : "auto";
      card.tabIndex = on ? 0 : -1;
      card.classList.toggle("is-on", on);
    });
  }


  /* ============ ④ 헤더 · 리빌 ============ */

  var hdr = $("#hdr"), hero = $("#top"), lastY = 0;

  function updateHeader() {
    if (!hdr || menuOpen) return;   // 메뉴가 열린 동안은 숨기지도, 판을 바꾸지도 않는다
    var y = Math.max(window.scrollY, 0);
    // 화면이 반 넘게 어두워진 뒤(인증서·푸터)는 히어로 위처럼 투명 + 흰 글씨로 돌아간다
    var pastHero = !hero || y >= hero.offsetHeight - hdr.offsetHeight;
    hdr.classList.toggle("is-past", pastHero && tone < 0.5);
    if (Math.abs(y - lastY) > 4) {
      hdr.classList.toggle("is-hidden", y > lastY && y > TUNING.hideAt);
      lastY = y;
    }
  }

  // 좁은 화면의 전체 화면 메뉴 (메인 app.js 와 같은 동작). 같은 nav 를 CSS 가 메뉴판으로 바꾼다
  var menuBtn = $("#hdrMenu"), menuOpen = false;

  function setMenu(open) {
    if (!hdr || !menuBtn || open === menuOpen) return;
    menuOpen = open;
    hdr.classList.toggle("is-open", open);
    if (open) hdr.classList.remove("is-hidden");
    document.documentElement.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    if (!open) updateHeader();
  }

  function bindMenu() {
    if (!menuBtn) return;
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { setMenu(false); menuBtn.focus(); }
    });
    // 메뉴 안의 링크를 누르면 닫는다 — '회사소개'(#top)는 같은 페이지라 메뉴가 남으면 안 된다
    var nav = $("#hdrNav");
    if (nav) nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setMenu(false);
    });
    narrowMq.addEventListener("change", function () { if (!narrowMq.matches) setMenu(false); });
  }

  function setupReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!motion() || !targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
    Array.prototype.forEach.call(targets, function (el, i) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add("is-in"); return; }
      el.style.setProperty("--d", (i % TUNING.revealGroup) * TUNING.revealStagger + "ms");
      io.observe(el);
    });
  }


  /* ============ 부팅 ============ */

  function init() {
    lastY = Math.max(window.scrollY, 0);
    buildHero();
    buildCerts();
    bindMenu();
    bindAutoplay();
    setupReveal();
    updateTone();
    updateHeader();
    updateTimeline();

    var raf = null;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; updateTone(); updateHeader(); updateTimeline(); });
    }, { passive: true });

    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { layoutCerts(); updateTone(); updateTimeline(); updateHeader(); }, 120);
    }, { passive: true });
    // 사진이 늦게 들어와 연표 높이가 바뀌면 구슬 위치를 다시 잡는다
    // 웹폰트가 들어오면 인증서 제목 높이도 바뀐다 — 카드 크기를 다시 맞춘다
    window.addEventListener("load", function () { layoutCerts(); updateTone(); updateTimeline(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
