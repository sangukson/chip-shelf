const test = require("node:test");
const assert = require("node:assert");
const C = require("../www/core.js");

test("parseTime", () => {
  assert.strictEqual(C.parseTime("5:20"), 320);
  assert.strictEqual(C.parseTime("1:05:20"), 3920);
  assert.strictEqual(C.parseTime("320"), 320);
  assert.strictEqual(C.parseTime("5m20s"), 320);
  assert.strictEqual(C.parseTime("320s"), 320);
  assert.strictEqual(C.parseTime("1h2m"), 3720);
  for (const bad of ["", "abc", "5:75", "1:2:3:4", "5:", "-3"]) assert.ok(isNaN(C.parseTime(bad)), bad);
});

test("fmt / fmtLen", () => {
  assert.strictEqual(C.fmt(320), "5:20");
  assert.strictEqual(C.fmt(3920), "1:05:20");
  assert.strictEqual(C.fmt(5.9), "0:05");
  assert.strictEqual(C.fmtLen(20), "20초");
  assert.strictEqual(C.fmtLen(125), "2분 5초");
  assert.strictEqual(C.fmtLen(120), "2분");
});

test("parseYouTube", () => {
  const id = "dQw4w9WgXcQ";
  assert.deepStrictEqual(C.parseYouTube(`https://www.youtube.com/watch?v=${id}&t=320s`), { id, t: 320 });
  assert.strictEqual(C.parseYouTube(`https://youtu.be/${id}?si=abc&t=5m20s`).t, 320);
  assert.strictEqual(C.parseYouTube(`https://m.youtube.com/shorts/${id}`).id, id);
  assert.strictEqual(C.parseYouTube(`https://www.youtube.com/live/${id}?feature=share`).id, id);
  assert.strictEqual(C.parseYouTube(`youtube.com/embed/${id}?start=40`).t, 40);
  assert.strictEqual(C.parseYouTube(id).id, id);
  // 유튜브 앱의 공유 문구처럼 링크 앞뒤에 글이 섞여도 찾는다
  assert.strictEqual(C.parseYouTube(`이 영상 봐 https://youtu.be/${id}?si=x 좋음`).id, id);
  assert.ok(isNaN(C.parseYouTube(`https://youtu.be/${id}`).t));
  for (const bad of ["", "https://example.com/watch?v=" + id, "https://www.youtube.com/watch?v=short", "hello"])
    assert.strictEqual(C.parseYouTube(bad), null, bad);
});

test("normalizeClip", () => {
  const ok = C.normalizeClip({ id: "a", videoId: "dQw4w9WgXcQ", start: 320, end: 340, tags: ["x"] });
  assert.strictEqual(ok.end - ok.start, 20);
  assert.strictEqual(C.normalizeClip({ videoId: "dQw4w9WgXcQ", start: 340, end: 320 }), null);
  assert.strictEqual(C.normalizeClip({ videoId: "<script>", start: 1, end: 2 }), null);
  assert.strictEqual(C.normalizeClip(null), null);
});

test("categories and backup", () => {
  const cat = C.normalizeCategory({ id: "a", name: " 가슴 ", emoji: "💪", color: "mint" });
  assert.deepStrictEqual([cat.name, cat.emoji, cat.color], ["가슴", "💪", "mint"]);
  assert.strictEqual(C.normalizeCategory({ id: "a", name: "x", color: "nope" }).color, "tomato");
  assert.strictEqual(C.normalizeCategory({ id: "a", name: "  " }), null);
  const clip = { id: "c", videoId: "dQw4w9WgXcQ", start: 1, end: 5, categoryId: "a" };
  assert.strictEqual(C.normalizeClip(clip).categoryId, "a");
  assert.strictEqual(C.normalizeClip({ ...clip, categoryId: 3 }).categoryId, "");
  // 예전 백업(배열)과 새 백업(객체) 모두 읽는다
  assert.strictEqual(C.parseBackup(JSON.stringify([clip])).clips.length, 1);
  const b = C.parseBackup(JSON.stringify({ v: 2, cats: [cat, { bad: 1 }], clips: [clip, { bad: 1 }] }));
  assert.deepStrictEqual([b.cats.length, b.clips.length], [1, 1]);
  assert.strictEqual(C.parseBackup("garbage"), null);
  assert.strictEqual(C.parseBackup('{"x":1}'), null);
});
