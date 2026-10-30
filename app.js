/* =========================================================
   오름에듀테크 v3 — Full-Page Snap & Pin System
   디자인 원본: zipfiles/004.zip · untitled/project/오름에듀테크 v3.dc.html

   스크롤 체계는 하나가 관장한다:
     Lenis          — 휠 관성/감속 커브
     ScrollTrigger  — PROCESS·ON SITE 핀 고정과 진행도
     아래 snap 로직  — 핀 섹션(PROCESS·ON SITE)의 시작점에만 스냅.
                      나머지 섹션은 자유 스크롤이다(2026-10 전 섹션 스냅을 걷어냄).

   CSS scroll-snap 은 쓰지 않는다. 핀과 같은 스크롤 위치를 동시에 잡아당겨
   떨림이 생기기 때문이다(GSAP 문서 권고).
   ========================================================= */
(function () {
  "use strict";

  var TUNING = {
    // 히어로 슬라이드 — 디자인 heroInterval 기본값 5s
    heroInterval: 5,           // 한 장이 머무는 시간(s)
    heroFade: 1.6,             // 크로스페이드(s)
    heroOpacity: 0.62,         // 활성 장의 투명도 — 카피가 읽히도록 눌러 둔 값
    heroPushTo: 1.08,          // 노출 동안 밀려드는 최종 배율

    // 핀 구간 길이 — 화면 높이의 배수
    procScroll: 1.43,          // PROCESS 3단계
    // ON SITE — 디자인은 460vh 섹션 안의 sticky 100vh, 즉 진행 구간이 360vh 다.
    // 핀 길이를 3.6 으로 두면 사진의 이동량이 원본과 정확히 같아진다.
    onsiteScroll: 3.6,

    // 스냅
    snapRange: 0.5,            // 섹션 시작점이 화면 높이의 이 비율 안이면 당긴다(낮출수록 약함)
    snapDuration: 0.85,        // 초
    snapIdle: 90,              // 스크롤 이벤트가 이만큼 끊기면 멈췄는지 확인한다(ms)
    snapVelocity: 0.5,         // 관성 속도가 이보다 느려야(px/프레임) 멈춘 것으로 보고 스냅한다

    // 관성
    lenisDuration: 1.15,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,

    // 진행 사업 — 스퀴즈 캐러셀
    activeFlex: 10, neighborFlex: 2.5, foldedFlex: 0.4,
    cardGap: 3, foldedSlatGap: 3,
    hoverGrow: true,
    hoverGrowFolded: 4,        // 완전히 접힌 슬랫에 올렸을 때 넓어지는 배율
    hoverGrowNeighbor: 1.6,    // 반쯤 접힌 이웃 카드에 올렸을 때
    hoverOpenDelay: 600,     // 이 시간만큼 카드 위에 머물면 클릭 없이 펼쳐진다(ms)

    // NOW RUNNING 오도미터 — count-up.tsx 의 digitEffect="slide" 를 옮긴 것
    odoDuration: 2800,         // 빠른 구간 — 목표 직전(목표 - odoTail)까지 굴러가는 시간(ms)
    odoEase: 2.6,              // 빠른 구간 감속 세기. 클수록 초반이 빠르고 끝이 길게 늘어진다
    odoTail: 5,                // 마지막에 천천히 한 칸씩 올라가는 칸 수
    odoTailDuration: 1000,     // 그 마지막 칸들에 쓰는 시간(ms)
    odoTailEase: 2.0,         // 마지막 구간 감속. 1 = 일정한 속도
    odoCarry: 0.9,             // 윗자리가 따라 도는 구간. 0.9 = 아래 릴의 마지막 10%

    // 리빌
    revealStagger: 90,

    // ON SITE 사진 배치 — 디자인 v2 프롭 기본값 그대로
    v2Spread: 1.10, v2Stagger: 1.4, v2CardScale: 1.05, v2EdgePadding: 7, v2FrontCards: [3, 4],
    // 타이틀 퇴장(디자인에 없는 자체 모션). 사진 몇 장이 아직 올라가는 0.81 에서 시작해
    // 핀이 풀리는 1.0 에서 정확히 0 — 글씨가 걷히는 것과 다음 섹션이 올라오는 게 이어진다.
    onsiteTitleFadeFrom: 0.81, onsiteTitleLift: 34
  };

  // 휴대폰 폭. styles.css 의 '좁은 화면' 블록과 같은 미디어쿼리 문자열이어야 한다.
  // 이 폭에서는 핀·스냅·관성 스크롤을 만들지 않는다 (setupScrollModes)
  var NARROW_MQ = "(max-width: 759.98px)";
  var narrowMq = window.matchMedia(NARROW_MQ);
  var clamp = function (v, lo, hi) { return Math.min(Math.max(v, lo), hi); };
  var isNarrow = function () { return narrowMq.matches; };
  var $ = function (sel) { return document.querySelector(sel); };
  var reduced = function () { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  // easeOutExpo — 끝에서 길게 감속하는 "쫀득한" 커브
  var easeOutExpo = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  // easeInOutCubic — 스냅용. 0 속도에서 출발해 0 속도로 멈춘다
  var easeInOutCubic = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var lenis = null;


  /* ============ 헤더 ============ */

  var hdr = $("#hdr");
  var lastY, headerHidden = false;

  function updateHeader(y) {
    if (!hdr) return;
    if (menuOpen) return;   // 메뉴가 열린 동안은 숨기지도, 판을 바꾸지도 않는다
    if (lastY === undefined) headerHidden = false;
    else if (Math.abs(y - lastY) >= 6) headerHidden = y > lastY && y > 140;
    if (y <= 140) headerHidden = false;
    lastY = y;
    hdr.classList.toggle("is-hidden", headerHidden);
    hdr.classList.toggle("is-solid", y > 80);
  }

  // 좁은 화면의 전체 화면 메뉴. 같은 nav 를 CSS 가 메뉴판으로 바꾸고, 여기서는 열고 닫기만 한다
  var menuBtn = $("#hdrMenu");
  var menuOpen = false;

  function setMenu(open) {
    if (!hdr || !menuBtn || open === menuOpen) return;
    menuOpen = open;
    hdr.classList.toggle("is-open", open);
    if (open) hdr.classList.remove("is-hidden");
    document.documentElement.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    if (!open) updateHeader(currentScroll());
  }

  function bindMenu() {
    if (!menuBtn) return;
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) { setMenu(false); menuBtn.focus(); }
    });
    // 메뉴 안의 링크를 누르면 닫는다 (같은 페이지 앵커일 때 메뉴가 남지 않게)
    var nav = $("#hdrNav");
    if (nav) nav.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) setMenu(false);
    });
    // 넓은 화면으로 돌아가면 메뉴판 자체가 사라지므로 상태도 닫아 둔다
    narrowMq.addEventListener("change", function () { if (!isNarrow()) setMenu(false); });
  }


  /* ============ 히어로 — 크로스페이드 + 천천히 밀려드는 확대 ============
     디자인은 리렌더를 피하려고 DOM 스타일을 직접 쓴다. 그 방식을 그대로 옮겼다.
     확대(transform)는 노출 시간 + 페이드 시간에 걸쳐 끝나므로 장이 바뀌는 순간까지
     멈추지 않고 계속 밀려든다. 꺼질 때는 페이드가 끝난 뒤(1.6s 지연) 원위치로 되돌린다. */

  var heroSlides = $("#heroSlides");
  var heroIdx = 0, heroTimer = null;

  function showHero(i) {
    if (!heroSlides) return;
    var push = TUNING.heroInterval + TUNING.heroFade;
    Array.prototype.forEach.call(heroSlides.children, function (el, k) {
      var on = k === i;
      var fx = el.classList.contains("hero__slide--flip") ? "scaleX(-1) " : "";
      el.style.opacity = on ? String(TUNING.heroOpacity) : "0";
      el.style.transform = fx + (on ? "scale(" + TUNING.heroPushTo + ")" : "scale(1)");
      el.style.transition = on
        ? "opacity " + TUNING.heroFade + "s ease, transform " + push + "s linear"
        : "opacity " + TUNING.heroFade + "s ease, transform 0s linear " + TUNING.heroFade + "s";
    });
  }

  function startHero() {
    if (!heroSlides) return;
    var n = heroSlides.children.length;
    // 움직임을 줄여 달라고 했으면 첫 장만 띄우고 끝낸다
    if (reduced() || n < 2) {
      if (heroSlides.firstElementChild) {
        heroSlides.firstElementChild.style.opacity = String(TUNING.heroOpacity);
      }
      return;
    }
    clearInterval(heroTimer);
    showHero(heroIdx);
    heroTimer = setInterval(function () {
      heroIdx = (heroIdx + 1) % n;
      showHero(heroIdx);
    }, TUNING.heroInterval * 1000);
  }


  /* ============ PROCESS — 핀 진행도로 단계가 하나씩 켜진다 ============ */

  var procBar = $("#procBar");
  var procCards = $("#procCards");

  // 단계마다 막대가 닿는 곳 = 그 단계 문단 글자의 오른쪽 끝(레일 폭 대비 비율).
  // 예전 고정값 .16/.5/.83 은 문단 중간에 걸렸다. 카드가 한 줄에 나란히 있지 않은
  // 좁은 화면에서는 글자 끝으로 단계를 가를 수 없으니 그 고정값을 그대로 쓴다.
  var PROC_FALLBACK = [0.16, 0.5, 0.83];
  var procEnds = PROC_FALLBACK, procDirty = true, procLastP = 0;

  function measureProcess() {
    procDirty = false;
    procEnds = PROC_FALLBACK;
    var rail = procBar.parentNode.getBoundingClientRect();
    var cards = procCards.children;
    if (!rail.width || cards.length < 3) return;
    var top0 = cards[0].offsetTop;
    for (var i = 1; i < cards.length; i++) if (cards[i].offsetTop !== top0) return;
    var range = document.createRange();
    procEnds = Array.prototype.map.call(cards, function (el) {
      range.selectNodeContents(el);   // 블록 폭이 아니라 실제 글자들이 차지한 폭
      return clamp((range.getBoundingClientRect().right - rail.left) / rail.width, 0, 1);
    });
  }

  function renderProcess(p) {
    if (!procBar || !procCards) return;
    procLastP = p;
    // 좁은 화면은 setupNarrowReveal 이 단계를 켠다. 여기서 건드리면 글꼴 로드 뒤 다시 재기(p=0)가
    // 01 을 미리 켜 버려, 01 만 선이 차오르는 동작 없이 처음부터 켜진 채로 보인다
    if (isNarrow()) return;
    if (procDirty) measureProcess();
    var step = p >= 0.62 ? 3 : p >= 0.28 ? 2 : 1;
    // 폭이 아니라 scaleX 로 늘린다 — 레이아웃 재계산 없이 GPU 에서 움직여 스프링 곡선이 끊기지 않는다 (styles.css .proc__bar)
    procBar.style.transform = "scaleX(" + procEnds[step - 1] + ")";
    Array.prototype.forEach.call(procCards.children, function (el, i) {
      el.classList.toggle("is-on", i < step);
    });
  }


  /* ============ ON SITE — 핀 진행도로 폴라로이드가 떠오른다 ============ */

  var V2_LAYOUT = [
    { x: 12, w: 17, y0: 62,  speed: 205, rot: -1 },
    { x: 84, w: 15, y0: 96,  speed: 250, rot: 2 },
    { x: 26, w: 13, y0: 150, speed: 290, rot: 1.5 },
    { x: 71, w: 18, y0: 132, speed: 232, rot: -2 },
    { x: 7,  w: 14, y0: 205, speed: 330, rot: 1 },
    { x: 90, w: 12, y0: 250, speed: 365, rot: -1.5 },
    { x: 46, w: 13, y0: 300, speed: 400, rot: 0.8 }
  ];

  var onsiteTrack = $("#onsiteTrack");
  var onsiteTitle = $("#onsiteTitle");

  // 가로 배치는 화면 폭에만 의존 — 리프레시 때만 계산한다
  function layoutOnsite() {
    if (!onsiteTrack) return;
    // 좁은 화면은 핀 없이 CSS 2열 격자다 — 넓은 화면에서 넣었던 좌표를 걷어 내고 끝낸다
    if (isNarrow()) { clearOnsite(); return; }
    Array.prototype.forEach.call(onsiteTrack.children, function (el, i) {
      var c = V2_LAYOUT[i % V2_LAYOUT.length];
      // 1번(가로 사진)과 7번은 다른 카드보다 넓다
      var w = c.w * TUNING.v2CardScale *
              (i === 6 ? 1.3 : i === 0 ? 1.2 : 1);
      var pad = TUNING.v2EdgePadding;
      var cx = clamp(
        50 + (c.x - 50) * TUNING.v2Spread,
        Math.min(pad + w / 2, 50),
        Math.max(100 - pad - w / 2, 50)
      );
      // 7번은 왼쪽으로 25px, 4번은 오른쪽으로 50px 밀어 타이틀과 겹치는 자리를 조정한다
      el.style.left = "calc(" + cx.toFixed(2) + "% - " + (i === 6 ? 25 : i === 3 ? -50 : 0) + "px)";
      el.style.width = w.toFixed(1) + "vw";
      el.style.zIndex = TUNING.v2FrontCards.indexOf(i + 1) >= 0 ? "30" : "5";
    });
  }

  // 핀 진행도(0~1)를 그대로 쓴다. 디자인의 sticky 진행도와 같은 값이므로
  // 사진이 시작 위치에서 speed 만큼 정확히 올라가고 거기서 핀이 풀린다.
  function clearOnsite() {
    Array.prototype.forEach.call(onsiteTrack.children, function (el) { el.removeAttribute("style"); });
    if (onsiteTitle) onsiteTitle.removeAttribute("style");
  }

  function renderOnsite(p) {
    if (!onsiteTrack || isNarrow()) return;
    var g = TUNING.v2Stagger;

    Array.prototype.forEach.call(onsiteTrack.children, function (el, i) {
      var c = V2_LAYOUT[i % V2_LAYOUT.length];
      var y = c.y0 * g - p * c.speed * g;
      el.style.transform = "translate(-50%,0) translateY(" + y.toFixed(2) + "vh) rotate(" + c.rot + "deg)";
      el.style.opacity = String(clamp((100 - (50 + y)) / 14, 0, 1));
    });

    // 디자인 v2 의 타이틀은 고정이지만, 우리는 이 섹션이 스냅 단위라 핀이 풀리는 순간
    // 다음 화면이 곧바로 올라온다. 글씨가 그대로 남아 있으면 그 전환이 뚝 끊긴다.
    // 마지막 사진들이 빠지는 구간에 맞춰 같이 걷어 낸다.
    if (onsiteTitle) {
      var from = TUNING.onsiteTitleFadeFrom;
      var f = clamp((p - from) / (1 - from), 0, 1);
      onsiteTitle.style.opacity = String(1 - f);
      onsiteTitle.style.transform = "translateY(" + (-TUNING.onsiteTitleLift * f).toFixed(1) + "px)";
    }
  }


  /* ============ WHAT WE DO — 스퀴즈 캐러셀 ============ */

  var clip = $("#bizClip");
  var strip = $("#bizStrip");
  var openIdx = 0, hoverIdx = null, dragX = null, dragged = false, hoverTimer = null;

  function cancelHoverOpen() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  }

  var WIDE_BIZ = {
    activeFlex: TUNING.activeFlex, neighborFlex: TUNING.neighborFlex, foldedFlex: TUNING.foldedFlex,
    foldedMin: 30, cardGap: TUNING.cardGap, foldedSlatGap: TUNING.foldedSlatGap
  };

  // 좁은 화면은 아코디언이 아니라 한 장씩 넘기는 슬라이드다. 스트립이 직접 가로로 스크롤되고
  // (CSS scroll-snap — 페이지 스크롤이 아니라 이 상자 안의 가로 스크롤이라 핀·Lenis 와 겹치지 않는다),
  // 손가락으로 밀면 브라우저 기본 관성 그대로 다음 카드에 붙는다. 화살표·카운터는 스크롤 위치를 따른다.
  function cardOffset(i) {
    var panels = strip.children;
    return panels[i].offsetLeft - panels[0].offsetLeft;
  }

  function scrollToCard(i, instant) {
    openIdx = clamp(i, 0, strip.children.length - 1);
    strip.scrollTo({ left: cardOffset(openIdx), behavior: instant || reduced() ? "auto" : "smooth" });
    syncSlideUi();
  }

  function syncSlideUi() {
    var n = strip.children.length;
    var prevBtn = $("#bizPrev"), nextBtn = $("#bizNext"), count = $("#bizCount");
    if (prevBtn) prevBtn.disabled = openIdx === 0;
    if (nextBtn) nextBtn.disabled = openIdx === n - 1;
    if (count) count.textContent = ("0" + (openIdx + 1)).slice(-2) + " / " + ("0" + n).slice(-2);
  }

  // 아코디언이 넣어 둔 인라인 폭·투명도를 걷고, 모든 카드에 펼친 상태의 글(제목·설명)을 띄운다
  function applySlides() {
    Array.prototype.forEach.call(strip.children, function (el, i) {
      el.style.flexGrow = el.style.flexBasis = el.style.minWidth = el.style.marginLeft = el.style.opacity = "";
      el.setAttribute("aria-expanded", String(i === openIdx));
      var bg = el.children[0];
      if (bg) bg.style.width = "";
      Array.prototype.forEach.call(el.querySelectorAll("[data-role]"), function (ov) {
        ov.style.opacity = ov.dataset.role === "active" ? "1" : "0";
      });
    });
    // 폭이 바뀌면 카드 폭도 바뀐다 — 보고 있던 카드에 다시 맞춘다
    if (strip.children.length) strip.scrollLeft = cardOffset(clamp(openIdx, 0, strip.children.length - 1));
    syncSlideUi();
  }

  function bindSlideScroll() {
    var raf = 0;
    strip.addEventListener("scroll", function () {
      if (!isNarrow() || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var step = strip.children.length > 1 ? cardOffset(1) : 1;
        var i = clamp(Math.round(strip.scrollLeft / step), 0, strip.children.length - 1);
        if (i !== openIdx) { openIdx = i; syncSlideUi(); }
      });
    }, { passive: true });
  }

  function applyGeometry() {
    if (!strip || !clip) return;
    if (isNarrow()) { applySlides(); return; }
    strip.scrollLeft = 0;   // 좁은 화면에서 밀어 둔 가로 스크롤이 남지 않게
    var panels = Array.prototype.slice.call(strip.children);
    var n = panels.length;
    var W = clip.clientWidth;
    if (!n || !W) return;
    var G = WIDE_BIZ;

    // 감싸지 않고 양 끝에서 멈춘다 — 첫/마지막 카드도 이웃을 정확히 하나만 갖도록
    openIdx = clamp(openIdx, 0, n - 1);
    // 양 끝에서는 더 넘길 카드가 없으니 그쪽 화살표를 끈다
    var prevBtn = $("#bizPrev"), nextBtn = $("#bizNext");
    if (prevBtn) prevBtn.disabled = openIdx === 0;
    if (nextBtn) nextBtn.disabled = openIdx === n - 1;
    var roles = panels.map(function (_, i) {
      return i === openIdx ? "active" : Math.abs(i - openIdx) === 1 ? "neighbor" : "folded";
    });

    var margins = panels.map(function (_, i) {
      if (i === 0) return 0;
      return roles[i] === "folded" && roles[i - 1] === "folded" ? G.foldedSlatGap : G.cardGap;
    });
    // 접힌 슬랫과 반쯤 접힌 이웃 카드 모두 마우스를 올리면 미리보기로 넓어진다.
    // 배율이 다른 건 출발 폭이 달라서다 — 같은 배율을 쓰면 이웃 카드가 펼친 카드를 먹는다.
    var grows = panels.map(function (_, i) {
      var role = roles[i];
      var base = role === "active" ? G.activeFlex
               : role === "neighbor" ? G.neighborFlex
               : G.foldedFlex;
      if (!TUNING.hoverGrow || hoverIdx !== i) return base;
      if (role === "folded") return base * TUNING.hoverGrowFolded;
      if (role === "neighbor") return base * TUNING.hoverGrowNeighbor;
      return base;
    });

    var free = Math.max(W - margins.reduce(function (a, b) { return a + b; }, 0), 0);
    var total = grows.reduce(function (a, b) { return a + b; }, 0) || 1;
    var activeW = Math.round((free * grows[openIdx]) / total);

    panels.forEach(function (el, i) {
      el.style.flexGrow = String(grows[i]);
      el.style.flexBasis = "0%";
      el.style.minWidth = roles[i] === "folded" ? G.foldedMin + "px" : "0";
      el.style.marginLeft = margins[i] + "px";
      el.style.opacity = roles[i] === "folded" ? "0.85" : "1";
      el.setAttribute("aria-expanded", String(i === openIdx));
      // 배경은 펼쳤을 때 폭으로 고정 — 접혀도 사진이 찌그러지지 않는다
      var bg = el.children[0];
      if (bg) bg.style.width = activeW + "px";
      var shown = roles[i];
      Array.prototype.forEach.call(el.querySelectorAll("[data-role]"), function (ov) {
        ov.style.opacity = ov.dataset.role === shown ? "1" : "0";
      });
    });
  }

  function bindCarousel() {
    if (!strip) return;
    Array.prototype.forEach.call(strip.children, function (el, i) {
      el.addEventListener("click", function () {
        if (dragged) return;
        cancelHoverOpen();
        // 좁은 화면: 옆에 살짝 걸친 다음 카드를 누르면 그 카드로 넘어간다
        if (isNarrow()) { scrollToCard(i); return; }
        openIdx = i; applyGeometry();
      });

      // 접힌 슬랫 위에 올리면 먼저 살짝 넓어지며 미리보기를 주고(hoverGrow),
      // 그대로 hoverOpenDelay 만큼 머무르면 클릭 없이 펼쳐진다.
      // pointerenter + 마우스만 — 터치 탭은 mouseenter 를 흉내 내면서 mouseleave 는 보내지 않아,
      // 손가락으로 누른 카드가 미리보기 배율을 계속 달고 다녔다
      el.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse" || isNarrow()) return;
        hoverIdx = i;
        applyGeometry();
        cancelHoverOpen();
        if (i === openIdx) return;
        hoverTimer = setTimeout(function () {
          hoverTimer = null;
          if (hoverIdx !== i) return;   // 그새 벗어났으면 취소
          openIdx = i;
          applyGeometry();
        }, TUNING.hoverOpenDelay);
      });

      el.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse") return;
        if (hoverIdx === i) hoverIdx = null;
        cancelHoverOpen();
        applyGeometry();
      });
    });

    strip.addEventListener("pointerdown", function (e) {
      cancelHoverOpen();
      dragX = e.clientX; dragged = false;
    });
    var end = function (e) {
      if (dragX == null) return;
      var dx = e.clientX - dragX;
      dragX = null;
      if (Math.abs(dx) < 40) return;
      // 좁은 화면의 터치는 브라우저 가로 스크롤 + 스냅이 처리한다. 마우스로 끈 경우만 한 장 넘긴다
      if (isNarrow() && e.pointerType !== "mouse") return;
      dragged = true;
      setTimeout(function () { dragged = false; }, 0);
      if (isNarrow()) { scrollToCard(openIdx + (dx < 0 ? 1 : -1)); return; }
      openIdx = clamp(openIdx + (dx < 0 ? 1 : -1), 0, strip.children.length - 1);
      applyGeometry();
    };
    strip.addEventListener("pointerup", end);
    strip.addEventListener("pointercancel", end);

    var prev = $("#bizPrev"), next = $("#bizNext");
    var go = function (d) {
      cancelHoverOpen();
      if (isNarrow()) { scrollToCard(openIdx + d); return; }
      openIdx += d; applyGeometry();
    };
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    bindSlideScroll();

    predecodeCarousel();
    introCarousel();
  }

  // 카드 배경은 CSS background 라 화면에 처음 그려지는 순간 디코딩된다 — 첫 등장 때 한 번
  // 끊기던 원인. 같은 주소를 Image 로 받아 decode() 로 미리 풀어 두고, 캐시에서 밀려나지 않도록
  // Image 객체를 붙잡아 둔다.
  // 시점: 예전엔 섹션이 한 화면 앞에 오면 7장을 한꺼번에 풀었는데, PROCESS 핀 구간 때문에 그 지점이
  // 하필 히어로 → PROCESS 전환(스크롤 ≈1,150px)과 겹쳐 첫 방문에만 프레임이 떨어졌다.
  // 이제는 페이지 load 뒤 브라우저가 한가할 때(사용자가 히어로를 보는 동안) 한 장씩 나눠 푼다.
  var predecoded = [];
  function predecodeCarousel() {
    if (!strip) return;
    var urls = Array.prototype.map.call(strip.querySelectorAll(".panel__bg"), function (bg) {
      var m = /url\(["']?([^"')]+)["']?\)/.exec(bg.style.backgroundImage || "");
      return m && m[1];
    }).filter(Boolean);
    var idle = window.requestIdleCallback
      // 히어로 슬라이드·관성 스크롤이 매 프레임 돌아 한가한 틈이 드물다 — 0.6초 넘게 못 찾으면 그냥 진행
      ? function (fn) { window.requestIdleCallback(fn, { timeout: 600 }); }
      : function (fn) { setTimeout(fn, 200); };
    // 한가한 틈마다 한 장씩 시작한다 — 한꺼번에 몰리지 않는다.
    // decode() 완료를 기다리지 않는다: 환경에 따라 promise 가 늦게 오거나 안 와서 사슬이 끊길 수 있다
    var next = function () {
      var u = urls.shift();
      if (!u) return;
      var img = new Image();
      img.decoding = "async";
      img.src = u;
      predecoded.push(img);
      if (img.decode) img.decode().catch(function () {});
      idle(next);
    };
    var start = function () { idle(next); };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }

  // 첫 등장 — 카드가 왼쪽 것부터 하나씩 투명도가 차오르며 나타난다(motion.css [data-intro]).
  // 제목 리빌(revealStagger)이 먼저 시작하도록 첫 카드도 DELAY 만큼 기다린다.
  function introCarousel() {
    if (!strip || !document.documentElement.classList.contains("motion")) return;
    var section = $("#biz");
    var panels = strip.children;
    // 첫 카드가 차오르기 시작해 마지막 카드가 다 차오르기까지 ≈ 1초 = (n-1) × STEP + DUR
    var DELAY = 200, DUR = 500;
    var STEP = Math.round((1000 - DUR) / Math.max(panels.length - 1, 1));   // 7장 → 83ms
    strip.setAttribute("data-intro", "");
    Array.prototype.forEach.call(panels, function (el, i) {
      el.style.setProperty("--intro-d", (DELAY + i * STEP) + "ms");
      el.style.setProperty("--intro-dur", DUR + "ms");
    });
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      strip.removeAttribute("data-intro");
      // 등장이 끝나면 지연을 걷어 낸다 — 남겨 두면 다음 등장 때까지 아무 영향이 없지만 깔끔하게
      setTimeout(function () {
        Array.prototype.forEach.call(panels, function (el) {
          el.style.removeProperty("--intro-d");
          el.style.removeProperty("--intro-dur");
        });
      }, DELAY + panels.length * STEP + DUR);
    }, { threshold: 0.4 });
    io.observe(section || strip);
  }


  /* ============ PARTNERS — 로고 마키 3줄 ============ */

  var MARQUEE_ROWS = 3;
  var LOGOS = [
    ["l01", "EBS 한국교육방송공사"], ["l08", "육군교육사령부"],     ["l02", "SK플래닛"],
    ["l09", "경상남도교육청"],       ["l10", "한국과학창의재단"],   ["l14", "한국청소년정책연구원"],
    ["l07", "독거노인종합지원센터"], ["l04", "강원특별자치도"],     ["l03", "한국수자원공사"],
    ["l16", "화성시"],               ["l11", "디지털새싹"],         ["l12", "서울디지털재단"],
    ["l17", "EBS미디어"],            ["l18", "제주평생교육장학진흥원"], ["l15", "S2B 학교장터"],
    ["l05", "티처빌"],               ["l06", "협력 기관"],          ["l13", "평화IS"],
    ["l20", "i-Scream edu"],         ["l19", "neopia"],             ["l27", "상승이상 MiCo School"],
    ["l21", "MiCo"],                 ["l22", "KoMiCo"],             ["l23", "MiCo Ceramics"],
    ["l24", "MiCoPower"],            ["l25", "MiCo HighTech"],      ["l26", "현대중공업파워시스템"]
  ];

  function buildMarquee() {
    var wrap = $("#marquee");
    if (!wrap) return;
    var per = Math.ceil(LOGOS.length / MARQUEE_ROWS);
    for (var r = 0; r < MARQUEE_ROWS; r++) {
      var items = LOGOS.slice(r * per, (r + 1) * per);
      if (!items.length) continue;
      var row = document.createElement("div");
      row.className = "marquee__row";
      var track = document.createElement("div");
      track.className = "marquee__track";
      // 끊김 없이 이어지도록 같은 묶음을 두 번 넣고 -50% 까지만 흘린다
      items.concat(items).forEach(function (pair, i) {
        var cell = document.createElement("div");
        cell.className = "marquee__cell";
        var img = document.createElement("img");
        img.src = "assets/logos/" + pair[0] + ".png";
        img.loading = "lazy";
        img.decoding = "async";
        // 뒤쪽 복제본은 스크린리더에 중복으로 읽히지 않게 비워 둔다
        if (i < items.length) { img.alt = pair[1]; }
        else { img.alt = ""; img.setAttribute("aria-hidden", "true"); }
        cell.appendChild(img);
        track.appendChild(cell);
      });
      row.appendChild(track);
      wrap.appendChild(row);
    }
  }


  /* ============ 리빌 — 섹션이 들어오면 그 안을 차례로 켠다 ============ */

  function setupReveal() {
    if (!document.documentElement.classList.contains("motion")) return;
    // "섹션의 40% 가 보이면" 이 기준이다. 다만 좁은 화면에서 높이 규격을 푼 섹션은 화면의
    // 2.5배를 넘기도 해서 40% 가 영영 안 보일 수 있다 — 그때는 화면의 40% 를 채우면 켠다.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var vh = e.rootBounds ? e.rootBounds.height : window.innerHeight;
        if (e.intersectionRatio < 0.4 && e.intersectionRect.height < vh * 0.4) return;
        Array.prototype.forEach.call(e.target.querySelectorAll("[data-reveal]"), function (el, i) {
          el.style.setProperty("--d", i * TUNING.revealStagger + "ms");
          el.classList.add("is-in");
        });
        io.unobserve(e.target);
      });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4] });
    // 핀 섹션은 .pin-spacer 안으로 들어가므로 자식 결합자를 쓰지 않는다
    Array.prototype.forEach.call(document.querySelectorAll("section, footer"), function (s) {
      io.observe(s);
    });
  }

  // 좁은 화면 전용 — 핀이 없으니 PROCESS 단계와 ON SITE 사진을 화면에 들어오는 대로 켠다.
  // 넓은 화면에서는 핀 진행도가 같은 클래스를 다루므로 건드리지 않고(관찰은 계속) 지나간다.
  function setupNarrowReveal() {
    if (!("IntersectionObserver" in window)) {
      if (procCards) Array.prototype.forEach.call(procCards.children, function (el) { el.classList.add("is-on"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (!isNarrow()) return;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add(e.target.classList.contains("step") ? "is-on" : "is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -18% 0px", threshold: 0.2 });
    var items = [].concat(
      procCards ? Array.prototype.slice.call(procCards.children) : [],
      onsiteTrack ? Array.prototype.slice.call(onsiteTrack.children) : []
    );
    // 다시 관찰을 걸면 첫 콜백이 지금 상태로 한 번 온다 — 창을 좁혔을 때 이미 화면 안에 있던
    // 사진이 스크롤 전까지 투명하게 남지 않게
    var observeAll = function () { items.forEach(function (el) { io.unobserve(el); io.observe(el); }); };
    observeAll();
    narrowMq.addEventListener("change", function () { if (isNarrow()) observeAll(); });
  }


  /* ============ 숫자 — 오도미터(슬라이드 릴) ============
     count-up.tsx 의 digitEffect="slide" 를 그대로 옮긴 것.

     자릿수마다 0~9 가 세로로 쌓인 릴을 두고, 값 하나를 0 → 목표까지 굴리면서
     각 릴을 translateY 로 민다. 핵심은 자릿수의 몫을 내림하지 않는 것 —
     (v / place) % 10 을 소수째까지 그대로 쓰기 때문에 릴이 칸 사이를 미끄러지고,
     일의 자리는 빠르게, 십의 자리는 10배 느리게 도는 오도미터가 된다.

     칸 높이는 1em, 미는 양도 em 이라 폰트 크기가 clamp 로 변해도 따로 잴 필요가 없다. */

  function makeOdoReel(parent) {
    var el = document.createElement("span");
    el.className = "odo";

    // 높이와 베이스라인을 잡아 주는 유령 글자
    var sizer = document.createElement("span");
    sizer.className = "odo__sizer";
    sizer.textContent = "0";
    sizer.setAttribute("aria-hidden", "true");
    el.appendChild(sizer);

    var reel = document.createElement("span");
    reel.className = "odo__reel";
    // 0~9 뒤에 0 을 한 번 더 — 9 에서 0 으로 넘어갈 때 이음매가 보이지 않는다
    for (var i = 0; i < 11; i++) {
      var cell = document.createElement("span");
      cell.textContent = String(i % 10);
      reel.appendChild(cell);
    }
    el.appendChild(reel);
    parent.appendChild(el);
    return reel;
  }

  function runOdometer(el) {
    var to = Number(el.getAttribute("data-count")) || 0;
    var text = to.toLocaleString("ko-KR");
    el.textContent = "";
    el.setAttribute("aria-label", text);

    var digitCount = text.replace(/[^0-9]/g, "").length;
    var reels = [];
    var seen = 0;

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch >= "0" && ch <= "9") {
        reels.push({
          reel: makeOdoReel(el),
          place: Math.pow(10, digitCount - 1 - seen)  // 1, 10, 100 …
        });
        seen++;
      } else {
        // 천 단위 쉼표는 구르지 않는 고정 글자
        var sep = document.createElement("span");
        sep.className = "odo-sep";
        sep.textContent = ch;
        el.appendChild(sep);
      }
    }

    var render = function (v) {
      reels.forEach(function (r) {
        var d = Math.abs(v) / r.place;
        var pos;
        if (r.place === 1) {
          // 일의 자리는 아래에 받쳐 줄 자리가 없으니 그냥 계속 구른다
          pos = d % 10;
        } else {
          // 윗자리는 바로 아래 릴이 9→0 으로 넘어가는 마지막 구간에서만 같이 돈다.
          // 이렇게 해야 멈췄을 때 숫자가 칸에 딱 맞는다 — 참조 컴포넌트는
          // 이 처리가 없어서 2,280 같은 수에서 천의 자리가 2.28 에 걸친다.
          var frac = d - Math.floor(d);
          var carry = TUNING.odoCarry;
          pos = (Math.floor(d) % 10) + (frac > carry ? (frac - carry) / (1 - carry) : 0);
        }
        r.reel.style.transform = "translateY(" + (-pos).toFixed(4) + "em)";
      });
    };

    // 참조 컴포넌트는 스프링을 쓰지만, 스프링은 목표에 영원히 도달하지 않아
    // 릴이 칸에 딱 맞지 않는다. 모양이 거의 같으면서 끝에서 정확히 멈추는 감속 곡선을 쓴다.
    // 두 구간으로 굴린다 — 목표 직전(목표 - tail)까지는 빠르게, 마지막 tail 칸은 tailDur 동안 한 칸씩.
    // 빠른 구간 감속 곡선은 끝 속도가 0 이라 그대로 이으면 한 번 멎었다가 다시 출발한다.
    // 그래서 직선을 조금 섞어(w) 빠른 구간이 끝나는 속도를 느린 구간의 출발 속도에 맞춘다.
    // data-count-from: 0 이 아닌 곳에서 출발(참여 학생 999 → 4,860).
    // data-count-dur: 이 숫자만 총 길이를 따로 정한다(ms) — 두 구간을 같은 비율로 늘리거나 줄인다
    var from = Number(el.getAttribute("data-count-from")) || 0;
    var span = to - from;
    render(from);
    var sign = span < 0 ? -1 : 1, abs = Math.abs(span);
    var tail = Math.min(TUNING.odoTail, abs);
    var fast = abs - tail;
    var tailDur = TUNING.odoTailDuration, q = TUNING.odoTailEase;
    var tailV = tail ? q * tail / tailDur : 0;               // 느린 구간 출발 속도(칸/ms)
    // 작은 수(13 등)는 빠른 구간이 오히려 느려지지 않게 그 길이를 줄인다
    var fastDur = fast ? Math.min(TUNING.odoDuration, tailV ? fast / tailV : TUNING.odoDuration) : 0;
    var durAttr = Number(el.getAttribute("data-count-dur"));
    if (durAttr > 0 && fastDur + tailDur > 0) {
      var scale = durAttr / (fastDur + tailDur);
      fastDur *= scale; tailDur *= scale; tailV /= scale;
    }
    var w = fast && tailV ? Math.min(tailV * fastDur / fast, 1) : 0;
    var valueAt = function (ms) {
      if (ms < fastDur) {
        var k = ms / fastDur;
        return fast * ((1 - w) * (1 - Math.pow(1 - k, TUNING.odoEase)) + w * k);
      }
      var s = tailDur ? Math.min((ms - fastDur) / tailDur, 1) : 1;
      return fast + tail * (1 - Math.pow(1 - s, q));
    };
    var total = fastDur + tailDur;
    var t0 = null;
    var step = function (t) {
      if (t0 === null) t0 = t;
      var ms = t - t0;
      render(from + sign * (ms >= total ? abs : valueAt(ms)));
      if (ms < total) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setupCount() {
    var nums = document.querySelectorAll("[data-count]");
    if (!nums.length) return;

    if (!("IntersectionObserver" in window) || reduced()) {
      Array.prototype.forEach.call(nums, function (el) {
        el.textContent = Number(el.getAttribute("data-count") || 0).toLocaleString("ko-KR");
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        runOdometer(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(nums, function (el) { io.observe(el); });
  }


  /* ============ 관성 스크롤 (Lenis) ============ */

  // 되돌리는 함수를 돌려준다 — 넓은 화면 ↔ 좁은 화면을 오갈 때 setupScrollModes 가 부른다
  function setupLenis() {
    if (typeof window.Lenis === "undefined" || reduced()) return function () {};
    var inst = lenis = new window.Lenis({
      duration: TUNING.lenisDuration,
      easing: easeOutExpo,
      smoothWheel: true,
      wheelMultiplier: TUNING.wheelMultiplier,
      touchMultiplier: TUNING.touchMultiplier
    });
    var tick = null, rafId = 0;
    if (hasGsap) {
      inst.on("scroll", window.ScrollTrigger.update);
      tick = function (time) { inst.raf(time * 1000); };
      window.gsap.ticker.add(tick);
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { inst.raf(t); rafId = requestAnimationFrame(raf); };
      rafId = requestAnimationFrame(raf);
    }
    return function () {
      if (tick) window.gsap.ticker.remove(tick);
      if (rafId) cancelAnimationFrame(rafId);
      inst.destroy();
      if (lenis === inst) lenis = null;
    };
  }

  function currentScroll() { return lenis ? lenis.scroll : window.scrollY; }


  /* ============ 핀 구간 (ScrollTrigger) ============ */

  var pinRanges = [];
  var sectionTriggers = [];

  function setupPins() {
    var ST = window.ScrollTrigger;

    // anticipatePin 은 쓰지 않는다 — 브라우저 기본 스크롤용 옵션이라, Lenis 가 스크롤을 직접 굴리는
    // 여기서는 고정이 몇 프레임 일찍 걸려 히어로 → PROCESS 전환 순간 한 번 덜컥했다
    var procPin = ST.create({
      trigger: ".proc",
      start: "top top",
      end: function () { return "+=" + Math.round(window.innerHeight * TUNING.procScroll); },
      pin: true,
      pinSpacing: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) { renderProcess(self.progress); },
      onRefresh: function (self) { procDirty = true; renderProcess(self.progress); }
    });

    var onsitePin = ST.create({
      trigger: ".onsite",
      start: "top top",
      end: function () { return "+=" + Math.round(window.innerHeight * TUNING.onsiteScroll); },
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) { renderOnsite(self.progress); },
      onRefresh: function (self) { layoutOnsite(); renderOnsite(self.progress); }
    });

    pinRanges = [procPin, onsitePin];

    // 스냅 지점은 [data-screen] 이다. 지금은 핀 섹션 둘에만 붙어 있다 — 핀 시작점에
    // 정확히 들어가야 단계/사진 진행이 처음부터 보이기 때문이다. 다른 섹션에 스냅을
    // 되살리려면 index.html 에서 그 섹션에 data-screen 만 다시 붙이면 된다.
    sectionTriggers = Array.prototype.map.call(
      document.querySelectorAll("[data-screen]"),
      function (el) {
        var t = ST.create({ trigger: el, start: "top top", end: "bottom top" });
        t.vars.el = el;
        return t;
      }
    );
  }

  /* 넓은 화면 = 관성 스크롤 + 핀 + 스냅. 좁은 화면 = 브라우저 기본 스크롤뿐.
     gsap.matchMedia 컨텍스트 안에서 만든 ScrollTrigger 는 폭이 경계를 넘을 때 GSAP 가
     알아서 되돌린다(pin-spacer 까지 걷힘). Lenis 와 스냅 목록은 여기서 직접 되돌린다. */
  function setupScrollModes() {
    if (!hasGsap) {
      if (!isNarrow()) setupLenis();
      return;
    }
    window.gsap.matchMedia().add("not all and " + NARROW_MQ, function () {
      var undoLenis = setupLenis();
      setupPins();
      return function () {
        undoLenis();
        pinRanges = [];
        sectionTriggers = [];
      };
    });
    window.ScrollTrigger.addEventListener("refresh", function () { applyGeometry(); });
  }


  /* ============ 스냅 ============ */

  var snapping = false, snapTimer = null, snapRelease = null;

  function scrollToY(y) {
    y = Math.round(y);
    snapping = true;
    if (snapRelease) clearTimeout(snapRelease);
    // 사용자가 도중에 휠을 돌리면 애니메이션이 취소되고 onComplete 가 안 올 수 있다
    snapRelease = setTimeout(function () { snapping = false; }, TUNING.snapDuration * 1000 + 400);

    var done = function () { snapping = false; };
    // 스냅은 거의 멈춘 상태에서 출발하므로 천천히 출발해 천천히 멈추는 곡선을 쓴다.
    // 예전 easeOutExpo 는 출발 순간이 가장 빨라, 멎어 가던 화면이 갑자기 튀어 나가며 끊겨 보였다.
    if (lenis) {
      lenis.scrollTo(y, { duration: TUNING.snapDuration, easing: easeInOutCubic, onComplete: done });
    } else if (hasGsap && window.ScrollToPlugin) {
      window.gsap.to(window, {
        scrollTo: { y: y, autoKill: true },
        duration: TUNING.snapDuration, ease: "power3.inOut", onComplete: done
      });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function trySnap() {
    if (snapping || reduced() || !sectionTriggers.length) return;
    // 관성 스크롤이 아직 미끄러지는 중이면 기다린다. 관성 끝자락은 프레임당 1px 도 안 움직여
    // 스크롤 이벤트가 90ms 넘게 끊기기도 하는데, 예전엔 그걸 '멈춤'으로 보고 스냅을 덮어씌워
    // 속도가 꺾이며 끊겨 보였다(히어로 → PROCESS). 실제 속도가 snapVelocity 아래로 떨어질 때까지 다시 확인한다.
    if (lenis && lenis.isScrolling && Math.abs(lenis.velocity) > TUNING.snapVelocity) { onScrollIdle(); return; }
    var y = currentScroll();
    var vh = window.innerHeight;
    if (y + vh >= document.documentElement.scrollHeight - 2) return;

    // 핀 구간 안에서는 절대 건드리지 않는다. 단계가 끝까지 가도록 스크롤을 놔둔다.
    for (var i = 0; i < pinRanges.length; i++) {
      if (y > pinRanges[i].start + 8 && y < pinRanges[i].end - 8) return;
    }

    var target = null, bestD = Infinity;
    sectionTriggers.forEach(function (t) {
      var d = Math.abs(t.start - y);
      if (d < bestD) { bestD = d; target = t.start; }
    });

    // 핀 섹션이 화면의 절반 이상을 차지했을 때만 = 시작점이 반 화면 안일 때만 당긴다
    if (target === null || bestD < 2 || bestD > vh * TUNING.snapRange) return;
    scrollToY(target);
  }

  function onScrollIdle() {
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(trySnap, TUNING.snapIdle);
  }


  /* ============ 앵커 내비게이션 ============ */

  function bindNav() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href === "#") return;
      var el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      var hit = null;
      sectionTriggers.forEach(function (t) { if (t.vars.el === el) hit = t.start; });
      scrollToY(hit !== null ? hit : el.getBoundingClientRect().top + currentScroll());
    });
  }


  /* ============ 부팅 ============ */

  function init() {
    if (!hasGsap) document.documentElement.classList.add("no-gsap");
    // 플러그인 등록은 Lenis 가 ScrollTrigger.update 를 물기 전에 끝나 있어야 한다
    if (hasGsap) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      if (window.ScrollToPlugin) window.gsap.registerPlugin(window.ScrollToPlugin);
    }

    // 첫 프레임에 transition 이 함께 걸리면 초기 상태가 애니메이션으로 새어 나온다.
    // 한 프레임 미루면 브라우저가 초기 스타일을 먼저 확정한다.
    requestAnimationFrame(startHero);

    buildMarquee();
    bindCarousel();
    layoutOnsite();
    applyGeometry();
    setupReveal();
    setupNarrowReveal();
    setupCount();
    bindMenu();
    setupScrollModes();

    if (hasGsap) {
      bindNav();
    } else {
      // GSAP 없이도 내용은 읽히게 — 단계는 전부 켜 둔다
      renderProcess(1);
    }
    // 게이지 끝점은 글자 폭으로 잰다 — 웹폰트가 늦게 들어오거나 창 폭이 바뀌면 다시 잰다
    // (GSAP 이 있으면 리사이즈는 onRefresh 도 잡지만, 없을 때를 위해 여기서도 건다)
    var remeasureProcess = function () { procDirty = true; renderProcess(procLastP); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasureProcess);
    window.addEventListener("resize", remeasureProcess);

    updateHeader(currentScroll());
    window.addEventListener("scroll", function () {
      updateHeader(currentScroll());
      onScrollIdle();
    }, { passive: true });

    // 휴대폰은 스크롤할 때마다 주소창이 접혔다 펴지며 높이만 바뀐 resize 를 쏜다.
    // 좁은 화면에는 핀이 없어 높이에 기대는 계산이 없으니, 폭이 그대로면 아무것도 다시 하지 않는다
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      var sameW = window.innerWidth === lastW;
      lastW = window.innerWidth;
      if (sameW && isNarrow()) return;
      layoutOnsite();
      applyGeometry();
      if (hasGsap) window.ScrollTrigger.refresh();
    }, { passive: true });

    // 로고·사진이 늦게 뜨면서 높이가 바뀌면 핀 구간 계산을 다시 시킨다
    window.addEventListener("load", function () {
      layoutOnsite();
      applyGeometry();
      if (hasGsap) window.ScrollTrigger.refresh();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
