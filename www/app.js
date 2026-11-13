(function () {
  "use strict";
  var C = window.ClipCore;
  var $ = function (id) { return document.getElementById(id); };
  var CLIPS_KEY = "clip-shelf-v1", CATS_KEY = "clip-shelf-cats-v1";
  var EMOJIS = ["💪", "🏋️", "🦵", "🧘", "🍳", "📚", "🎵", "🎮", "💻", "🎨", "✈️", "⚽", "💡", "🎬", "💰", "⭐"];
  var STARTERS = [["운동", "💪", "tomato"], ["요리", "🍳", "sun"], ["공부", "📚", "sky"], ["음악", "🎵", "grape"]];
  var ALL = "all", NONE = "none"; // 특수 서랍: 전체, 미분류

  // ---------- 저장 (기기 안 localStorage) ----------
  var clips = [], cats = [];
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { return []; } }
  function load() {
    clips = read(CLIPS_KEY).map(C.normalizeClip).filter(Boolean);
    cats = read(CATS_KEY).map(C.normalizeCategory).filter(Boolean);
    sortAll();
  }
  function persist() {
    try {
      localStorage.setItem(CLIPS_KEY, JSON.stringify(clips));
      localStorage.setItem(CATS_KEY, JSON.stringify(cats));
      return true;
    } catch (e) { return false; }
  }
  function sortAll() {
    clips.sort(function (a, b) { return b.createdAt - a.createdAt; });
    cats.sort(function (a, b) { return a.createdAt - b.createdAt; });
  }
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function catById(id) { return cats.filter(function (c) { return c.id === id; })[0] || null; }
  // 지워진 서랍을 가리키는 클립은 미분류로 본다
  function catOf(clip) { return catById(clip.categoryId) ? clip.categoryId : ""; }
  function clipsIn(catId) {
    if (catId === ALL) return clips;
    if (catId === NONE) return clips.filter(function (c) { return !catOf(c); });
    return clips.filter(function (c) { return catOf(c) === catId; });
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function setHint(id, msg, isErr) { var h = $(id); h.textContent = msg || ""; h.className = "hint" + (isErr ? " err" : ""); }
  function colorVar(name) { return "var(--" + name + ")"; }

  // ---------- 재미 요소: 토스트, 색종이 ----------
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = true; void t.offsetWidth; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 1800);
  }
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = $("confetti"), ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    var W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    var colors = ["#ff7a6b", "#ffd24d", "#5fe0b7", "#7cc0ff", "#b79bff", "#ff9fcb"], ps = [];
    for (var i = 0; i < 70; i++) ps.push({
      x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3,
      s: 5 + Math.random() * 6, r: Math.random() * 6, c: colors[i % colors.length]
    });
    var t0 = performance.now();
    (function frame(t) {
      var age = t - t0;
      ctx.clearRect(0, 0, W, H);
      if (age > 1400) return;
      ctx.globalAlpha = Math.max(0, 1 - age / 1400);
      ps.forEach(function (p) {
        p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += 0.2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
      });
      requestAnimationFrame(frame);
    })(t0);
  }
  var CHEERS = ["콕! 서랍에 넣었어요", "나이스 콕!", "또 하나 모았다!", "딱 그 구간, 저장 완료"];

  // ---------- 홈: 서랍 목록 ----------
  function catCard(o) {
    var b = el("button", { class: "cat" + (o.cls ? " " + o.cls : ""), type: "button" }, [
      el("span", { class: "cat-emoji", text: o.emoji }),
      el("span", { class: "cat-name", text: o.name }),
      o.count == null ? null : el("span", { class: "cat-count", text: "클립 " + o.count + "개" })
    ]);
    if (o.color) b.style.setProperty("--c", colorVar(o.color));
    b.addEventListener("click", o.onClick);
    return b;
  }
  function renderHome() {
    var total = clips.reduce(function (s, c) { return s + (c.end - c.start); }, 0);
    $("stat").textContent = clips.length ? "클립 " + clips.length + "개 · " + C.fmtLen(total) + " 모았어요" : "";
    var box = $("cats"); box.textContent = "";
    cats.forEach(function (c, i) {
      var card = catCard({ emoji: c.emoji, name: c.name, color: c.color, count: clipsIn(c.id).length, onClick: function () { go("cat-" + c.id); } });
      card.style.animationDelay = (i * 40) + "ms";
      box.appendChild(card);
    });
    var loose = clipsIn(NONE).length;
    if (loose) box.appendChild(catCard({ emoji: "📦", name: "미분류", cls: "plain", count: loose, onClick: function () { go("cat-" + NONE); } }));
    if (clips.length && cats.length) box.appendChild(catCard({ emoji: "🗂️", name: "전체", cls: "plain", count: clips.length, onClick: function () { go("cat-" + ALL); } }));
    box.appendChild(catCard({ emoji: "＋", name: "새 서랍", cls: "add", onClick: function () { openSheet(null); } }));

    // 서랍이 하나도 없을 때: 한 번 눌러 만드는 추천
    $("starter").hidden = cats.length > 0;
    var chips = $("starterChips"); chips.textContent = "";
    STARTERS.forEach(function (s) {
      var ch = el("button", { class: "chip", type: "button", text: s[1] + " " + s[0] });
      ch.addEventListener("click", function () { addCategory(s[0], s[1], s[2]); renderHome(); toast(s[1] + " " + s[0] + " 서랍 생성!"); });
      chips.appendChild(ch);
    });
  }

  // ---------- 서랍 안 ----------
  var curCat = null; // 열려 있는 서랍 id (ALL/NONE 포함)
  var SEARCH_FROM = 8;
  function renderCat() {
    var c = catById(curCat), special = curCat === ALL || curCat === NONE;
    if (!c && !special) return go("");
    var mine = clipsIn(curCat);
    var hero = $("catHero");
    hero.className = "cat-hero" + (c ? "" : " plain");
    hero.style.setProperty("--c", c ? colorVar(c.color) : "var(--card)");
    $("catEmoji").textContent = c ? c.emoji : (curCat === ALL ? "🗂️" : "📦");
    $("catName").textContent = c ? c.name : (curCat === ALL ? "전체" : "미분류");
    $("catCount").textContent = "클립 " + mine.length + "개";
    $("catEdit").hidden = !c;
    $("catUrl").placeholder = c ? "이 서랍에 넣을 유튜브 링크" : "유튜브 링크 붙여넣기";

    $("q").hidden = mine.length < SEARCH_FROM;
    var q = $("q").hidden ? "" : $("q").value.trim().toLowerCase();
    var shown = mine.filter(function (x) { return !q || (x.title + " " + x.note).toLowerCase().indexOf(q) >= 0; });
    var list = $("list"); list.textContent = "";
    if (!shown.length) {
      list.appendChild(el("p", { class: "empty" }, mine.length
        ? [document.createTextNode("검색 결과가 없어요")]
        : [el("span", { class: "big", text: "🫙" }), document.createTextNode("아직 텅 비었어요. 첫 클립을 콕 넣어 보세요!")]));
      return;
    }
    shown.forEach(function (x) {
      var img = el("img", { src: "https://i.ytimg.com/vi/" + x.videoId + "/mqdefault.jpg", alt: "", loading: "lazy" });
      img.addEventListener("error", function () { img.remove(); });
      var row = el("button", { class: "clip", type: "button" }, [
        el("div", { class: "thumb" }, [img, el("span", { class: "len", text: C.fmtLen(x.end - x.start) })]),
        el("div", { class: "cbody" }, [
          el("span", { class: "t" + (x.title ? "" : " untitled"), text: x.title || "제목 없음" }),
          el("span", { class: "tc", text: C.fmt(x.start) + " – " + C.fmt(x.end) })
        ])
      ]);
      row.addEventListener("click", function () { openEditor({ clip: x }); });
      list.appendChild(row);
    });
  }

  // ---------- 서랍 만들기/수정 시트 ----------
  var sheet = { id: null, emoji: EMOJIS[0], color: C.CAT_COLORS[0], onDone: null, deleteArmed: false };
  function addCategory(name, emoji, color) {
    var c = { id: newId("k"), name: name, emoji: emoji, color: color, createdAt: Date.now() };
    cats.push(c); sortAll(); persist();
    return c;
  }
  function paintSheet() {
    $("sheetEmoji").textContent = sheet.emoji;
    $("sheetPreview").style.setProperty("--c", colorVar(sheet.color));
    Array.prototype.forEach.call($("emojiGrid").children, function (b) { b.setAttribute("aria-pressed", String(b.textContent === sheet.emoji)); });
    Array.prototype.forEach.call($("colorRow").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.color === sheet.color)); });
  }
  function openSheet(cat, onDone) {
    sheet.id = cat ? cat.id : null;
    sheet.emoji = cat ? cat.emoji : EMOJIS[cats.length % EMOJIS.length];
    sheet.color = cat ? cat.color : C.CAT_COLORS[cats.length % C.CAT_COLORS.length];
    sheet.onDone = onDone || null; sheet.deleteArmed = false;
    $("sheetTitle").textContent = cat ? "서랍 수정" : "새 서랍";
    $("sheetSave").textContent = cat ? "저장" : "만들기";
    $("catInput").value = cat ? cat.name : "";
    $("catDelete").hidden = !cat; $("catDelete").textContent = "이 서랍 삭제";
    setHint("sheetHint", "");
    paintSheet();
    $("sheet").hidden = false;
  }
  function closeSheet() { $("sheet").hidden = true; }
  EMOJIS.forEach(function (e) {
    var b = el("button", { class: "emoji", type: "button", text: e });
    b.addEventListener("click", function () { sheet.emoji = e; paintSheet(); });
    $("emojiGrid").appendChild(b);
  });
  C.CAT_COLORS.forEach(function (name) {
    var b = el("button", { class: "swatch", type: "button", "aria-label": name, "data-color": name });
    b.style.setProperty("--c", colorVar(name));
    b.addEventListener("click", function () { sheet.color = name; paintSheet(); });
    $("colorRow").appendChild(b);
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sheet-close]"), function (n) { n.addEventListener("click", closeSheet); });
  $("sheetForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("catInput").value.trim();
    if (!name) return setHint("sheetHint", "서랍 이름을 적어 주세요.", true);
    if (cats.some(function (c) { return c.name === name && c.id !== sheet.id; })) return setHint("sheetHint", "같은 이름의 서랍이 이미 있어요.", true);
    var c = catById(sheet.id);
    if (c) { c.name = name; c.emoji = sheet.emoji; c.color = sheet.color; persist(); }
    else { c = addCategory(name, sheet.emoji, sheet.color); toast(c.emoji + " " + c.name + " 서랍 생성!"); }
    closeSheet();
    if (sheet.onDone) sheet.onDone(c);
    render();
  });
  $("catDelete").addEventListener("click", function () {
    if (!sheet.deleteArmed) {
      sheet.deleteArmed = true;
      $("catDelete").textContent = "한 번 더 누르면 삭제 (클립은 미분류로 남아요)";
      return;
    }
    cats = cats.filter(function (c) { return c.id !== sheet.id; });
    persist(); closeSheet(); history.back();
  });
  $("catEdit").addEventListener("click", function () { var c = catById(curCat); if (c) openSheet(c); });

  // ---------- 플레이어 ----------
  var player = null, playerReady = false, ticker = null, apiPromise = null;
  var cur = null; // { videoId, clipId|null, catId }
  var segmentOn = false;

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
  function now() { try { return playerReady ? player.getCurrentTime() || 0 : 0; } catch (e) { return 0; } }
  function tick() {
    var t = now();
    $("now").textContent = C.fmt(t);
    var r = range();
    // 구간 재생 중 끝에 닿으면 시작으로 돌아가 반복한다.
    if (player && segmentOn && r.ok && t >= r.e) player.seekTo(r.s, true);
  }
  function playSegment() {
    var r = range();
    if (!r.ok) return setHint("hint", "시작과 끝을 먼저 콕 찍어 주세요.", true);
    if (!playerReady || !player) return;
    segmentOn = true;
    player.seekTo(r.s, true);
    player.playVideo();
  }
  function mountPlayer(videoId, startAt, autoSegment) {
    playerReady = false; segmentOn = false;
    playerMsg("영상을 불러오는 중…");
    loadApi().then(function () {
      if (!cur || cur.videoId !== videoId) return;
      if (player) { try { player.destroy(); } catch (e) {} player = null; }
      player = new YT.Player("player", {
        videoId: videoId,
        playerVars: { start: Math.floor(startAt || 0), playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: function (ev) {
            if (!player || ev.target !== player) return; // 준비되기 전에 화면을 닫은 경우
            playerReady = true; playerMsg("");
            if (!$("title").value) { try { $("title").value = (player.getVideoData() || {}).title || ""; } catch (e) {} }
            if (autoSegment) playSegment();
          },
          onError: function (ev) {
            var code = ev && ev.data;
            playerMsg(code === 101 || code === 150 || code === 153
              ? "이 영상은 앱 안에서 재생할 수 없게 설정되어 있어요. 오른쪽 위 유튜브를 눌러 주세요."
              : "영상을 재생하지 못했어요. 링크가 맞는지 확인해 주세요.");
          }
        }
      });
      clearInterval(ticker);
      ticker = setInterval(tick, 250);
    }, function () {
      if (cur && cur.videoId === videoId) playerMsg("유튜브에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 열어 주세요.");
    });
  }
  function unmountPlayer() {
    clearInterval(ticker); ticker = null; playerReady = false; segmentOn = false;
    if (player) { try { player.destroy(); } catch (e) {} player = null; }
  }

  // ---------- 편집 화면 ----------
  var deleteArmed = false;
  function showRange() {
    var r = range();
    $("startView").textContent = isNaN(r.s) ? "–:––" : C.fmt(r.s);
    $("endView").textContent = isNaN(r.e) ? "–:––" : C.fmt(r.e);
    if (!isNaN(r.s) && !isNaN(r.e) && !r.ok) return setHint("hint", "끝이 시작보다 뒤여야 해요.", true);
    setHint("hint", r.ok ? "딱 " + C.fmtLen(r.e - r.s) + "!" : "");
  }
  function bump(id) { var n = $(id); n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); }
  function renderCatChips() {
    var box = $("catChips"); box.textContent = "";
    cats.forEach(function (c) {
      var ch = el("button", { class: "chip", type: "button", "aria-pressed": String(cur.catId === c.id), text: c.emoji + " " + c.name });
      ch.style.setProperty("--c", colorVar(c.color));
      ch.addEventListener("click", function () { cur.catId = cur.catId === c.id ? "" : c.id; renderCatChips(); });
      box.appendChild(ch);
    });
    var add = el("button", { class: "chip add", type: "button", text: "＋ 새 서랍" });
    add.addEventListener("click", function () { openSheet(null, function (c) { if (cur) { cur.catId = c.id; renderCatChips(); } }); });
    box.appendChild(add);
  }
  function openEditor(opts) {
    var c = opts.clip;
    cur = { videoId: c ? c.videoId : opts.videoId, clipId: c ? c.id : null, catId: c ? catOf(c) : (opts.catId || "") };
    $("clipForm").reset();
    $("start").value = c ? C.fmt(c.start) : (isNaN(opts.t) ? "" : C.fmt(opts.t));
    $("end").value = c ? C.fmt(c.end) : "";
    $("title").value = c ? c.title : "";
    $("note").value = c ? c.note : "";
    $("note").hidden = !(c && c.note); $("noteToggle").hidden = !$("note").hidden;
    $("saveBtn").textContent = c ? "저장" : "서랍에 넣기";
    $("deleteBtn").hidden = !c; $("deleteBtn").textContent = "삭제"; deleteArmed = false;
    $("ytLink").href = "https://www.youtube.com/watch?v=" + cur.videoId + (c ? "&t=" + c.start + "s" : "");
    showRange(); renderCatChips();
    go("edit");
    mountPlayer(cur.videoId, c ? c.start : opts.t, !!c);
  }
  $("markIn").addEventListener("click", function () { $("start").value = C.fmt(now()); showRange(); bump("startView"); });
  $("markOut").addEventListener("click", function () { $("end").value = C.fmt(now()); showRange(); bump("endView"); });
  $("previewBtn").addEventListener("click", playSegment);
  $("noteToggle").addEventListener("click", function () { $("noteToggle").hidden = true; $("note").hidden = false; $("note").focus(); });

  $("clipForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!cur) return;
    var r = range();
    if (isNaN(r.s)) return setHint("hint", "시작을 콕 찍어 주세요.", true);
    if (isNaN(r.e)) return setHint("hint", "끝을 콕 찍어 주세요.", true);
    if (!r.ok) return setHint("hint", "끝이 시작보다 뒤여야 해요.", true);
    var prev = clips.filter(function (c) { return c.id === cur.clipId; })[0];
    var clip = {
      id: prev ? prev.id : newId("c"), videoId: cur.videoId, start: r.s, end: r.e,
      title: $("title").value.trim(), note: $("note").value.trim(),
      tags: prev ? prev.tags : [], categoryId: cur.catId || "",
      createdAt: prev ? prev.createdAt : Date.now()
    };
    var before = clips.slice();
    clips = clips.filter(function (c) { return c.id !== clip.id; });
    clips.push(clip); sortAll();
    if (!persist()) { clips = before; return setHint("hint", "저장 공간이 부족해요. 오래된 클립을 지워 주세요.", true); }
    if (!prev) { confetti(); toast(CHEERS[clips.length % CHEERS.length]); }
    history.back();
  });
  // 실수로 지우지 않게 두 번 눌러야 삭제된다.
  $("deleteBtn").addEventListener("click", function () {
    if (!deleteArmed) { deleteArmed = true; $("deleteBtn").textContent = "한 번 더 누르면 삭제돼요"; return; }
    clips = clips.filter(function (c) { return c.id !== cur.clipId; });
    persist(); history.back();
  });

  // ---------- 화면 전환 (해시: 없음=홈, #cat-ID=서랍, #edit=편집) ----------
  function go(hash) { if (location.hash.replace(/^#/, "") === hash) render(); else location.hash = hash; }
  function render() {
    var h = location.hash.replace(/^#/, "");
    if (h === "edit" && !cur) { history.replaceState(null, "", location.pathname); h = ""; }
    if (h !== "edit" && cur) { unmountPlayer(); cur = null; }
    var view = h === "edit" ? "editor" : h.indexOf("cat-") === 0 ? "catPage" : "home";
    ["home", "catPage", "editor"].forEach(function (id) { $(id).hidden = id !== view; });
    if (view === "catPage") { curCat = h.slice(4); renderCat(); }
    else if (view === "home") { curCat = null; renderHome(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  Array.prototype.forEach.call(document.querySelectorAll("[data-back]"), function (b) {
    b.addEventListener("click", function () { if (history.length > 1) history.back(); else go(""); });
  });

  // ---------- 링크 열기 / 공유 받기 ----------
  function openFromText(text, catId) {
    var y = C.parseYouTube(text);
    if (!y) return false;
    openEditor({ videoId: y.id, t: y.t, catId: catId });
    return true;
  }
  function wireOpen(formId, inputId, hintId, getCat) {
    $(formId).addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = $(inputId).value;
      if (!v.trim()) return setHint(hintId, "유튜브 링크를 붙여넣어 주세요.", true);
      if (!openFromText(v, getCat())) return setHint(hintId, "유튜브 링크가 아닌 것 같아요. 예: https://youtu.be/영상ID", true);
      $(inputId).value = ""; setHint(hintId, "");
    });
  }
  wireOpen("openForm", "url", "openHint", function () { return ""; });
  wireOpen("catOpenForm", "catUrl", "catHint", function () { return catById(curCat) ? curCat : ""; });
  $("q").addEventListener("input", renderCat);

  // 안드로이드 앱: 유튜브 앱에서 공유한 링크를 네이티브 쪽 ShareInbox 가 들고 있다.
  function checkNativeShare() {
    var cap = window.Capacitor;
    if (!cap || typeof cap.nativePromise !== "function") return;
    cap.nativePromise("ShareInbox", "consume", {}).then(function (r) { if (r && r.text) openFromText(r.text, ""); }, function () {});
  }
  window.addEventListener("clipShareIncoming", checkNativeShare);

  // ---------- 백업 ----------
  $("exportBtn").addEventListener("click", function () {
    $("backupText").value = JSON.stringify({ v: 2, cats: cats, clips: clips });
    $("backupText").select();
    setHint("backupHint", "서랍 " + cats.length + "개, 클립 " + clips.length + "개. 전체를 복사해 두세요.");
  });
  $("importBtn").addEventListener("click", function () {
    var b = C.parseBackup($("backupText").value);
    if (!b) return setHint("backupHint", "백업 내용을 읽지 못했어요. 복사한 전체를 그대로 붙여넣어 주세요.", true);
    var have = {}, added = 0;
    cats.forEach(function (c) { have[c.id] = true; });
    b.cats.forEach(function (c) { if (!have[c.id]) { cats.push(c); have[c.id] = true; } });
    have = {};
    clips.forEach(function (c) { have[c.id] = true; });
    b.clips.forEach(function (c) {
      if (!c.id) c.id = newId("c");
      if (!have[c.id]) { clips.push(c); have[c.id] = true; added++; }
    });
    sortAll(); persist(); render();
    setHint("backupHint", "클립 " + added + "개를 불러왔어요.");
  });

  // ---------- 시작 ----------
  load();
  render();
  // 설치형 웹앱: 공유 대상으로 열리면 ?text= / ?url= 에 링크가 온다.
  var p = new URLSearchParams(location.search);
  var shared = [p.get("url"), p.get("text"), p.get("title")].filter(Boolean).join(" ");
  if (shared) { history.replaceState(null, "", location.pathname); openFromText(shared, ""); }
  checkNativeShare();

  // ---------- 앱처럼 쓰기 ----------
  if ("serviceWorker" in navigator && !window.Capacitor && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  // 사파리 등 브라우저에서 열었을 때만 "홈 화면에 추가" 안내를 띄운다.
  var TIP_KEY = "clip-shelf-install-tip-closed";
  var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  var deferredPrompt = null;
  function tipClosed() { try { return localStorage.getItem(TIP_KEY) === "1"; } catch (e) { return false; } }
  function showTip(show) { $("installTip").hidden = !show; document.body.classList.toggle("has-install", show); }
  if (!standalone && !window.Capacitor && !tipClosed() && isIOS) {
    if (!/Safari/.test(ua) || /CriOS|FxiOS|EdgiOS|KAKAOTALK|Instagram|FBAN|NAVER/.test(ua)) {
      $("installSteps").textContent = "사파리에서 이 주소를 열고 공유 → 홈 화면에 추가를 누르세요";
    }
    showTip(true);
  }
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
