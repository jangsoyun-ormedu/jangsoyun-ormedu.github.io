/* =========================================================
   오름에듀테크 — 교육 페이지
   디자인 원본: zipfiles/005.zip · untitled/project/오름에듀테크 교육 v2.dc.html

   회사소개(app.js)와 공유하는 게 없다. 저쪽은 Lenis + ScrollTrigger 핀·스냅 체계지만
   이 페이지는 평범한 스크롤 문서다. 여기서 하는 일은 셋뿐:
     ① 히어로 3D 스택의 등장과 마우스 시차
     ② 헤더 불투명 전환 (어두운 히어로를 지나는 시점)
     ③ 등장 리빌
   ========================================================= */
(function () {
  "use strict";

  var TUNING = {
    // 히어로 등장 — 원본 setupHero
    introDelay: 300,           // 첫 프레임 뒤 눕기 시작까지(ms)
    introDuration: 2500,       // 눕는 데 걸리는 시간(ms). 끝나면 마우스 시차를 받는다

    // 마우스 시차
    restX: 55, restZ: -25,     // 제자리 회전각(deg)
    mouseDivisor: 25,          // 커서 거리를 각도로 줄이는 제수. 클수록 둔하게 반응
    layerDepth: 15,            // 판 사이 기본 간격(px)
    layerMax: 60,              // 가장 벌어졌을 때의 간격(px)
    spreadReach: 0.45,         // 화면 반지름의 이 비율만 가도 최대로 벌어진다

    // 헤더 — 어두운 히어로를 거의 다 지난 시점에 흰 배경으로 바뀐다
    solidAt: 0.85,             // 화면 높이의 배수
    hideAt: 80,                // 이 이상 내려간 상태에서 아래로 스크롤하면 접는다(px)
    hideStep: 4,               // 이만큼은 움직여야 방향이 바뀐 것으로 본다(px)

    // 리빌
    revealStagger: 80,         // 한 묶음 안에서 순번마다 밀리는 시간(ms)
    revealGroup: 3             // 3개까지만 밀고 그다음은 되돌린다(원본 i % 3)
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var clamp = function (v, lo, hi) { return Math.min(Math.max(v, lo), hi); };
  var motion = function () { return document.documentElement.classList.contains("motion"); };


  /* ============ 히어로 — 3D 스택 ============ */

  var canvas = $("#eheroCanvas");
  var layers = document.querySelectorAll("[data-layer]");
  var heroReady = false;

  // 눕는 동작 자체는 education.css 의 edu-hero-in 이 굴린다. 여기서는 그게 끝나는
  // 시점만 잡아 ① 애니메이션을 걷어 내고(그대로 두면 인라인 transform 을 덮어쓴다)
  // ② 마우스 시차를 열어 준다. 도중에 열면 등장이 끊긴다.
  function introHero() {
    if (!canvas || !motion()) return;
    var done = function () {
      canvas.classList.add("is-ready");
      heroReady = true;
    };
    canvas.addEventListener("animationend", done, { once: true });
    // 탭이 백그라운드였다가 돌아오면 animationend 를 놓칠 수 있다
    setTimeout(done, TUNING.introDelay + TUNING.introDuration + 200);
  }

  function onMouse(e) {
    // 히어로를 지나쳤으면 계산하지 않는다 — 보이지도 않는 걸 매 프레임 그릴 이유가 없다
    if (!heroReady || !canvas || window.scrollY > window.innerHeight) return;

    var d = TUNING.mouseDivisor;
    var x = (window.innerWidth / 2 - e.clientX) / d;
    var y = (window.innerHeight / 2 - e.clientY) / d;

    canvas.style.transform = "rotateX(" + (TUNING.restX + y / 2) + "deg) rotateZ(" + (TUNING.restZ + x / 2) + "deg)";

    // 커서가 중앙에서 멀어질수록 판이 벌어진다. smoothstep 으로 가장자리에서 완만하게.
    var reach = Math.hypot(window.innerWidth, window.innerHeight) / 2 / d * TUNING.spreadReach;
    var t = clamp(Math.hypot(x, y) / reach, 0, 1);
    var tilt = t * t * (3 - 2 * t);
    var step = TUNING.layerDepth + Math.max(TUNING.layerMax - TUNING.layerDepth, 0) * tilt;

    Array.prototype.forEach.call(layers, function (el, i) {
      var k = (i + 1) * (0.2 + 0.5 * tilt);
      el.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translateZ(" + (Math.pow(i + 1, 1.35) * step).toFixed(1) + "px)" +
                           " translate(" + (x * k).toFixed(1) + "px," + (y * k).toFixed(1) + "px)";
    });
  }


  /* ============ 헤더 ============ */

  var hdr = $("#hdr");
  var lastY = 0;

  function updateHeader() {
    if (!hdr || menuOpen) return;   // 메뉴가 열린 동안은 숨기지도, 판을 바꾸지도 않는다
    var y = Math.max(window.scrollY, 0);
    hdr.classList.toggle("is-solid", y > window.innerHeight * TUNING.solidAt);
    // 아래로 움직일 때만 접는다. hideStep 이하의 흔들림은 방향으로 보지 않는다.
    if (Math.abs(y - lastY) > TUNING.hideStep) {
      hdr.classList.toggle("is-hidden", y > lastY && y > TUNING.hideAt);
      lastY = y;
    }
  }


  // 좁은 화면의 전체 화면 메뉴 (메인 app.js 와 같은 동작). 같은 nav 를 CSS 가 메뉴판으로 바꾼다.
  // 경계는 education.css 의 '휴대폰' 블록과 같은 미디어쿼리 문자열이어야 한다
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
    if (!open) updateHeader();
  }

  function bindMenu() {
    if (!menuBtn) return;
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { setMenu(false); menuBtn.focus(); }
    });
    // 메뉴 안의 링크를 누르면 닫는다 — '교육'(#top)은 같은 페이지라 메뉴가 남으면 안 된다
    var nav = $("#hdrNav");
    if (nav) nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setMenu(false);
    });
    narrowMq.addEventListener("change", function () { if (!narrowMq.matches) setMenu(false); });
  }


  /* ============ 등장 리빌 ============ */

  function setupReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!motion() || !targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -15% 0px", threshold: 0.01 });

    Array.prototype.forEach.call(targets, function (el, i) {
      var r = el.getBoundingClientRect();
      // 이미 화면에 들어와 있는 건 숨기지 않는다 — 첫 화면이 빈 채로 시작하면 안 된다
      if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add("is-in"); return; }
      el.style.setProperty("--d", Math.min(i % TUNING.revealGroup, TUNING.revealGroup - 1) * TUNING.revealStagger + "ms");
      io.observe(el);
    });
  }


  /* ============ 섹션 바로가기 (011) ============
     디자인 원본 sideNav 와 같은 판정: 섹션 머리(첫 자식)가 화면 위 45% 를 지나면 그 섹션이 현재.
     첫 섹션 머리가 화면 70% 위로 올라오고 마지막 섹션 바닥이 30% 아래에 있는 동안만 보인다. */
  function setupSideNav() {
    var wrap = document.querySelector("[data-snav]");
    if (!wrap) return;
    var items = Array.prototype.slice.call(wrap.querySelectorAll("a[href^='#']"));
    var secs = items.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
    if (!secs[0]) return;
    var head = function (s) { return s && (s.firstElementChild || s); };

    function update() {
      var vh = window.innerHeight, act = -1;
      secs.forEach(function (s, i) { if (s && head(s).getBoundingClientRect().top < vh * 0.45) act = i; });
      var last = secs[secs.length - 1];
      var show = window.innerWidth >= 1100 &&
        head(secs[0]).getBoundingClientRect().top < vh * 0.7 &&
        (!last || last.getBoundingClientRect().bottom > vh * 0.3);
      wrap.classList.toggle("is-shown", show);
      items.forEach(function (a, i) {
        var on = i === act;
        a.classList.toggle("is-on", on);
        if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
    }

    // 스크롤도 직접 굴린다 — 거리에 맞춘 시간(0.6~1.2초) 동안 천천히 출발해 천천히 멈춘다.
    // 휠·터치·키로 사용자가 끼어들면 즉시 멈춘다.
    var scrollAnim = null;
    function stopScroll() { if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = null; } }
    ["wheel", "touchstart", "keydown"].forEach(function (t) { window.addEventListener(t, stopScroll, { passive: true }); });
    function glideTo(y) {
      stopScroll();
      var from = window.scrollY, dist = y - from;
      if (Math.abs(dist) < 2) return;
      var dur = Math.min(1200, Math.max(600, Math.abs(dist) * 0.35)), t0 = null;
      var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      (function frame(now) {
        if (t0 === null) t0 = now;
        var p = Math.min((now - t0) / dur, 1);
        // html 의 scroll-behavior:smooth 를 타면 프레임마다 새 부드러운 스크롤이 겹친다 — 즉시 이동으로
        window.scrollTo({ top: from + dist * ease(p), left: 0, behavior: "instant" });
        scrollAnim = p < 1 ? requestAnimationFrame(frame) : null;
      })(performance.now());
    }

    items.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        var s = secs[i];
        if (!s) return;
        e.preventDefault();
        var y = head(s).getBoundingClientRect().top + window.scrollY - 110;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) window.scrollTo(0, y);
        else glideTo(y);
        if (history.replaceState) try { history.replaceState(null, "", "#" + s.id); } catch (err) {}
        // 마우스로 눌렀으면 바로 접는다 — 초점과 hover 가 남아 펼친 채로 있지 않게
        if (e.detail > 0) { a.blur(); wrap.classList.add("is-collapsed"); }
      });
    });
    wrap.addEventListener("pointerleave", function () { wrap.classList.remove("is-collapsed"); });
    // 판정은 섹션 몇 개의 위치만 읽는 가벼운 일이라 rAF 로 미루지 않고 스크롤마다 바로 한다
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ============ 부팅 ============ */

  function init() {
    setupSideNav();
    bindMenu();
    lastY = Math.max(window.scrollY, 0);
    introHero();
    setupReveal();
    updateHeader();

    var raf = null;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; updateHeader(); });
    }, { passive: true });

    if (motion()) window.addEventListener("mousemove", onMouse, { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
