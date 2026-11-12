(function () {
  "use strict";
  var C = window.ClipCore;
  var $ = function (id) { return document.getElementById(id); };
  var LS_KEY = "clip-shelf-v1";

  // ---------- 저장 (기기 안 localStorage) ----------
  var clips = [];
  function load() {
    try {
      clips = (JSON.parse(localStorage.getItem(LS_KEY) || "[]") || []).map(C.normalizeClip).filter(Boolean);
    } catch (e) { clips = []; }
    sortClips();
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(clips)); return true; } catch (e) { return false; }
  }
  function sortClips() { clips.sort(function (a, b) { return b.createdAt - a.createdAt; }); }
  function newId() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function setHint(id, msg, isErr) {
    var h = $(id); h.textContent = msg || ""; h.className = "hint" + (isErr ? " err" : "");
  }

  // ---------- 목록 ----------
  var SEARCH_FROM = 8; // 클립이 이보다 많을 때만 검색칸을 보인다
  function renderList() {
    $("q").hidden = clips.length < SEARCH_FROM;
    var q = $("q").hidden ? "" : $("q").value.trim().toLowerCase();
    var shown = clips.filter(function (c) {
      return !q || [c.title, c.note, c.tags.join(" ")].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var list = $("list");
    list.textContent = "";
    if (!shown.length) {
      list.appendChild(el("p", { class: "empty", text: clips.length ? "검색 결과가 없어요" : "아직 저장한 클립이 없어요" }));
      return;
    }
    shown.forEach(function (c) {
      var img = el("img", { src: "https://i.ytimg.com/vi/" + c.videoId + "/mqdefault.jpg", alt: "", loading: "lazy" });
      img.addEventListener("error", function () { img.remove(); });
      var row = el("button", { class: "clip", type: "button" }, [
        el("div", { class: "thumb" }, [img]),
        el("div", { class: "cbody" }, [
          el("span", { class: "t" + (c.title ? "" : " untitled"), text: c.title || "제목 없음" }),
          el("span", { class: "tc", text: C.fmt(c.start) + " – " + C.fmt(c.end) + " · " + C.fmtLen(c.end - c.start) })
        ])
      ]);
      row.addEventListener("click", function () { openEditor({ clip: c }); });
      list.appendChild(row);
    });
  }

  // ---------- 플레이어 ----------
  var player = null, playerReady = false, ticker = null, apiPromise = null;
  var cur = null; // { videoId, clipId|null }

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = function () { apiPromise = null; reject(new Error("api")); };
      document.head.appendChild(s);
      setTimeout(function () { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error("timeout")); } }, 12000);
    });
    return apiPromise;
  }
  function playerMsg(msg) { var m = $("playerMsg"); m.textContent = msg || ""; m.hidden = !msg; }

  function range() {
    var s = C.parseTime($("start").value), e = C.parseTime($("end").value);
    return { s: s, e: e, ok: !isNaN(s) && !isNaN(e) && e > s };
  }
  function now() {
    try { return playerReady ? player.getCurrentTime() || 0 : 0; } catch (e) { return 0; }
  }
  function tick() {
    var t = now();
    $("now").textContent = C.fmt(t);
    var r = range();
    // 구간 재생 중 끝에 닿으면 시작으로 돌아가 반복한다.
    if (player && segmentOn && r.ok && t >= r.e) player.seekTo(r.s, true);
  }
  var segmentOn = false;
  function playSegment() {
    var r = range();
    if (!r.ok) return setHint("hint", "시작과 끝을 먼저 정해 주세요.", true);
    if (!playerReady || !player) return;
    segmentOn = true;
    player.seekTo(r.s, true);
    player.playVideo();
  }

  function mountPlayer(videoId, startAt, autoSegment) {
    playerReady = false; segmentOn = false;
    playerMsg("영상을 불러오는 중…");
    var host = $("player");
    loadApi().then(function () {
      if (!cur || cur.videoId !== videoId) return;
      if (player) { try { player.destroy(); } catch (e) {} player = null; }
      player = new YT.Player(host.id, {
        videoId: videoId,
        playerVars: { start: Math.floor(startAt || 0), playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: function (ev) {
            if (!player || ev.target !== player) return; // 준비되기 전에 화면을 닫은 경우
            playerReady = true; playerMsg("");
            if (!$("title").value) {
              try { $("title").value = (player.getVideoData() || {}).title || ""; } catch (e) {}
            }
            if (autoSegment) playSegment();
          },
          onError: function (ev) {
            var code = ev && ev.data;
            playerMsg(code === 101 || code === 150 || code === 153
              ? "이 영상은 앱 안에서 재생할 수 없게 설정되어 있습니다. 오른쪽 위 유튜브를 눌러 주세요."
              : "영상을 재생하지 못했습니다. 링크가 맞는지 확인해 주세요.");
          }
        }
      });
      clearInterval(ticker);
      ticker = setInterval(tick, 250);
    }, function () {
      if (cur && cur.videoId === videoId) playerMsg("유튜브에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 열어 주세요.");
    });
  }
  function unmountPlayer() {
    clearInterval(ticker); ticker = null; playerReady = false; segmentOn = false;
    if (player) { try { player.destroy(); } catch (e) {} player = null; }
  }

  // ---------- 편집 화면 ----------
  function showRange() {
    var r = range();
    $("startView").textContent = isNaN(r.s) ? "찍기" : C.fmt(r.s);
    $("endView").textContent = isNaN(r.e) ? "찍기" : C.fmt(r.e);
    if (!isNaN(r.s) && !isNaN(r.e) && !r.ok) return setHint("hint", "끝이 시작보다 뒤여야 해요.", true);
    setHint("hint", "");
  }

  function openEditor(opts) {
    var c = opts.clip;
    cur = { videoId: c ? c.videoId : opts.videoId, clipId: c ? c.id : null };
    $("clipForm").reset();
    $("start").value = c ? C.fmt(c.start) : (isNaN(opts.t) ? "" : C.fmt(opts.t));
    $("end").value = c ? C.fmt(c.end) : "";
    $("title").value = c ? c.title : "";
    $("note").value = c ? c.note : "";
    $("note").hidden = !(c && c.note); $("noteToggle").hidden = !$("note").hidden;
    $("deleteBtn").hidden = !c; $("deleteBtn").textContent = "삭제"; deleteArmed = false;
    $("ytLink").href = "https://www.youtube.com/watch?v=" + cur.videoId + (c ? "&t=" + c.start + "s" : "");
    showRange();
    $("home").hidden = true; $("editor").hidden = false;
    window.scrollTo(0, 0);
    if (location.hash !== "#clip") location.hash = "clip"; // 뒤로 가기로 목록에 돌아오게 한다
    mountPlayer(cur.videoId, c ? c.start : opts.t, !!c);
  }
  function closeEditor() {
    unmountPlayer(); cur = null;
    $("editor").hidden = true; $("home").hidden = false;
    renderList();
  }
  window.addEventListener("hashchange", function () {
    if (location.hash !== "#clip" && cur) closeEditor();
  });
  $("backBtn").addEventListener("click", function () { history.back(); });

  $("markIn").addEventListener("click", function () { $("start").value = C.fmt(now()); showRange(); });
  $("markOut").addEventListener("click", function () { $("end").value = C.fmt(now()); showRange(); });
  $("noteToggle").addEventListener("click", function () { $("noteToggle").hidden = true; $("note").hidden = false; $("note").focus(); });
  $("previewBtn").addEventListener("click", playSegment);

  $("clipForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!cur) return;
    var r = range();
    if (isNaN(r.s)) return setHint("hint", "시작을 찍어 주세요.", true);
    if (isNaN(r.e)) return setHint("hint", "끝을 찍어 주세요.", true);
    if (!r.ok) return setHint("hint", "끝이 시작보다 뒤여야 해요.", true);
    var prev = clips.filter(function (c) { return c.id === cur.clipId; })[0];
    var clip = {
      id: prev ? prev.id : newId(), videoId: cur.videoId, start: r.s, end: r.e,
      title: $("title").value.trim(), note: $("note").value.trim(),
      tags: prev ? prev.tags : [],
      createdAt: prev ? prev.createdAt : Date.now()
    };
    var before = clips.slice();
    clips = clips.filter(function (c) { return c.id !== clip.id; });
    clips.push(clip); sortClips();
    if (!persist()) {
      clips = before;
      return setHint("hint", "저장 공간이 부족해 저장하지 못했습니다. 오래된 클립을 지워 주세요.", true);
    }
    history.back();
  });
  // 실수로 지우지 않게 두 번 눌러야 삭제된다.
  var deleteArmed = false;
  $("deleteBtn").addEventListener("click", function () {
    if (!deleteArmed) { deleteArmed = true; $("deleteBtn").textContent = "한 번 더 누르면 삭제돼요"; return; }
    clips = clips.filter(function (c) { return c.id !== cur.clipId; });
    persist();
    history.back();
  });

  // ---------- 링크 열기 / 공유 받기 ----------
  function openFromText(text) {
    var y = C.parseYouTube(text);
    if (!y) return false;
    openEditor({ videoId: y.id, t: y.t });
    return true;
  }
  $("openForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!$("url").value.trim()) return setHint("openHint", "유튜브 링크를 붙여넣어 주세요.", true);
    if (!openFromText($("url").value)) return setHint("openHint", "유튜브 링크로 보이지 않습니다. 예: https://youtu.be/영상ID", true);
    $("url").value = ""; setHint("openHint", "");
  });
  $("q").addEventListener("input", renderList);

  // 안드로이드 앱: 유튜브 앱에서 공유한 링크를 네이티브 쪽 ShareInbox 가 들고 있다.
  function checkNativeShare() {
    var cap = window.Capacitor;
    if (!cap || typeof cap.nativePromise !== "function") return;
    cap.nativePromise("ShareInbox", "consume", {}).then(function (r) {
      if (r && r.text) openFromText(r.text);
    }, function () {});
  }
  window.addEventListener("clipShareIncoming", checkNativeShare);

  // ---------- 백업 ----------
  $("exportBtn").addEventListener("click", function () {
    $("backupText").value = JSON.stringify(clips);
    $("backupText").select();
    setHint("backupHint", "클립 " + clips.length + "개. 전체를 복사해 두세요.");
  });
  $("importBtn").addEventListener("click", function () {
    var arr;
    try { arr = JSON.parse($("backupText").value); } catch (e) { arr = null; }
    if (!Array.isArray(arr)) return setHint("backupHint", "백업 내용을 읽지 못했습니다. 복사한 전체를 그대로 붙여넣어 주세요.", true);
    var byId = {}, added = 0;
    clips.forEach(function (c) { byId[c.id] = true; });
    arr.map(C.normalizeClip).filter(Boolean).forEach(function (c) {
      if (!c.id) c.id = newId();
      if (!byId[c.id]) { clips.push(c); byId[c.id] = true; added++; }
    });
    sortClips(); persist(); renderList();
    setHint("backupHint", "클립 " + added + "개를 불러왔어요.");
  });

  // ---------- 시작 ----------
  load();
  if (location.hash === "#clip") history.replaceState(null, "", location.pathname + location.search);
  renderList();
  // 설치형 웹앱: 공유 대상으로 열리면 ?text= / ?url= 에 링크가 온다.
  var p = new URLSearchParams(location.search);
  var shared = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  if (shared) {
    history.replaceState(null, "", location.pathname);
    openFromText(shared);
  }
  checkNativeShare();

  // ---------- 앱처럼 쓰기 ----------
  // 서비스 워커: 홈 화면 앱이 빨리 뜨고 오프라인에서도 목록이 열린다. 네이티브 앱(Capacitor) 안에서는 쓰지 않는다.
  if ("serviceWorker" in navigator && !window.Capacitor && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  // 사파리 등 브라우저에서 열었을 때만 "홈 화면에 추가" 안내를 띄운다. 이미 홈 화면 앱이면 띄우지 않는다.
  var TIP_KEY = "clip-shelf-install-tip-closed";
  var standalone = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  var deferredPrompt = null;
  function tipClosed() { try { return localStorage.getItem(TIP_KEY) === "1"; } catch (e) { return false; } }
  function showTip(show) {
    $("installTip").hidden = !show;
    document.body.classList.toggle("has-install", show);
  }
  if (!standalone && !window.Capacitor && !tipClosed()) {
    if (isIOS) {
      // 아이폰 크롬·카카오톡 등 인앱 브라우저는 홈 화면 추가가 안 되거나 다르게 동작한다
      if (!/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS|KAKAOTALK|Instagram|FBAN|NAVER/.test(ua)) {
        $("installSteps").textContent = "사파리에서 이 주소를 열고 공유 → 홈 화면에 추가를 누르세요";
      }
      showTip(true);
    }
  }
  // 안드로이드 크롬: 설치 버튼을 직접 보여 줄 수 있다
  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    if (standalone || tipClosed()) return;
    deferredPrompt = ev;
    $("installSteps").textContent = "설치하면 홈 화면에서 바로 열 수 있어요";
    $("installBtn").hidden = false;
    showTip(true);
  });
  $("installBtn").addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () { deferredPrompt = null; showTip(false); }, function () {});
  });
  $("installClose").addEventListener("click", function () {
    try { localStorage.setItem(TIP_KEY, "1"); } catch (e) {}
    showTip(false);
  });
  window.addEventListener("appinstalled", function () { showTip(false); });
})();
