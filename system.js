/* =========================================================
   오름에듀테크 — 시스템 페이지
   디자인 원본: zipfiles/005.zip · untitled/project/오름에듀테크 시스템.dc.html

   하는 일 셋:
     ① 히어로 사진의 패럴랙스 (상자가 화면을 지나는 동안 사진 높이의 10%까지 흐른다)
     ② 헤더 테마 — 히어로 위에서는 투명+흰 글씨, 지나가면 흰 배경+검은 글씨
     ③ 헤더 숨김(내려갈 때) + 등장 리빌
   ========================================================= */
(function () {
  "use strict";

  var TUNING = {
    drift: 0.10,      // 사진이 흐르는 거리 = 사진 높이의 이 비율
    hideAt: 80,       // 이 이상 내려간 상태에서 아래로 스크롤하면 헤더를 숨긴다(px)
    hideStep: 4,      // 이만큼은 움직여야 방향이 바뀐 것으로 본다(px)
    revealStagger: 80,
    revealGroup: 3
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var clamp = function (v, lo, hi) { return Math.min(Math.max(v, lo), hi); };
  var motion = function () { return document.documentElement.classList.contains("motion"); };

  var hdr = $("#hdr");
  var box = $("#sheroBox");
  var img = $("#sheroImg");
  var lastY = 0;


  /* ============ 히어로 패럴랙스 ============ */

  // 상자가 화면 아래에서 위로 완전히 빠져나가는 동안 p 가 0→1 이 된다.
  // maxShift 는 레이어가 화면 위로 올라간 만큼 — 이걸 넘겨 밀면 잘린 영역 위쪽에
  // 빈 곳이 생기므로 상한으로 쓴다.
  function parallax() {
    if (!box || !img) return;
    var r = box.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = clamp((vh - r.top) / (vh + r.height), 0, 1);
    var layer = img.parentElement;
    // 사진을 --hero-drop 만큼 미리 내려 두었으니(system.css) 그만큼 덜 민다
    var drop = parseFloat(getComputedStyle(img).getPropertyValue("--hero-drop")) || 0;
    var maxShift = Math.max(-layer.getBoundingClientRect().top - drop, 0);
    var shift = Math.min(p * TUNING.drift * img.offsetHeight, maxShift);
    img.style.transform = "translate3d(0," + shift.toFixed(1) + "px,0)";
  }


  /* ============ 헤더 ============ */

  // 히어로 상자의 아래끝이 헤더보다 아래에 있으면 아직 사진 위에 떠 있는 상태다
  function headerTheme() {
    if (!hdr || !box || menuOpen) return;   // 메뉴가 열린 동안은 판을 바꾸지 않는다
    hdr.classList.toggle("is-past", box.getBoundingClientRect().bottom <= hdr.offsetHeight);
  }

  function headerHide(y) {
    if (!hdr || menuOpen) return;
    if (Math.abs(y - lastY) <= TUNING.hideStep) return;
    hdr.classList.toggle("is-hidden", y > lastY && y > TUNING.hideAt);
    lastY = y;
  }

  // 좁은 화면의 전체 화면 메뉴 (메인 app.js 와 같은 동작). 같은 nav 를 CSS 가 메뉴판으로 바꾼다.
  // 경계는 system.css 의 '휴대폰' 블록과 같은 미디어쿼리 문자열이어야 한다
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
    // 메뉴 안의 링크를 누르면 닫는다 — '시스템'(#lms)은 같은 페이지라 메뉴가 남으면 안 된다
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
    setupReveal();
    headerTheme();
    if (motion()) requestAnimationFrame(parallax);

    var raf = null;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (motion()) parallax();
        headerTheme();
        headerHide(Math.max(window.scrollY, 0));
      });
    }, { passive: true });

    // 화면이 바뀌면 레이어 높이(vh 기반)와 사진 높이가 다시 계산돼야 한다
    window.addEventListener("resize", function () {
      if (motion()) parallax();
      headerTheme();
    }, { passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
