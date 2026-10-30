/* =========================================================
   오름에듀테크 v3 — 스크롤 끊김 디버거
   index.html?debug 로 열 때만 로드된다(index.html 의 로더). 평소 방문자에게는 영향 없음.

   하는 일:
     ① 매 프레임 간격을 재서, 평소(최근 중앙값)보다 크게 늘어난 프레임을 '끊김'으로 기록
     ② 끊김 순간의 상황 — 스크롤 위치, Lenis 속도, 핀(PROCESS·ON SITE) 상태
     ③ 직전 0.5초에 일어난 일 — 스냅(scrollTo), IntersectionObserver 발동, 이미지 decode·load,
        헤더 클래스 변화, 레이아웃 이동
     ④ Long Animation Frame API(크롬 123+) — 느린 프레임에서 시간을 쓴 스크립트·스타일/레이아웃·렌더 구간
   화면 왼쪽 아래 패널의 [복사] 로 전체 기록(JSON)을 클립보드에 담는다.
   app.js 보다 먼저, Lenis·GSAP 보다 뒤에 실행돼야 한다 — Lenis 생성자를 감싸 인스턴스를 붙잡기 때문.
   ========================================================= */
(function () {
  "use strict";

  /* ---- 실험 스위치 — 주소에 붙여 원인을 하나씩 끈다 (예: index.html?debug&noblur) ----
     noblur  : 헤더 배경 블러(backdrop-filter) 끔 — 배경은 같은 흰색 80%
     nolayer : 히어로 사진의 will-change 레이어 지정 끔
     nologo  : 로고 색 전환(filter) 애니메이션 끔
     solid   : 헤더를 처음부터 흰 배경 상태로 — 멈춤이 페이지 열 때로 옮겨 가는지 본다 */
  var EXP = {
    noblur: ".hdr.is-solid{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}",
    nolayer: ".hero__slide{will-change:auto!important}",
    nologo: ".hdr__brand img,.hdr__brand,.hdr__nav{transition:none!important}",
    solid: ""
  };
  var on = Object.keys(EXP).filter(function (k) { return new RegExp("[?&]" + k + "\\b").test(location.search); });
  if (on.length) {
    var css = on.map(function (k) { return EXP[k]; }).join("\n");
    if (css) document.write("<style>" + css + "</style>");
  }

  var T0 = performance.now();
  var events = [], janks = [], loafs = [];
  var lenis = null;
  var now = function () { return Math.round(performance.now() - T0); };
  var short = function (u) { try { return decodeURIComponent(String(u)).split("/").pop().slice(0, 40); } catch (e) { return String(u); } };

  function ev(type, detail) {
    events.push({ t: now(), y: Math.round(window.scrollY), type: type, d: detail });
    if (events.length > 3000) events.shift();
  }

  /* ---- Lenis 인스턴스 붙잡기 + 스냅(scrollTo) 기록 ---- */
  var OrigLenis = window.Lenis;
  if (OrigLenis) {
    window.Lenis = function (opts) {
      var inst = new OrigLenis(opts);
      lenis = inst;
      var st = inst.scrollTo.bind(inst);
      inst.scrollTo = function (target, o) {
        ev("scrollTo(스냅·앵커)", {
          to: typeof target === "number" ? Math.round(target) : String(target),
          from: Math.round(inst.scroll), velocity: +(inst.velocity || 0).toFixed(2),
          duration: o && o.duration
        });
        return st(target, o);
      };
      return inst;
    };
    window.Lenis.prototype = OrigLenis.prototype;
  }

  /* ---- IntersectionObserver 발동 (리빌·카운트·캐러셀 등장 등) ---- */
  var OrigIO = window.IntersectionObserver;
  if (OrigIO) {
    window.IntersectionObserver = function (cb, opt) {
      var tag = "IO(" + ((opt && opt.rootMargin) || "0") + ", th=" + ((opt && opt.threshold) || 0) + ")";
      return new OrigIO(function (entries, obs) {
        var hit = entries.filter(function (e) { return e.isIntersecting; });
        var s = performance.now();
        cb(entries, obs);
        if (hit.length) {
          ev("IntersectionObserver 발동", {
            io: tag, ms: +(performance.now() - s).toFixed(1),
            targets: hit.slice(0, 4).map(function (e) { return (e.target.id || String(e.target.className)).slice(0, 30); })
          });
        }
      }, opt);
    };
    window.IntersectionObserver.prototype = OrigIO.prototype;
  }

  /* ---- 이미지 decode()·load ---- */
  var origDecode = HTMLImageElement.prototype.decode;
  if (origDecode) {
    HTMLImageElement.prototype.decode = function () {
      var n = short(this.src), s = performance.now();
      ev("img.decode 시작", n);
      var p = origDecode.apply(this, arguments);
      p.then(function () { ev("img.decode 완료", { img: n, ms: Math.round(performance.now() - s) }); }, function () {});
      return p;
    };
  }
  document.addEventListener("load", function (e) {
    if (e.target && e.target.tagName === "IMG") ev("img load", short(e.target.currentSrc || e.target.src));
  }, true);

  /* ---- 레이아웃 이동 · Long Animation Frame · Long Task ---- */
  var types = (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes) || [];
  if (types.indexOf("layout-shift") > -1) {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (x) { if (x.value > 0.001) ev("layout-shift", +x.value.toFixed(4)); });
    }).observe({ type: "layout-shift", buffered: true });
  }
  if (types.indexOf("long-animation-frame") > -1) {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (f) {
        var item = {
          t: Math.round(f.startTime - T0), dur: Math.round(f.duration),
          blocking: Math.round(f.blockingDuration || 0),
          // 프레임 안에서 렌더(rAF·스타일·레이아웃·페인트 준비)가 시작된 시점 — 스크립트가 아니라 렌더가 길었는지 가늠
          renderStartAt: f.renderStart ? Math.round(f.renderStart - f.startTime) : null,
          styleLayoutStartAt: f.styleAndLayoutStart ? Math.round(f.styleAndLayoutStart - f.startTime) : null,
          scripts: (f.scripts || []).map(function (s) {
            return { src: short(s.sourceURL) + (s.sourceCharPosition > -1 ? "@" + s.sourceCharPosition : ""),
                     fn: s.sourceFunctionName || "", invoker: String(s.invoker || "").slice(0, 60),
                     dur: Math.round(s.duration), forcedLayout: Math.round(s.forcedStyleAndLayoutDuration || 0) };
          })
        };
        loafs.push(item);
        if (loafs.length > 300) loafs.shift();
      });
    }).observe({ type: "long-animation-frame", buffered: true });
  } else if (types.indexOf("longtask") > -1) {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (x) { loafs.push({ t: Math.round(x.startTime - T0), dur: Math.round(x.duration), longtask: true }); });
    }).observe({ type: "longtask", buffered: true });
  }

  /* ---- 핀 상태 · 헤더 클래스 ---- */
  function pinState() {
    var ST = window.ScrollTrigger;
    if (!ST || !ST.getAll) return "";
    return ST.getAll().filter(function (t) { return t.pin; }).map(function (t) {
      var id = (t.pin.id || t.pin.className || "").toString().split(" ")[0];
      return id + (t.isActive ? " 고정중 " + Math.round(t.progress * 100) + "%" : " -");
    }).join(" | ");
  }
  var lastPins = "";
  function watchHeader() {
    var hdr = document.getElementById("hdr");
    if (!hdr || !window.MutationObserver) return;
    var prev = hdr.className;
    new MutationObserver(function () {
      if (hdr.className !== prev) { ev("헤더 class", prev + " → " + hdr.className); prev = hdr.className; }
    }).observe(hdr, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---- 프레임 모니터 ---- */
  var last = 0, deltas = [], frames = 0;
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1] || 16.7; }
  function frame(ts) {
    frames++;
    if (last) {
      var d = ts - last;
      var base = median(deltas);
      // 평소 프레임의 1.8배 이상이면서 22ms 이상 — 60Hz 에선 한 프레임 이상 빠진 것, 120Hz 에선 두 프레임 이상
      if (deltas.length > 20 && d > Math.max(base * 1.8, 22)) {
        var t = now();
        janks.push({
          t: t, y: Math.round(window.scrollY), frameMs: Math.round(d), normalMs: +base.toFixed(1),
          dropped: Math.max(Math.round(d / base) - 1, 1),
          lenis: lenis ? { scroll: Math.round(lenis.scroll), velocity: +(lenis.velocity || 0).toFixed(2), isScrolling: lenis.isScrolling } : null,
          pins: pinState(),
          recent: events.filter(function (e) { return e.t >= t - 500; })
        });
      }
      deltas.push(d);
      if (deltas.length > 120) deltas.shift();
    }
    last = ts;
    var p = pinState();
    if (p !== lastPins) { ev("핀 상태", p); lastPins = p; }
    requestAnimationFrame(frame);
  }

  /* ---- 패널 ---- */
  var panel, out;
  function buildPanel() {
    panel = document.createElement("div");
    panel.setAttribute("style",
      "position:fixed;left:10px;bottom:10px;z-index:2147483647;width:340px;max-height:46vh;overflow:auto;" +
      "background:rgba(0,0,0,.82);color:#7CFFB2;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;" +
      "padding:8px 10px;border-radius:8px;pointer-events:auto;white-space:pre-wrap");
    var bar = document.createElement("div");
    bar.setAttribute("style", "display:flex;gap:6px;margin-bottom:6px");
    var mk = function (label, fn) {
      var b = document.createElement("button");
      b.textContent = label;
      b.setAttribute("style", "font:inherit;padding:2px 8px;border-radius:4px;border:1px solid #7CFFB2;background:none;color:#7CFFB2;cursor:pointer");
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(b); });
      bar.appendChild(b);
    };
    mk("복사", function (b) {
      var data = JSON.stringify(report(), null, 1);
      var done = function () { b.textContent = "복사됨 ✓"; setTimeout(function () { b.textContent = "복사"; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data).then(done, function () { fallbackCopy(data); done(); });
      else { fallbackCopy(data); done(); }
    });
    mk("초기화", function () { janks.length = 0; events.length = 0; loafs.length = 0; T0 = performance.now(); });
    mk("숨김", function () { panel.style.display = "none"; });
    out = document.createElement("div");
    panel.appendChild(bar);
    panel.appendChild(out);
    document.body.appendChild(panel);
    // D 키로 패널 보이기/숨기기
    document.addEventListener("keydown", function (e) { if (e.key === "d" || e.key === "D") panel.style.display = panel.style.display === "none" ? "" : "none"; });
    setInterval(render, 300);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  function render() {
    var base = median(deltas);
    var lines = [
      (on.length ? "실험: " + on.join(", ") + "\n" : "") +
      "fps≈" + Math.round(1000 / base) + "  끊김 " + janks.length + "회  y=" + Math.round(window.scrollY),
      "Lenis v=" + (lenis ? (+(lenis.velocity || 0)).toFixed(1) : "-") + "  " + pinState()
    ];
    janks.slice(-6).reverse().forEach(function (j) {
      var why = j.recent.map(function (e) { return e.type; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ");
      lines.push("· " + j.t + "ms y=" + j.y + "  " + j.frameMs + "ms(" + j.dropped + "프레임↓)" + (why ? "  ← " + why : ""));
    });
    out.textContent = lines.join("\n");
  }
  function report() {
    return {
      experiments: on,
      ua: navigator.userAgent, viewport: window.innerWidth + "x" + window.innerHeight, dpr: window.devicePixelRatio,
      normalFrameMs: +median(deltas).toFixed(1), frames: frames,
      janks: janks, longFrames: loafs, events: events
    };
  }

  function init() {
    watchHeader(); buildPanel(); requestAnimationFrame(frame);
    ev("debug 시작", { url: location.href, experiments: on });
    // solid — app.js 가 스크롤 위치로 is-solid 를 다시 계산하므로, 처음 한 번 붙여 두고 스크롤 전까지 유지
    if (on.indexOf("solid") > -1) {
      var hdr = document.getElementById("hdr");
      if (hdr) setTimeout(function () { hdr.classList.add("is-solid"); }, 50);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
