// SEED 는 data-seed-user-color-scheme 으로 라이트/다크 토큰을 고른다. 기기 설정을 따라가게 한다.
(function () {
  var root = document.documentElement;
  root.setAttribute("data-seed-color-mode", "system");
  if (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) root.setAttribute("data-seed-platform", "ios");
  else if (/Android/.test(navigator.userAgent)) root.setAttribute("data-seed-platform", "android");
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function apply() { root.setAttribute("data-seed-user-color-scheme", mq && mq.matches ? "dark" : "light"); }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", apply);
  else if (mq && mq.addListener) mq.addListener(apply);
})();
