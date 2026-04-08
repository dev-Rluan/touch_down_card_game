/**
 * Service Worker — Touch Down Card Game
 *
 * 전략: Cache-First for static assets, Network-Only for API/Socket
 * - 정적 자산(CSS, JS, 폰트): 캐시 우선
 * - /auth, /api, /socket.io: 항상 네트워크 (실시간 데이터)
 */

const CACHE_NAME = 'tdcg-v1';
const STATIC_ASSETS = [
  '/',
  '/public/css/styles.css',
  '/public/js/config.js',
  '/public/js/auth.js',
  '/public/js/retention.js',
  '/public/js/app.js',
  '/public/manifest.json',
  '/public/icons/icon.svg',
];

// ── 설치: 정적 자산 사전 캐싱 ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        // 일부 자산 실패해도 SW 설치는 계속
        console.warn('[SW] 사전 캐싱 부분 실패:', err);
      })
    )
  );
  self.skipWaiting();
});

// ── 활성화: 이전 캐시 정리 ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch 인터셉트 ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 실시간/인증/API 요청 → 항상 네트워크
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api') ||
    url.pathname === '/env.js' ||
    request.method !== 'GET'
  ) {
    return; // SW가 개입하지 않음
  }

  // 정적 자산 → Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 유효한 응답만 캐싱
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
