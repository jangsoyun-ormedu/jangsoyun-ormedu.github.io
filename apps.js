/* =========================================================
   오름에듀테크 — 앱 페이지
   디자인 원본: zipfiles/005.zip · untitled/project/오름에듀테크 앱.dc.html

   파일 이름이 apps.js 인 이유: 같은 폴더의 app.js 가 회사소개의 스크롤 체계다.

   하는 일:
     ① 플래너 사진 3열 무한 흐름 (가운데 열만 반대 방향)
     ② 히어로 버블의 자기장 반응 + 불빛 깜빡임
     ③ 3단계 호버
     ④ 02 아코디언 + 휴대폰 둥실거림·호버 (007·008.zip)
     ⑤ 03 부채꼴 3D 캐러셀 (008.zip)
     ⑥ 헤더 테마·숨김 + 스크롤 등장
   히어로 카피의 등장은 apps.css 가 굴린다([data-rise]).
   ========================================================= */
(function () {
  "use strict";

  var TUNING = {
    // 사진 흐름
    shotSpeed: 22,        // px/s (원본 marqueeSpeed 기본값)
    shotSpread: 0.12,     // 열마다 빨라지는 비율

    // 버블 자기장
    bubbleReach: 180,     // 이 안에 커서가 들어오면 반응한다(px)
    bubblePull: 0.35,     // 커서 쪽으로 끌려가는 비율
    bubbleSwell: 0.28,    // 가장 가까울 때 부푸는 비율

    // 불빛
    sparkCount: 26,
    sparkSeed: 7,

    // 헤더
    hideAt: 80, hideStep: 4,

    // 스크롤 등장
    revealStagger: 90,
    revealCap: 5,         // 한 묶음에서 지연이 쌓이는 최대 순번
    revealTrigger: 33     // 화면 아래에서 이 % 만큼 올라와야 켠다
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var motion = function () { return document.documentElement.classList.contains("motion"); };


  /* ============ 플래너 사진 3열 ============ */

  // 목록을 두 벌 넣어 뒀으므로 절반(half)만 흐른 뒤 0 으로 되감으면 이어져 보인다.
  // 홀수 열은 방향을 뒤집는다 — 원본의 dir = i % 2 ? 1 : -1.
  var tracks = $$("[data-track]");
  var rafShots = null;

  function tickShots(t) {
    Array.prototype.forEach.call(tracks, function (el, i) {
      var half = el.scrollHeight / 2;
      if (!half) return;
      var y = ((t / 1000) * TUNING.shotSpeed * (1 + i * TUNING.shotSpread)) % half;
      var down = i % 2 === 1;
      el.style.transform = "translate3d(0," + (down ? y - half : -y).toFixed(1) + "px,0)";
    });
    rafShots = requestAnimationFrame(tickShots);
  }


  /* ============ 히어로 버블 — 커서에 끌려오며 부푼다 ============ */

  var hero = $("#top");
  var bubbles = $$("[data-bubble]");

  function moveBubbles(e) {
    Array.prototype.forEach.call(bubbles, function (b) {
      var r = b.getBoundingClientRect();
      // 지금 걸린 이동량을 빼서 '원래 자리'의 중심을 구한다. 안 그러면 기준이 밀린다.
      var cx = r.left + r.width / 2 - (parseFloat(b.dataset.tx) || 0);
      var cy = r.top + r.height / 2 - (parseFloat(b.dataset.ty) || 0);
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var d = Math.hypot(dx, dy);

      if (d >= TUNING.bubbleReach) { resetBubble(b); return; }

      var k = 1 - d / TUNING.bubbleReach;
      var tx = dx * TUNING.bubblePull * k, ty = dy * TUNING.bubblePull * k;
      b.dataset.tx = tx; b.dataset.ty = ty;
      b.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + (1 + TUNING.bubbleSwell * k).toFixed(3) + ")";
      b.style.background = "rgba(79,222,216," + (0.1 + 0.28 * k).toFixed(3) + ")";
      b.style.borderColor = "rgba(79,222,216," + (0.2 + 0.6 * k).toFixed(3) + ")";
      b.style.boxShadow = "0 0 " + Math.round(40 * k) + "px rgba(79,222,216," + (0.55 * k).toFixed(3) + ")";
    });
  }

  function resetBubble(b) {
    b.dataset.tx = 0; b.dataset.ty = 0;
    b.style.transform = ""; b.style.background = "";
    b.style.borderColor = ""; b.style.boxShadow = "";
  }

  function leaveBubbles() { Array.prototype.forEach.call(bubbles, resetBubble); }


  /* ============ 불빛 ============ */

  // 씨드 고정 난수 — 새로고침해도 같은 배치가 나와야 한다
  function setupSparks() {
    var box = $("#aheroSparks");
    if (!box || !hero) return;
    var seed = TUNING.sparkSeed;
    var rnd = function () { return (seed = (seed * 9301 + 49297) % 233280) / 233280; };

    for (var i = 0; i < TUNING.sparkCount; i++) {
      var s = document.createElement("span");
      var size = 2 + rnd() * 3;
      var c = rnd() > 0.45 ? "#4fded8" : "#ffffff";
      s.style.cssText = "position:absolute;left:" + (rnd() * 100).toFixed(2) + "%;top:" + (rnd() * 100).toFixed(2) +
        "%;width:" + size.toFixed(1) + "px;height:" + size.toFixed(1) + "px;border-radius:50%;background:" + c +
        ";box-shadow:0 0 " + Math.round(size * 3) + "px " + c + ";opacity:0";
      box.appendChild(s);
    }

    // 뿌린 점 + 마크업에 박아 둔 [data-twinkle] 넷을 같이 깜빡인다.
    // 음수 delay 로 시작 위상을 흩어 한꺼번에 반짝이지 않게 한다.
    var all = Array.prototype.slice.call(box.children)
      .concat(Array.prototype.slice.call(hero.querySelectorAll("[data-twinkle]")));
    all.forEach(function (el) {
      if (!el.animate) return;
      var peak = 0.55 + rnd() * 0.45;
      el.animate([
        { opacity: 0.08, transform: "scale(0.6)" },
        { opacity: peak, transform: "scale(1)", offset: 0.5 },
        { opacity: 0.08, transform: "scale(0.6)" }
      ], { duration: 2200 + rnd() * 3800, delay: -rnd() * 5000, iterations: Infinity, easing: "ease-in-out" });
    });
  }


  /* ============ 3단계 호버 ============ */

  function bindSteps() {
    var wrap = $("#appSteps");
    if (!wrap) return;
    var steps = wrap.querySelectorAll(".app__step");
    Array.prototype.forEach.call(steps, function (el, i) {
      el.addEventListener("mouseenter", function () {
        Array.prototype.forEach.call(steps, function (o, j) { o.classList.toggle("is-on", i === j); });
      });
    });
  }


  /* ============ 02 아코디언 ============ */

  // 마우스를 올리거나 누르면 그 항목만 펼친다. 벗어나도 마지막 고른 항목이 열린 채 남는다.
  function bindAccordion() {
    var wrap = $("#appAcc");
    if (!wrap) return;
    var items = wrap.querySelectorAll(".app__acc-item");
    Array.prototype.forEach.call(items, function (el, i) {
      var pick = function () {
        Array.prototype.forEach.call(items, function (o, j) {
          o.classList.toggle("is-on", i === j);
          o.setAttribute("aria-expanded", i === j ? "true" : "false");
        });
      };
      el.addEventListener("mouseenter", pick);
      el.addEventListener("click", pick);
    });
  }


  /* ============ 03 캐러셀 — 부채꼴 3D ============ */

  // 앞 폰이 가운데, 이웃 둘은 비스듬히 뒤로, 나머지는 앞 폰 바로 뒤에 숨긴다 —
  // 숨은 폰이 보이는 자리를 가로질러 미끄러지지 않게 하려는 것.
  var CAR = {
    interval: 3200,     // 자동 넘김(ms)
    spread: 0.62,       // 이웃 폰 간격 (폰 폭 대비)
    extraGap: 20,       // 그 위에 더 벌리는 고정 간격(px) — 원본보다 20px 넓게
    sideScale: 0.84, backScale: 0.6,
    sideTurn: 18,       // 이웃 폰 rotateY(deg)
    depth: 120, backDepth: 320,
    sideOpacity: 0.4
  };

  var carStage = $("#appCar");
  var carPhones = carStage ? carStage.querySelectorAll(".app__car-phone") : [];
  var carDots = $$("#appCarDots button");
  var carIdx = 0, carTimer = null, carHover = false, carVisible = false;

  function layoutCar() {
    var n = carPhones.length;
    if (!n) return;
    var w = carPhones[0].offsetWidth || 200;
    Array.prototype.forEach.call(carPhones, function (el, i) {
      var d = (i - carIdx) % n;
      if (d < 0) d += n;
      if (d > n / 2) d -= n;
      var ad = Math.abs(d);
      var hidden = ad >= 2;
      var x = hidden ? 0 : d * (w * CAR.spread + CAR.extraGap);
      var s = ad === 0 ? 1 : ad === 1 ? CAR.sideScale : CAR.backScale;
      var ry = hidden || d === 0 ? 0 : d > 0 ? -CAR.sideTurn : CAR.sideTurn;
      el.style.transform = "translate(-50%,-50%) translateX(" + x.toFixed(1) + "px) translateZ(" +
        (hidden ? -CAR.backDepth : -ad * CAR.depth) + "px) rotateY(" + ry + "deg) scale(" + s + ")";
      el.style.zIndex = String(hidden ? 0 : 10 - ad);
      // 이동은 스프링 이징(apps.css 의 --car-ease). 투명도는 넘치면 안 되니 따로 —
      // 숨을 땐 빨리 사라지고, 나타날 땐 자리를 잡은 뒤 천천히 떠오른다
      el.style.transition = "transform var(--car-dur) var(--car-ease), opacity " +
        (hidden ? ".25s ease-out" : ".6s ease .15s") + ", filter .8s ease";
      el.style.opacity = hidden ? "0" : ad === 1 ? String(CAR.sideOpacity) : "1";
      el.style.filter = ad === 0 ? "none" : "brightness(0.96)";
      el.style.pointerEvents = hidden ? "none" : "auto";
      el.tabIndex = hidden ? -1 : 0;
    });
    Array.prototype.forEach.call(carDots, function (el, i) {
      el.classList.toggle("is-on", i === carIdx);
      if (i === carIdx) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current");
    });
  }

  function carGo(i) {
    var n = carPhones.length;
    carIdx = ((i % n) + n) % n;
    layoutCar();
  }

  // 자동 넘김은 모션이 켜져 있고, 화면에 보이고, 마우스가 올라와 있지 않을 때만
  function syncCar() {
    var run = motion() && carVisible && !carHover && !document.hidden;
    if (run && !carTimer) carTimer = setInterval(function () { carGo(carIdx + 1); }, CAR.interval);
    else if (!run && carTimer) { clearInterval(carTimer); carTimer = null; }
  }

  function setupCar() {
    if (!carStage || !carPhones.length) return;
    Array.prototype.forEach.call(carPhones, function (el, i) {
      el.addEventListener("click", function (e) { e.preventDefault(); carGo(i); });
    });
    Array.prototype.forEach.call(carDots, function (el, i) {
      el.addEventListener("click", function () { carGo(i); });
    });
    carStage.addEventListener("mouseenter", function () { carHover = true; syncCar(); });
    carStage.addEventListener("mouseleave", function () { carHover = false; syncCar(); });
    layoutCar();
    // 이웃 간격이 폰 폭에서 나오므로 크기가 바뀌면 다시 깐다
    if ("ResizeObserver" in window) new ResizeObserver(layoutCar).observe(carStage);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        carVisible = entries[0].isIntersecting;
        syncCar();
      }).observe(carStage);
    }
    document.addEventListener("visibilitychange", syncCar);
  }


  /* ============ 02 휴대폰 — 둥실거림 + 호버 시 벌어짐 ============ */

  // 위치·크기는 원본 기본값. 그 위에 둥실거림, 호버 벌어짐, 커서 따라가기를 더한다.
  // 호버 반응은 원본보다 키웠다(원본: 벌어짐 18px · 확대 3% · 회전 1.2° · 선형 보간 0.08).
  var PHONE = {
    a: { x: 15, y: -35, size: 115 },
    b: { x: 40, y: -15, size: 120 },
    amp: 8,          // 둥실거림 폭(px)

    // 호버 — 스프링. 지금 값은 약 0.45초에 90% 벌어지고 2% 남짓 넘쳤다 자리 잡는다
    stiff: 0.012,    // 당기는 힘. 클수록 빨라지지만 넘쳐서 튕긴다(0.09 면 40% 넘침)
    damp: 0.85,      // 속도 유지율. 클수록 더 출렁인다 — 올릴 땐 stiff 를 같이 낮출 것
    spreadX: 44,     // 두 폰이 양옆으로 벌어지는 거리(px)
    liftA: 30,       // 앞 폰이 떠오르는 높이(px)
    liftB: 14,
    growA: 0.05,     // 확대 비율
    growB: 0.04,
    turn: 3,         // 서로 반대로 도는 각도(deg)
    floatBoost: 0.8, // 호버 중 둥실거림이 빨라지는 비율
    ampBoost: 0.5,   // 호버 중 둥실거림 폭이 커지는 비율

    // 커서 따라가기 — 앞 폰은 커서 쪽으로, 뒤 폰은 반대로 움직여 깊이감을 낸다
    followA: 18, followB: -12, followTurn: 2.5, followEase: 0.06
  };
  // 좁은 화면: 두 폰 자리는 apps.css 휴대폰 블록이 잡는다. 여기선 덧붙이는 이동 없이 원래 크기로 둔다
  var PHONE_NARROW = { a: { x: 0, y: 0, size: 100 }, b: { x: 0, y: 0, size: 100 } };
  var phonesNarrowMq = window.matchMedia("(max-width: 759.98px)");

  var phones = $("#appPhones");
  var phoneA = phones && phones.querySelector(".app__phone-a");
  var phoneB = phones && phones.querySelector(".app__phone-b");
  var phoneGlow = phones && phones.querySelector(".app__phones-glow");
  var hoverK = 0, hoverV = 0, hoverTarget = 0;
  var ptrX = 0, ptrY = 0, ptrTX = 0, ptrTY = 0;   // 상자 중심 기준 -1..1
  var phase = 0, lastT = null;
  var rafPhones = null;

  function setPhone(el, x, y, s, rot) {
    el.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) rotate(" +
      rot.toFixed(3) + "deg) scale(" + (s / 100).toFixed(4) + ")";
  }

  function tickPhones(t) {
    var P = PHONE, h, g;
    var base = phonesNarrowMq.matches ? PHONE_NARROW : PHONE;
    // 위상을 쌓아 가야 속도가 바뀌어도 둥실거림이 튀지 않는다
    var dt = lastT == null ? 0 : Math.min((t - lastT) / 1000, 0.05);
    lastT = t;

    hoverV = (hoverV + (hoverTarget - hoverK) * P.stiff) * P.damp;
    hoverK += hoverV;
    h = hoverK;
    g = Math.max(0, Math.min(1, h));

    phase += dt * (1 + g * P.floatBoost);
    var amp = P.amp * (1 + g * P.ampBoost);

    ptrX += (ptrTX - ptrX) * P.followEase;
    ptrY += (ptrTY - ptrY) * P.followEase;

    if (phoneGlow) {
      phoneGlow.style.opacity = g.toFixed(3);
      // 빛은 두 폰이 실제로 보이는 중심의 가운데에 둔다
      if (g > 0.001) {
        var r0 = phones.getBoundingClientRect();
        var ra = phoneA.querySelector("img").getBoundingClientRect();
        var rb = phoneB.getBoundingClientRect();
        phoneGlow.style.left = (((ra.left + ra.right) / 2 + (rb.left + rb.right) / 2) / 2 - r0.left).toFixed(1) + "px";
        phoneGlow.style.top = (((ra.top + ra.bottom) / 2 + (rb.top + rb.bottom) / 2) / 2 - r0.top).toFixed(1) + "px";
      }
    }

    setPhone(phoneA,
      base.a.x + h * P.spreadX + ptrX * P.followA,
      base.a.y + Math.sin(phase * 1.05) * amp - h * P.liftA + ptrY * P.followA * 0.6,
      base.a.size * (1 + h * P.growA),
      Math.sin(phase * 0.7) * 0.6 + h * P.turn + ptrX * P.followTurn);
    setPhone(phoneB,
      base.b.x - h * (P.spreadX - 4) + ptrX * P.followB,
      base.b.y + Math.sin(phase * 1.05 + 1.9) * amp - h * P.liftB + ptrY * P.followB * 0.6,
      base.b.size * (1 + h * P.growB),
      Math.sin(phase * 0.7 + 1.3) * 0.6 - h * P.turn - ptrX * P.followTurn * 0.6);

    rafPhones = requestAnimationFrame(tickPhones);
  }

  function followPointer(e) {
    var r = phones.getBoundingClientRect();
    ptrTX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    ptrTY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }

  // 화면 밖에서는 매 프레임 돌릴 이유가 없다
  var phonesVisible = false;
  function syncPhones() {
    var run = phonesVisible && !document.hidden;
    if (run && !rafPhones) { lastT = null; rafPhones = requestAnimationFrame(tickPhones); }
    else if (!run && rafPhones) { cancelAnimationFrame(rafPhones); rafPhones = null; }
  }

  function setupPhones() {
    if (!phones || !phoneA || !phoneB) return;
    phones.addEventListener("mouseenter", function () { hoverTarget = 1; });
    phones.addEventListener("mouseleave", function () { hoverTarget = 0; ptrTX = 0; ptrTY = 0; });
    phones.addEventListener("mousemove", followPointer, { passive: true });
    new IntersectionObserver(function (entries) {
      phonesVisible = entries[0].isIntersecting;
      syncPhones();
    }).observe(phones);
    document.addEventListener("visibilitychange", syncPhones);
  }


  /* ============ 헤더 ============ */

  var hdr = $("#hdr");
  var lastY = 0;

  function headerTheme() {
    if (!hdr || menuOpen) return;   // 메뉴가 열린 동안은 판을 바꾸지 않는다
    var hh = hero && hero.offsetHeight ? hero.offsetHeight : window.innerHeight;
    hdr.classList.toggle("is-past", window.scrollY > hh - hdr.offsetHeight);
  }

  function headerHide(y) {
    if (!hdr || menuOpen) return;
    if (Math.abs(y - lastY) <= TUNING.hideStep) return;
    hdr.classList.toggle("is-hidden", y > lastY && y > TUNING.hideAt);
    lastY = y;
  }

  // 좁은 화면의 전체 화면 메뉴 (메인 app.js 와 같은 동작). 같은 nav 를 CSS 가 메뉴판으로 바꾼다.
  // 경계는 apps.css 의 '휴대폰' 블록과 같은 미디어쿼리 문자열이어야 한다
  var narrowMq = window.matchMedia("(max-width: 759.98px)");
  var menuBtn = $("#hdrMenu"), menuOpen = false;

  function setMenu(open) {
    if (!hdr || !menuBtn || open === menuOpen) return;
    menuOpen = open;
    hdr.classList.toggle("is-open", open);
    if (open) hdr.classList.remove("is-hidden");
    document.documentElement.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    if (!open) headerTheme();
  }

  function bindMenu() {
    if (!menuBtn) return;
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { setMenu(false); menuBtn.focus(); }
    });
    // 메뉴 안의 링크를 누르면 닫는다 — '앱'(#top)은 같은 페이지라 메뉴가 남으면 안 된다
    var nav = $("#hdrNav");
    if (nav) nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setMenu(false);
    });
    narrowMq.addEventListener("change", function () { if (!narrowMq.matches) setMenu(false); });
  }


  /* ============ 스크롤 등장 ============ */

  // 구획마다 따로 번호를 매긴다 — 지연이 페이지 전체로 누적되면 아래쪽이 한참 늦게 뜬다
  var revealIO = null, revealPending = [];

  function revealEl(el) {
    el.classList.add("is-in");
    if (revealIO) revealIO.unobserve(el);
    var k = revealPending.indexOf(el);
    if (k >= 0) revealPending.splice(k, 1);
  }

  function setupReveal() {
    if (!motion()) return;
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) revealEl(e.target); });
    }, { rootMargin: "0px 0px -" + TUNING.revealTrigger + "% 0px", threshold: 0 });

    Array.prototype.forEach.call($$(".app"), function (sec) {
      Array.prototype.forEach.call(sec.querySelectorAll("[data-reveal]"), function (el, i) {
        el.style.setProperty("--d", Math.min(i, TUNING.revealCap) * TUNING.revealStagger + "ms");
        var r = el.getBoundingClientRect();
        // 이미 화면에 들어와 있으면 숨긴 채 두지 않는다
        if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add("is-in"); return; }
        revealPending.push(el);
        revealIO.observe(el);
      });
    });
  }

  // 마지막 구획 아래쪽(03 출시일 등)은 끝까지 내려도 기준선(아래 33%)에 못 닿는다 —
  // 페이지 바닥에 닿으면 화면에 걸친 나머지를 모두 띄운다
  function revealAtBottom() {
    if (!revealPending.length) return;
    var doc = document.documentElement;
    if (window.scrollY + window.innerHeight < doc.scrollHeight - 2) return;
    revealPending.slice().forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) revealEl(el);
    });
  }


  /* ============ 부팅 ============ */

  function init() {
    lastY = Math.max(window.scrollY, 0);
    bindMenu();
    bindSteps();
    bindAccordion();
    setupCar();
    setupReveal();
    headerTheme();

    if (motion()) {
      rafShots = requestAnimationFrame(tickShots);
      setupSparks();
      setupPhones();
      if (hero) {
        hero.addEventListener("mousemove", moveBubbles, { passive: true });
        hero.addEventListener("mouseleave", leaveBubbles, { passive: true });
      }
    }

    var raf = null;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        headerTheme();
        headerHide(Math.max(window.scrollY, 0));
        revealAtBottom();
      });
    }, { passive: true });

    // 히어로 높이는 내용에 따라 변한다 — 헤더 전환 기준이 그 높이라 다시 재야 한다
    window.addEventListener("resize", headerTheme, { passive: true });

    // 탭이 안 보일 때 매 프레임 사진을 밀 이유가 없다
    document.addEventListener("visibilitychange", function () {
      if (!motion()) return;
      if (document.hidden) {
        if (rafShots) { cancelAnimationFrame(rafShots); rafShots = null; }
      } else if (!rafShots) {
        rafShots = requestAnimationFrame(tickShots);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
