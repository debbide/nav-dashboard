// Service Worker for nav-dashboard
const CACHE_NAME = 'nav-dashboard-v4';       // 静态资源
const IMG_CACHE = 'nav-dashboard-img-v1';    // 图标代理（带 TTL）
const API_CACHE = 'nav-dashboard-api-v1';    // API 读接口（离线兜底）
const KEEP_CACHES = [CACHE_NAME, IMG_CACHE, API_CACHE];

// 图标缓存有效期：7 天，过期后重新拉取（站点换 favicon 能生效）
const IMG_TTL = 7 * 24 * 3600 * 1000;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/login.html',
    '/css/style.css',
    '/css/admin.css',
    '/js/main.js',
    '/js/admin.js',
    '/favicon.png'
];

// 允许离线兜底的 API 读接口（公开 GET，前台渲染用）
const API_READ_PREFIXES = [
    '/api/sites',
    '/api/categories',
    '/api/tags',
    '/api/settings/background',
    '/api/images/'
];

// ---- 小工具 ----

// 给 Response 打上缓存时间戳（存进 header，Cache API 无元数据）
function withTimestamp(response) {
    return response.blob().then(blob => {
        const headers = new Headers(response.headers);
        headers.set('x-sw-cached-at', Date.now().toString());
        return new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    });
}

function isStale(cached, ttl) {
    const at = parseInt(cached.headers.get('x-sw-cached-at') || '0', 10);
    return Date.now() - at > ttl;
}

function isApiRead(url) {
    return API_READ_PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p));
}

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
                keys.filter(key => !KEEP_CACHES.includes(key))
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - 智能缓存策略
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // 只处理 http/https 请求，跳过 chrome-extension:// 等
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 只缓存 GET 请求，跳过 POST/PUT/DELETE 等
    if (request.method !== 'GET') {
        return;
    }

    // 图片代理请求：Cache First + 7 天 TTL（过期重新拉取）
    if (url.pathname === '/api/proxy/image') {
        event.respondWith(
            caches.open(IMG_CACHE).then(cache =>
                cache.match(request).then(cached => {
                    // 缓存命中且未过期：直接用
                    if (cached && !isStale(cached, IMG_TTL)) {
                        return cached;
                    }
                    return fetch(request).then(response => {
                        if (response.ok) {
                            return withTimestamp(response).then(stamped => {
                                cache.put(request, stamped.clone());
                                return stamped;
                            });
                        }
                        // 源站报错但有旧缓存：兜底用旧图
                        if (cached) {
                            return cached;
                        }
                        return response;
                    }).catch(() => {
                        // 离线：有旧缓存用旧图（即使过期也比没有强），否则占位
                        if (cached) {
                            return cached;
                        }
                        return new Response('', { status: 504 });
                    });
                })
            )
        );
        return;
    }

    // API 读接口：Network First，离线时用缓存兜底（离线可读）
    // 在线行为与原来完全一致；只有断网才读缓存
    if (url.pathname.startsWith('/api/')) {
        if (!isApiRead(url)) {
            return; // 非白名单 API：不碰
        }
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(API_CACHE).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => caches.open(API_CACHE).then(cache => cache.match(request)))
        );
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
