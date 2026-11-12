// 홈 화면 앱이 빨리 뜨고, 인터넷이 없어도 목록은 열리게 하는 서비스 워커.
// 같은 출처 파일만 다룬다(유튜브 영상·썸네일은 손대지 않는다).
// 온라인이면 늘 새 파일을 받아 쓰고(배포가 바로 반영됨), 실패할 때만 저장해 둔 사본을 쓴다.
var CACHE = "clip-shelf-v1";
var SHELL = [
  "./", "index.html", "app.css", "app.js", "core.js", "theme.js",
  "vendor/seed-design/base.min.css", "manifest.webmanifest", "icon-180.png", "icon-192.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match("./") : Response.error());
      });
    })
  );
});
