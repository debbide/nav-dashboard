// Service Worker for nav-dashboard
const CACHE_NAME = 'nav-dashboard-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/css/style.css',
    '/css/admin.css',
    '/js/main.js',
    '/js/admin.js',
    '/favicon.svg'
];

// Install - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - 智能缓存策略
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 图片代理请求：Cache First（优先本地缓存）
    if (url.pathname === '/api/proxy/image') {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    return cached;
                }
                return fetch(request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                }).catch(() => {
                    // 网络失败返回占位图
                    return new Response('', { status: 504 });
                });
            })
        );
        return;
    }

    // 其他 API 请求：跳过缓存
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // 静态资源：Network First, fallback to cache
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
