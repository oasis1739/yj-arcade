// 오프라인 캐시. 첫 방문 때 받은 자산을 캐시에 넣고, 이후에는 캐시 우선으로 낸다.
const CACHE = 'yj-arcade-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 앱 진입(내비게이션)은 네트워크 우선: 새 배포가 있으면 즉시 받아온다.
  // 오프라인이면(비행기 모드) 캐시된 index.html로 폴백한다.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // 그 외 동일 출처 자산(해시가 붙은 번들, manifest, 아이콘)은 캐시 우선.
  // Vite가 빌드마다 새 파일명을 쓰므로 캐시 우선이어도 새 빌드는 새 URL로 받아진다.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => Promise.reject(new Error('오프라인')));
    }),
  );
});
