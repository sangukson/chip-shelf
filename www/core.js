// 화면과 무관한 순수 함수. 브라우저(window.ClipCore)와 Node 테스트(module.exports) 양쪽에서 쓴다.
(function (root) {
  "use strict";

  // "5:20", "1:05:20", "320", "5m20s" → 초. 해석 못 하면 NaN.
  function parseTime(s) {
    s = String(s == null ? "" : s).trim().toLowerCase();
    if (!s) return NaN;
    if (/^\d+$/.test(s)) return +s;
    var m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    var parts = s.split(":");
    if (parts.length < 2 || parts.length > 3) return NaN;
    var t = 0;
    for (var i = 0; i < parts.length; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return NaN;
      if (i > 0 && +parts[i] > 59) return NaN;
      t = t * 60 + +parts[i];
    }
    return t;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return h ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
  }

  function fmtLen(sec) {
    if (sec < 60) return sec + "초";
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + "분" + (s ? " " + s + "초" : "");
  }

  // 링크(또는 링크가 섞인 공유 문구)에서 영상 ID와 시작 시각을 꺼낸다. 실패하면 null.
  function parseYouTube(raw) {
    raw = String(raw || "").trim();
    if (/^[\w-]{11}$/.test(raw)) return { id: raw, t: NaN };
    var found = raw.match(/(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/[^\s]*/i);
    if (!found) return null;
    var link = found[0];
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    var u;
    try { u = new URL(link); } catch (e) { return null; }
    var host = u.hostname.replace(/^(www|m|music)\./, "");
    var id = null;
    if (host === "youtu.be") id = u.pathname.split("/")[1];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      var seg = u.pathname.split("/");
      if (["shorts", "embed", "live", "v"].indexOf(seg[1]) >= 0) id = seg[2];
    }
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return { id: id, t: parseTime(u.searchParams.get("t") || u.searchParams.get("start") || "") };
  }

  // 백업에서 읽은 값이 클립 모양인지 확인하고 정리한다. 아니면 null.
  function normalizeClip(c) {
    if (!c || typeof c !== "object") return null;
    if (!/^[\w-]{11}$/.test(String(c.videoId || ""))) return null;
    var s = Number(c.start), e = Number(c.end);
    if (!isFinite(s) || !isFinite(e) || s < 0 || e <= s) return null;
    return {
      id: String(c.id || ""), videoId: c.videoId, start: Math.floor(s), end: Math.floor(e),
      title: String(c.title || ""), note: String(c.note || ""),
      tags: Array.isArray(c.tags) ? c.tags.map(String).filter(Boolean) : [],
      categoryId: typeof c.categoryId === "string" ? c.categoryId : "",
      createdAt: Number(c.createdAt) || 0
    };
  }

  var CAT_COLORS = ["tomato", "sun", "mint", "sky", "grape", "pink"];

  // 서랍(카테고리) 모양 확인. 이름이 없으면 null.
  function normalizeCategory(c) {
    if (!c || typeof c !== "object") return null;
    var name = String(c.name || "").trim().slice(0, 20);
    if (!name || !c.id) return null;
    return {
      id: String(c.id), name: name,
      emoji: String(c.emoji || "📁").slice(0, 8),
      color: CAT_COLORS.indexOf(c.color) >= 0 ? c.color : CAT_COLORS[0],
      createdAt: Number(c.createdAt) || 0
    };
  }

  // 백업 읽기: 예전 형식(클립 배열)과 새 형식({cats, clips}) 둘 다 받는다. 못 읽으면 null.
  function parseBackup(text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (Array.isArray(d)) d = { cats: [], clips: d };
    if (!d || !Array.isArray(d.clips)) return null;
    return {
      cats: (Array.isArray(d.cats) ? d.cats : []).map(normalizeCategory).filter(Boolean),
      clips: d.clips.map(normalizeClip).filter(Boolean)
    };
  }

  var api = { parseTime: parseTime, fmt: fmt, fmtLen: fmtLen, parseYouTube: parseYouTube, normalizeClip: normalizeClip,
    normalizeCategory: normalizeCategory, parseBackup: parseBackup, CAT_COLORS: CAT_COLORS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ClipCore = api;
})(typeof window !== "undefined" ? window : globalThis);
