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
    var h = $(id); h.textContent = msg || "";
    var base = id === "hint" ? "range-summary" : "hint";
    h.className = base + (isErr ? " err" : "");
  }
  // 빈 목록 그림: 영상 바 위에 구간 괄호. 색은 SEED 토큰을 따른다.
  function emptyArt() {
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 120 72"); svg.setAttribute("class", "empty-art"); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      '<rect x="4" y="4" width="112" height="64" rx="10" style="fill:var(--seed-color-bg-neutral-weak)"/>' +
      '<rect x="16" y="48" width="88" height="5" rx="2.5" style="fill:var(--seed-color-bg-neutral-solid-muted, var(--seed-color-stroke-neutral-weak))"/>' +
      '<rect x="44" y="48" width="30" height="5" style="fill:var(--seed-color-bg-brand-solid)"/>' +
      '<path d="M48 38h-6v20h6M70 38h6v20h-6" style="fill:none;stroke:var(--seed-color-fg-brand);stroke-width:3;stroke-linecap:round;stroke-linejoin:round"/>' +
      '<path d="M55 20v12l10-6z" style="fill:var(--seed-color-fg-neutral-subtle)"/>';
    return svg;
  }

  // ---------- 목록 ----------
  function renderList() {
    var q = $("q").value.trim().toLowerCase();
    var shown = clips.filter(function (c) {
      return !q || [c.title, c.note, c.tags.join(" ")].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    $("count").textContent = "보관한 클립 " + clips.length + "개";
    var list = $("list");
    list.textContent = "";
    if (!shown.length) {
      list.appendChild(clips.length
        ? el("div", { class: "empty small" }, [el("span", { text: "검색에 맞는 클립이 없어요." })])
        : el("div", { class: "empty" }, [emptyArt(),
            el("strong", { text: "아직 보관한 클립이 없어요" }),
            el("span", { text: "위에 유튜브 링크를 붙여넣고, 영상을 보면서 시작과 끝을 찍어 저장해 보세요." })]));
      return;
    }
    shown.forEach(function (c) {
      var img = el("img", { src: "https://i.ytimg.com/vi/" + c.videoId + "/mqdefault.jpg", alt: "", loading: "lazy" });
      img.addEventListener("error", function () { img.remove(); });
      var row = el("button", { class: "clip", type: "button" }, [
        el("div", { class: "thumb" }, [img, el("span", { class: "len", text: C.fmtLen(c.end - c.start) })]),
        el("div", { class: "cbody" }, [
          el("span", { class: "t" + (c.title ? "" : " untitled"), text: c.title || "제목 없는 클립" }),
          el("span", { class: "tc", text: C.fmt(c.start) + " – " + C.fmt(c.end) }),
          c.note ? el("span", { class: "n", text: c.note }) : null,
          c.tags.length ? el("span", { class: "tags" }, c.tags.map(function (t) { return el("span", { class: "tag", text: t }); })) : null
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
    drawTrack(t, r);
    // 구간 끝에 닿으면 반복이 켜져 있을 때는 시작으로, 꺼져 있으면 멈춘다.
    if (player && segmentOn && r.ok && t >= r.e) {
      if ($("loop").checked) player.seekTo(r.s, true);
      else { player.pauseVideo(); segmentOn = false; }
    }
  }
  // 영상 전체 길이 위에 저장할 구간과 현재 위치를 그린다. 길이를 모르면 숨긴다.
  function drawTrack(t, r) {
    var d = 0;
    try { d = playerReady && player.getDuration ? player.getDuration() || 0 : 0; } catch (e) { d = 0; }
    $("track").hidden = !(d > 0);
    if (!(d > 0)) return;
    var pct = function (x) { return Math.max(0, Math.min(100, x / d * 100)) + "%"; };
    $("trackHead").style.left = pct(t);
    var seg = $("trackSeg");
    if (r.ok) { seg.hidden = false; seg.style.left = pct(r.s); seg.style.width = "calc(" + pct(r.e) + " - " + pct(r.s) + ")"; }
    else seg.hidden = true;
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
              ? "이 영상은 앱 안에서 재생할 수 없게 설정되어 있습니다. 위의 유튜브에서 열기를 눌러 주세요."
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
    if (!isNaN(r.s) && !isNaN(r.e)) {
      if (!r.ok) return setHint("hint", "끝이 시작보다 뒤여야 합니다.", true);
      var h = $("hint"); h.className = "range-summary"; h.textContent = "";
      h.appendChild(el("b", { text: C.fmtLen(r.e - r.s) }));
      h.appendChild(document.createTextNode(" 구간"));
      return;
    }
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
    $("tags").value = c ? c.tags.join(", ") : "";
    $("saveBtn").textContent = c ? "수정 저장" : "클립 저장";
    $("dangerZone").hidden = !c; $("deleteBtn").hidden = false; $("deleteConfirm").hidden = true;
    $("editorTitle").textContent = c ? (c.title || "제목 없는 클립") : "새 클립";
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
  $("start").addEventListener("input", showRange);
  $("end").addEventListener("input", showRange);
  $("previewBtn").addEventListener("click", playSegment);

  $("clipForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!cur) return;
    var r = range();
    if (isNaN(r.s)) return setHint("hint", "시작 시간을 찍거나 5:20 형식으로 적어 주세요.", true);
    if (isNaN(r.e)) return setHint("hint", "끝 시간을 찍거나 5:40 형식으로 적어 주세요.", true);
    if (!r.ok) return setHint("hint", "끝이 시작보다 뒤여야 합니다.", true);
    var prev = clips.filter(function (c) { return c.id === cur.clipId; })[0];
    var clip = {
      id: prev ? prev.id : newId(), videoId: cur.videoId, start: r.s, end: r.e,
      title: $("title").value.trim(), note: $("note").value.trim(),
      tags: $("tags").value.split(",").map(function (t) { return t.trim().replace(/^#/, ""); }).filter(Boolean),
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
  $("deleteBtn").addEventListener("click", function () { $("deleteBtn").hidden = true; $("deleteConfirm").hidden = false; });
  $("deleteNo").addEventListener("click", function () { $("deleteBtn").hidden = false; $("deleteConfirm").hidden = true; });
  $("deleteYes").addEventListener("click", function () {
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
    setHint("backupHint", "클립 " + clips.length + "개를 담았습니다. 전체를 복사해 보관하세요.");
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
    setHint("backupHint", "클립 " + added + "개를 복원했습니다.");
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
})();
