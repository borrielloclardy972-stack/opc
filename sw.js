const CACHE_NAME = "opc-camp-v3.1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./cloud-config.js",
  "./manifest.webmanifest",
  "./assets/icons/opc-app.svg",
  "./assets/icons/douyin.svg",
  "./assets/icons/xiaohongshu.svg",
  "./assets/icons/shipinhao.svg",
  "./assets/icons/boss.svg",
  "./assets/icons/xianyu.svg",
  "./assets/icons/douyin-ad.svg",
  "./assets/icons/tencent-ad.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
