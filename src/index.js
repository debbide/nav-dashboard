export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;

        // CORS 头部
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
        };

        // 处理 OPTIONS 请求
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // API 路由
            if (pathname.startsWith('/api/')) {
                return await handleAPI(request, env, pathname, corsHeaders);
            }

            // 静态文件处理
            return await serveStatic(pathname, env);

        } catch (error) {
            console.error('Error:', error);
            return new Response('Error: ' + error.message, {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    },
};

// 文件列表缓存（内存缓存，Worker 生命周期内有效）
let cachedFileList = null;
let fileListCacheTime = 0;
const FILE_LIST_CACHE_TTL = 60000; // 60秒缓存

// 获取文件列表（带缓存）
async function getFileList(env) {
    const now = Date.now();
    if (cachedFileList && (now - fileListCacheTime) < FILE_LIST_CACHE_TTL) {
        return cachedFileList;
    }
    const list = await env.__STATIC_CONTENT.list();
    cachedFileList = list.keys.map(k => k.name);
    fileListCacheTime = now;
    return cachedFileList;
}

// 提供静态文件
async function serveStatic(pathname, env) {
    try {
        if (!env.__STATIC_CONTENT) {
            return new Response('__STATIC_CONTENT is not available', { status: 500 });
        }

        // 处理根路径和文件路径
        let requestedFile = pathname === '/' ? 'index.html' : pathname.substring(1);

        // 获取文件列表（使用缓存）
        const files = await getFileList(env);

        // 查找匹配的文件（考虑内容哈希）
        let actualFile = null;

        if (requestedFile === 'index.html' || requestedFile === 'admin.html') {
            // HTML 文件：index.*.html 或 admin.*.html
            const baseName = requestedFile.replace('.html', '');
            actualFile = files.find(f => f.match(new RegExp(`^${baseName}\\.[a-f0-9]+\\.html$`)));
        } else if (requestedFile.startsWith('css/') || requestedFile.startsWith('js/')) {
            // CSS/JS 文件：先尝试精确匹配，再尝试哈希匹配
            // 支持子目录如 js/modules/api.js
            actualFile = files.find(f => f === requestedFile);
            if (!actualFile) {
                // 尝试匹配带哈希的文件名
                const lastSlashIndex = requestedFile.lastIndexOf('/');
                const dir = requestedFile.substring(0, lastSlashIndex);
                const fileNameWithExt = requestedFile.substring(lastSlashIndex + 1);
                const ext = fileNameWithExt.split('.').pop();
                const fileName = fileNameWithExt.replace(/\.(css|js)$/, '');
                // 转义文件名中的特殊正则字符（如 - . 等）
                const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
                const escapedDir = dir.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
                actualFile = files.find(f => f.match(new RegExp(`^${escapedDir}/${escapedFileName}\\.[a-f0-9]+\\.${ext}$`)));
            }
        } else if (requestedFile.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i)) {
            // 图片文件：直接查找或带哈希
            actualFile = files.find(f => f === requestedFile);
            if (!actualFile) {
                const ext = requestedFile.split('.').pop();
                const baseName = requestedFile.replace(/\.[^.]+$/, '');
                // 转义文件名中的特殊正则字符（如 - . 等）
                const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
                actualFile = files.find(f => f.match(new RegExp(`^${escapedBaseName}\\.[a-f0-9]+\\.${ext}$`)));
            }
        } else if (requestedFile.match(/\.(json|webmanifest)$/i)) {
            // JSON/manifest 文件：先精确匹配，再尝试哈希匹配
            actualFile = files.find(f => f === requestedFile);
            if (!actualFile) {
                const ext = requestedFile.split('.').pop();
                const baseName = requestedFile.replace(/\.[^.]+$/, '');
                const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
                actualFile = files.find(f => f.match(new RegExp(`^${escapedBaseName}\\.[a-f0-9]+\\.${ext}$`)));
            }
        } else {
            // 其他文件直接查找
            actualFile = files.find(f => f === requestedFile);
        }

        // 如果找不到请求的文件
        if (!actualFile) {
            // JS/CSS/JSON 等资源文件不应回退到 index.html，直接返回 404
            if (requestedFile.match(/\.(js|css|json|png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$/i)) {
                return new Response('Not Found: ' + requestedFile, { status: 404 });
            }
            // 其他请求尝试返回 index.html（用于 SPA）
            actualFile = files.find(f => f.match(/^index\.[a-f0-9]+\.html$/));
            if (!actualFile) {
                return new Response('Not Found', { status: 404 });
            }
        }

        // 从 KV 获取文件内容
        const content = await env.__STATIC_CONTENT.get(actualFile);

        if (!content) {
            return new Response('File not found in storage', { status: 404 });
        }

        // 确定 Content-Type
        const contentType = getContentType(actualFile);

        return new Response(content, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': actualFile.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/)
                    ? 'public, max-age=31536000'
                    : 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Static file error:', error);
        return new Response('Error: ' + error.message, { status: 500 });
    }
}

// 获取 Content-Type
function getContentType(path) {
    const ext = path.split('.').pop().toLowerCase();
    const types = {
        'html': 'text/html;charset=UTF-8',
        'css': 'text/css;charset=UTF-8',
        'js': 'application/javascript;charset=UTF-8',
        'json': 'application/json;charset=UTF-8',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'ttf': 'font/ttf',
    };
    return types[ext] || 'application/octet-stream';
}

// ==================== 认证工具函数 ====================

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

// 生成 token
function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// 从请求中提取 token
function extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    const xAuthToken = request.headers.get('X-Auth-Token');
    if (xAuthToken) {
        return xAuthToken;
    }
    const cookies = request.headers.get('Cookie');
    if (cookies) {
        const match = cookies.match(/nav_token=([^;]+)/);
        if (match) {
            return match[1];
        }
    }
    return null;
}

// 验证 token（使用 KV 存储）
async function validateToken(token, env) {
    if (!token) return false;
    try {
        const data = await env.KV.get(`token:${token}`);
        if (!data) return false;
        const tokenData = JSON.parse(data);
        if (Date.now() > tokenData.expiry) {
            await env.KV.delete(`token:${token}`);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// 创建 token（存入 KV）
async function createToken(env) {
    const token = generateToken();
    const tokenData = {
        expiry: Date.now() + TOKEN_EXPIRY,
        createdAt: Date.now()
    };
    await env.KV.put(`token:${token}`, JSON.stringify(tokenData), {
        expirationTtl: 86400 // 24小时后自动删除
    });
    return token;
}

// 认证检查
async function requireAuth(request, env) {
    const token = extractToken(request);
    const isValid = await validateToken(token, env);
    if (!isValid) {
        return { authorized: false, error: '未登录或登录已过期，请先登录' };
    }
    return { authorized: true };
}

// ==================== API 处理函数 ====================

async function handleAPI(request, env, pathname, corsHeaders) {
    const method = request.method;

    // 需要认证的写操作
    const writeOperations = [
        { path: '/api/sites', methods: ['POST'] },
        { path: /^\/api\/sites\/\d+$/, methods: ['PUT', 'DELETE'] },
        { path: '/api/sites/reorder', methods: ['POST'] },
        { path: '/api/sites/restore-remote-logos', methods: ['POST'] },
        { path: '/api/categories', methods: ['POST'] },
        { path: /^\/api\/categories\/\d+$/, methods: ['PUT', 'DELETE'] },
        { path: '/api/categories/reorder', methods: ['POST'] },
        { path: '/api/settings/background', methods: ['PUT'] },
        { path: '/api/upload', methods: ['POST'] },
        { path: '/api/export', methods: ['GET'] },
        { path: '/api/import', methods: ['POST'] },
        { path: '/api/import/bookmarks', methods: ['POST'] },
        { path: '/api/tags', methods: ['POST'] },
        { path: /^\/api\/tags\/\d+$/, methods: ['PUT', 'DELETE'] },
        { path: /^\/api\/tags\/site\/\d+$/, methods: ['PUT'] },
    ];

    // 检查是否需要认证
    const needsAuth = writeOperations.some(op => {
        const pathMatch = typeof op.path === 'string'
            ? pathname === op.path
            : op.path.test(pathname);
        return pathMatch && op.methods.includes(method);
    });

    if (needsAuth) {
        const auth = await requireAuth(request, env);
        if (!auth.authorized) {
            return jsonResponse({ success: false, error: auth.error }, 401, corsHeaders);
        }
    }

    if (pathname === '/api/sites') {
        if (method === 'GET') return await getSites(request, env, corsHeaders);
        if (method === 'POST') return await createSite(request, env, corsHeaders);
    }

    // reorder必须在数字ID路由之前
    if (pathname === '/api/sites/reorder' && method === 'POST') {
        return await reorderSites(request, env, corsHeaders);
    }

    // 恢复网络图标 API
    if (pathname === '/api/sites/restore-remote-logos' && method === 'POST') {
        return await restoreRemoteLogos(env, corsHeaders);
    }

    if (pathname.match(/^\/api\/sites\/\d+$/)) {
        const id = pathname.split('/').pop();
        if (method === 'GET') return await getSite(id, env, corsHeaders);
        if (method === 'PUT') return await updateSite(id, request, env, corsHeaders);
        if (method === 'DELETE') return await deleteSite(id, env, corsHeaders);
    }

    if (pathname === '/api/categories') {
        if (method === 'GET') return await getCategories(env, corsHeaders);
        if (method === 'POST') return await createCategory(request, env, corsHeaders);
    }

    // 分类排序 API
    if (pathname === '/api/categories/reorder' && method === 'POST') {
        return await reorderCategories(request, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/categories\/\d+$/)) {
        const id = pathname.split('/').pop();
        if (method === 'PUT') return await updateCategory(id, request, env, corsHeaders);
        if (method === 'DELETE') return await deleteCategory(id, env, corsHeaders);
    }

    // Settings API
    if (pathname === '/api/settings/background') {
        if (method === 'GET') return await getBackgroundSetting(env, corsHeaders);
        if (method === 'PUT') return await updateBackgroundSetting(request, env, corsHeaders);
    }

    // Theme API
    if (pathname === '/api/settings/theme') {
        if (method === 'GET') return await getThemeSetting(env, corsHeaders);
        if (method === 'PUT') return await updateThemeSetting(request, env, corsHeaders);
    }

    // Layout API
    if (pathname === '/api/settings/layout') {
        if (method === 'GET') return await getLayoutSetting(env, corsHeaders);
        if (method === 'PUT') return await updateLayoutSetting(request, env, corsHeaders);
    }

    // Frontend Settings API (combined)
    if (pathname === '/api/settings/frontend' && method === 'GET') {
        return await getFrontendSettings(env, corsHeaders);
    }

    // Password API
    if (pathname === '/api/settings/password') {
        if (method === 'GET') return await getPasswordSetting(env, corsHeaders);
        if (method === 'PUT') return await updatePasswordSetting(request, env, corsHeaders);
    }

    if (pathname === '/api/auth/verify' && method === 'POST') {
        return await verifyPasswordAndLogin(request, env, corsHeaders);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
        return await logoutUser(request, env, corsHeaders);
    }

    if (pathname === '/api/auth/status' && method === 'GET') {
        return await getAuthStatus(request, env, corsHeaders);
    }

    if (pathname === '/api/upload' && method === 'POST') {
        return await uploadFile(request, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/images\/.+$/)) {
        const filename = pathname.split('/').pop();
        return await getImage(filename, env, corsHeaders);
    }

    // IP Detection API
    if (pathname === '/api/ip' && method === 'GET') {
        const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'Unknown';
        const country = request.cf?.country;
        const city = request.cf?.city;

        let location = '';
        if (country) location += country;
        if (city) location += (location ? ', ' : '') + city;

        return jsonResponse({
            ip: ip,
            location: location || 'Unknown Location',
            isp: request.cf?.asOrganization || 'Unknown ISP'
        }, 200, corsHeaders);
    }

    // Image Proxy API (CDN 缓存加速)
    if (pathname === '/api/proxy/image' && method === 'GET') {
        return await proxyImage(request, ctx, corsHeaders);
    }

    // 数据导出 API
    if (pathname === '/api/export' && method === 'GET') {
        return await exportData(env, corsHeaders);
    }

    // 数据导入 API
    if (pathname === '/api/import' && method === 'POST') {
        return await importData(request, env, corsHeaders);
    }

    // 书签导入 API
    if (pathname === '/api/import/bookmarks' && method === 'POST') {
        return await importBookmarks(request, env, corsHeaders);
    }

    // ==================== 标签 API ====================
    if (pathname === '/api/tags') {
        if (method === 'GET') return await getTags(env, corsHeaders);
        if (method === 'POST') return await createTag(request, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/tags\/\d+$/)) {
        const id = pathname.split('/').pop();
        if (method === 'PUT') return await updateTag(id, request, env, corsHeaders);
        if (method === 'DELETE') return await deleteTag(id, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/tags\/site\/\d+$/)) {
        const siteId = pathname.split('/').pop();
        if (method === 'GET') return await getSiteTags(siteId, env, corsHeaders);
        if (method === 'PUT') return await setSiteTags(siteId, request, env, corsHeaders);
    }

    if (pathname === '/api/tags/filter' && method === 'GET') {
        return await filterSitesByTags(request, env, corsHeaders);
    }

    return jsonResponse({ success: false, message: 'API Not Found' }, 404, corsHeaders);
}

// ==================== 图片代理 ====================

// 图片代理（利用 Cloudflare CDN 缓存加速）
async function proxyImage(request, ctx, corsHeaders) {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
        return new Response('Missing url parameter', {
            status: 400,
            headers: corsHeaders
        });
    }

    // 验证 URL 格式
    try {
        new URL(imageUrl);
    } catch {
        return new Response('Invalid url parameter', {
            status: 400,
            headers: corsHeaders
        });
    }

    // 生成缓存键（使用虚拟域名）
    const cacheKey = new Request(`https://img-cache.nav-dashboard.local/${encodeURIComponent(imageUrl)}`, {
        method: 'GET'
    });
    const cache = caches.default;

    // 尝试从 Cloudflare CDN 缓存获取
    let response = await cache.match(cacheKey);
    if (response) {
        return response;
    }

    // 从源站获取（带 5 秒超时）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const fetchResponse = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NavDashboard/1.0)',
                'Accept': 'image/*'
            }
        });
        clearTimeout(timeout);

        if (!fetchResponse.ok) {
            return new Response('Image fetch failed', {
                status: 502,
                headers: corsHeaders
            });
        }

        // 检查是否为图片类型
        const contentType = fetchResponse.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/')) {
            return new Response('Not an image', {
                status: 400,
                headers: corsHeaders
            });
        }

        // 构建缓存响应（7天 = 604800秒）
        response = new Response(fetchResponse.body, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=604800, immutable',
                ...corsHeaders
            }
        });

        // 异步写入 CDN 缓存
        ctx.waitUntil(cache.put(cacheKey, response.clone()));

        return response;
    } catch (error) {
        clearTimeout(timeout);
        // 超时或网络错误
        return new Response('Image proxy timeout', {
            status: 504,
            headers: corsHeaders
        });
    }
}

// ==================== 站点操作 ====================

async function getSites(request, env, corsHeaders) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page')) || 1;
    const pageSize = parseInt(url.searchParams.get('pageSize')) || 24;
    const offset = (page - 1) * pageSize;

    // 构建基础查询条件
    let whereClause = '';
    const params = [];

    if (search) {
        whereClause = ` WHERE s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    } else if (category && category !== 'all') {
        whereClause = ` WHERE s.category_id = ?`;
        params.push(category);
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM sites s${whereClause}`;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // 获取分页数据
    const dataQuery = `
        SELECT s.*, c.name as category_name, c.color as category_color 
        FROM sites s 
        LEFT JOIN categories c ON s.category_id = c.id
        ${whereClause}
        ORDER BY s.sort_order ASC, s.created_at DESC
        LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, pageSize, offset];
    const { results } = await env.DB.prepare(dataQuery).bind(...dataParams).all();

    return jsonResponse({
        success: true,
        data: results,
        pagination: {
            page,
            pageSize,
            total,
            hasMore: offset + results.length < total
        }
    }, 200, corsHeaders);
}

async function getSite(id, env, corsHeaders) {
    const { results } = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).all();
    if (results.length === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }
    return jsonResponse({ success: true, data: results[0] }, 200, corsHeaders);
}

async function createSite(request, env, corsHeaders) {
    const data = await request.json();
    const { name, url, description, logo, category_id, sort_order } = data;

    if (!name || !url) {
        return jsonResponse({ success: false, message: '站点名称和URL为必填项' }, 400, corsHeaders);
    }

    // 如果没有提供 logo，使用 Google Favicon API 作为默认图标
    let siteLogo = logo;
    if (!siteLogo) {
        try {
            const domain = new URL(url).hostname;
            siteLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        } catch (e) {
            siteLogo = '';
        }
    }

    const result = await env.DB.prepare(`
    INSERT INTO sites (name, url, description, logo, category_id, sort_order) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(name, url, description || '', siteLogo, category_id || null, sort_order || 0).run();

    return jsonResponse({
        success: true,
        message: '站点创建成功',
        data: { id: result.meta.last_row_id }
    }, 200, corsHeaders);
}

async function updateSite(id, request, env, corsHeaders) {
    const data = await request.json();
    const { name, url, description, logo, category_id, sort_order } = data;

    if (!name || !url) {
        return jsonResponse({ success: false, message: '站点名称和URL为必填项' }, 400, corsHeaders);
    }

    // 如果没有提供 logo，使用 Google Favicon API 作为默认图标
    let siteLogo = logo;
    if (!siteLogo) {
        try {
            const domain = new URL(url).hostname;
            siteLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        } catch (e) {
            siteLogo = '';
        }
    }

    const result = await env.DB.prepare(`
    UPDATE sites 
    SET name = ?, url = ?, description = ?, logo = ?, category_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(name, url, description || '', siteLogo, category_id || null, sort_order || 0, id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '站点更新成功' }, 200, corsHeaders);
}

async function deleteSite(id, env, corsHeaders) {
    const result = await env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '站点删除成功' }, 200, corsHeaders);
}

// 恢复网络图标（将所有站点图标恢复为 Google Favicon）
async function restoreRemoteLogos(env, corsHeaders) {
    try {
        // 获取所有站点
        const { results: sites } = await env.DB.prepare('SELECT id, url FROM sites').all();

        let updated = 0;
        let failed = 0;

        for (const site of sites) {
            try {
                const domain = new URL(site.url).hostname;
                const logo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;

                await env.DB.prepare('UPDATE sites SET logo = ? WHERE id = ?')
                    .bind(logo, site.id)
                    .run();
                updated++;
            } catch (e) {
                console.error(`恢复图标失败 [ID: ${site.id}]:`, e.message);
                failed++;
            }
        }

        return jsonResponse({
            success: true,
            message: `图标恢复完成: 成功 ${updated} 个` + (failed > 0 ? `, 失败 ${failed} 个` : ''),
            updated,
            failed,
            total: sites.length
        }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({ success: false, message: '恢复失败: ' + error.message }, 500, corsHeaders);
    }
}

// ==================== 分类操作 ====================

// 批量更新站点排序
async function reorderSites(request, env, corsHeaders) {
    try {
        const { order } = await request.json();

        if (!order || !Array.isArray(order)) {
            return jsonResponse({ success: false, message: '无效的排序数据' }, 400, corsHeaders);
        }

        // 批量更新排序
        for (const item of order) {
            await env.DB.prepare('UPDATE sites SET sort_order = ? WHERE id = ?')
                .bind(item.sort_order, item.id)
                .run();
        }

        return jsonResponse({ success: true, message: '排序更新成功' }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({ success: false, message: '排序更新失败: ' + error.message }, 500, corsHeaders);
    }
}

async function getCategories(env, corsHeaders) {
    const { results } = await env.DB.prepare(`
    SELECT c.*, 
    (SELECT COUNT(*) FROM sites WHERE category_id = c.id) as sites_count
    FROM categories c
    ORDER BY c.sort_order ASC, c.created_at ASC
  `).all();

    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
}

async function createCategory(request, env, corsHeaders) {
    const data = await request.json();
    const { name, icon, color, sort_order } = data;

    if (!name) {
        return jsonResponse({ success: false, message: '分类名称为必填项' }, 400, corsHeaders);
    }

    const result = await env.DB.prepare(`
    INSERT INTO categories (name, icon, color, sort_order) 
    VALUES (?, ?, ?, ?)
  `).bind(name, icon || '', color || '#ff9a56', sort_order || 0).run();

    return jsonResponse({
        success: true,
        message: '分类创建成功',
        data: { id: result.meta.last_row_id }
    }, 200, corsHeaders);
}

async function updateCategory(id, request, env, corsHeaders) {
    const data = await request.json();
    const { name, icon, color, sort_order } = data;

    if (!name) {
        return jsonResponse({ success: false, message: '分类名称为必填项' }, 400, corsHeaders);
    }

    const result = await env.DB.prepare(`
    UPDATE categories 
    SET name = ?, icon = ?, color = ?, sort_order = ?
    WHERE id = ?
  `).bind(name, icon || '', color || '#ff9a56', sort_order || 0, id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '分类不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '分类更新成功' }, 200, corsHeaders);
}

async function deleteCategory(id, env, corsHeaders) {
    const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM sites WHERE category_id = ?').bind(id).all();
    if (results[0].count > 0) {
        return jsonResponse({
            success: false,
            message: `此分类下还有 ${results[0].count} 个站点，无法删除`
        }, 400, corsHeaders);
    }

    const result = await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '分类不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '分类删除成功' }, 200, corsHeaders);
}

// 批量更新分类排序
async function reorderCategories(request, env, corsHeaders) {
    try {
        const { order } = await request.json();

        if (!order || !Array.isArray(order)) {
            return jsonResponse({ success: false, message: '无效的排序数据' }, 400, corsHeaders);
        }

        for (const item of order) {
            await env.DB.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
                .bind(item.sort_order, item.id)
                .run();
        }

        return jsonResponse({ success: true, message: '分类排序更新成功' }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({ success: false, message: '排序更新失败: ' + error.message }, 500, corsHeaders);
    }
}

// ==================== 文件上传 ====================

async function uploadFile(request, env, corsHeaders) {
    try {
        const formData = await request.formData();
        const file = formData.get('image');

        if (!file) {
            return jsonResponse({ success: false, message: '没有上传文件' }, 400, corsHeaders);
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon'];
        if (!allowedTypes.includes(file.type)) {
            return jsonResponse({ success: false, message: '只支持图片文件' }, 400, corsHeaders);
        }

        if (file.size > 2 * 1024 * 1024) {
            return jsonResponse({ success: false, message: '文件大小不能超过 2MB' }, 400, corsHeaders);
        }

        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuffer);

        await env.KV.put(`image:${filename}`, base64Data, {
            metadata: {
                contentType: file.type,
                originalName: file.name,
                size: file.size,
                uploadTime: new Date().toISOString()
            }
        });

        return jsonResponse({
            success: true,
            message: '上传成功',
            data: { url: `/api/images/${filename}` }
        }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({ success: false, message: error.message }, 500, corsHeaders);
    }
}

async function getImage(filename, env, corsHeaders) {
    try {
        const { value, metadata } = await env.KV.getWithMetadata(`image:${filename}`);

        if (!value) {
            return new Response('Image not found', { status: 404 });
        }

        const arrayBuffer = base64ToArrayBuffer(value);

        return new Response(arrayBuffer, {
            headers: {
                'Content-Type': metadata?.contentType || 'image/png',
                'Cache-Control': 'public, max-age=31536000',
                ...corsHeaders
            }
        });
    } catch (error) {
        return new Response('Error loading image', { status: 500 });
    }
}

// ==================== 工具函数 ====================

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    });
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// ==================== Settings API Functions ====================

// 获取背景图设置
async function getBackgroundSetting(env, headers) {
    try {
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('background_image')
            .first();

        const backgroundUrl = result ? result.value : 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop';

        return jsonResponse({ background_image: backgroundUrl }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 更新背景图设置
async function updateBackgroundSetting(request, env, headers) {
    try {
        const { background_image } = await request.json();

        if (!background_image) {
            return jsonResponse({ success: false, error: '背景图URL不能为空' }, 400, headers);
        }

        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('background_image', background_image)
            .run();

        return jsonResponse({ message: '背景图更新成功', background_image }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// ==================== 主题和布局设置 ====================

// 默认配置
const DEFAULT_THEME = {
    primaryColor: '#a78bfa',
    accentColor: '#e879f9',
    cardStyle: 'glass',
    cardRadius: 12,
    darkMode: false
};

const DEFAULT_LAYOUT = {
    viewMode: 'grid',
    columns: 6,
    cardSize: 'medium',
    showDescription: false,
    showCategory: false
};

// 获取主题设置
async function getThemeSetting(env, headers) {
    try {
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('theme')
            .first();

        let theme = DEFAULT_THEME;
        if (result?.value) {
            try {
                theme = { ...DEFAULT_THEME, ...JSON.parse(result.value) };
            } catch (e) {}
        }

        return jsonResponse({ success: true, data: theme }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 更新主题设置
async function updateThemeSetting(request, env, headers) {
    try {
        const { primaryColor, accentColor, cardStyle, cardRadius, darkMode } = await request.json();

        // 验证颜色格式
        const colorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (primaryColor && !colorRegex.test(primaryColor)) {
            return jsonResponse({ success: false, error: '主题色格式无效' }, 400, headers);
        }

        // 验证卡片样式
        const validStyles = ['glass', 'solid', 'minimal'];
        if (cardStyle && !validStyles.includes(cardStyle)) {
            return jsonResponse({ success: false, error: '卡片样式无效' }, 400, headers);
        }

        // 获取现有设置
        const existing = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('theme')
            .first();

        let currentTheme = DEFAULT_THEME;
        if (existing?.value) {
            try {
                currentTheme = { ...DEFAULT_THEME, ...JSON.parse(existing.value) };
            } catch (e) {}
        }

        // 合并新设置
        const newTheme = {
            ...currentTheme,
            ...(primaryColor && { primaryColor }),
            ...(accentColor && { accentColor }),
            ...(cardStyle && { cardStyle }),
            ...(cardRadius !== undefined && { cardRadius }),
            ...(darkMode !== undefined && { darkMode })
        };

        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('theme', JSON.stringify(newTheme))
            .run();

        return jsonResponse({ success: true, message: '主题设置已保存', data: newTheme }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 获取布局设置
async function getLayoutSetting(env, headers) {
    try {
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('layout')
            .first();

        let layout = DEFAULT_LAYOUT;
        if (result?.value) {
            try {
                layout = { ...DEFAULT_LAYOUT, ...JSON.parse(result.value) };
            } catch (e) {}
        }

        return jsonResponse({ success: true, data: layout }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 更新布局设置
async function updateLayoutSetting(request, env, headers) {
    try {
        const { viewMode, columns, cardSize, showDescription, showCategory } = await request.json();

        // 验证视图模式
        const validModes = ['grid', 'list', 'compact'];
        if (viewMode && !validModes.includes(viewMode)) {
            return jsonResponse({ success: false, error: '视图模式无效' }, 400, headers);
        }

        // 验证列数
        if (columns !== undefined && (typeof columns !== 'number' || columns < 4 || columns > 8)) {
            return jsonResponse({ success: false, error: '列数无效（4-8）' }, 400, headers);
        }

        // 获取现有设置
        const existing = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('layout')
            .first();

        let currentLayout = DEFAULT_LAYOUT;
        if (existing?.value) {
            try {
                currentLayout = { ...DEFAULT_LAYOUT, ...JSON.parse(existing.value) };
            } catch (e) {}
        }

        // 合并新设置
        const newLayout = {
            ...currentLayout,
            ...(viewMode && { viewMode }),
            ...(columns !== undefined && { columns }),
            ...(cardSize && { cardSize }),
            ...(showDescription !== undefined && { showDescription }),
            ...(showCategory !== undefined && { showCategory })
        };

        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('layout', JSON.stringify(newLayout))
            .run();

        return jsonResponse({ success: true, message: '布局设置已保存', data: newLayout }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 获取所有前端设置（单次查询优化）
async function getFrontendSettings(env, headers) {
    try {
        // 使用单次查询获取所有设置
        const { results } = await env.DB.prepare(
            "SELECT key, value FROM settings WHERE key IN ('background_image', 'theme', 'layout')"
        ).all();

        // 转换为 map
        const settingsMap = {};
        for (const row of results) {
            settingsMap[row.key] = row.value;
        }

        let theme = DEFAULT_THEME;
        let layout = DEFAULT_LAYOUT;

        if (settingsMap.theme) {
            try { theme = { ...DEFAULT_THEME, ...JSON.parse(settingsMap.theme) }; } catch (e) {}
        }
        if (settingsMap.layout) {
            try { layout = { ...DEFAULT_LAYOUT, ...JSON.parse(settingsMap.layout) }; } catch (e) {}
        }

        return jsonResponse({
            success: true,
            data: {
                background_image: settingsMap.background_image || 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop',
                theme,
                layout
            }
        }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 获取密码设置
async function getPasswordSetting(env, headers) {
    try {
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('admin_password')
            .first();

        const password = result ? result.value : 'admin123';
        return jsonResponse({ has_password: true }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 更新密码设置（使用哈希）
async function updatePasswordSetting(request, env, headers) {
    try {
        const { old_password, new_password } = await request.json();

        if (!new_password || new_password.length < 4) {
            return jsonResponse({ success: false, error: '新密码不能少于4位' }, 400, headers);
        }

        // 获取当前密码
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('admin_password')
            .first();

        const storedPassword = result ? result.value : null;

        // 验证旧密码（支持明文和哈希两种格式）
        const oldPasswordHash = await hashPassword(old_password);
        const isValid = storedPassword === null
            ? old_password === 'admin123'  // 默认密码
            : (storedPassword === old_password || storedPassword === oldPasswordHash);

        if (!isValid) {
            return jsonResponse({ success: false, error: '原密码错误' }, 401, headers);
        }

        // 存储新密码的哈希
        const newPasswordHash = await hashPassword(new_password);
        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('admin_password', newPasswordHash)
            .run();

        return jsonResponse({ message: '密码修改成功' }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 验证密码并登录（返回 token）
async function verifyPasswordAndLogin(request, env, headers) {
    try {
        const { password } = await request.json();

        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('admin_password')
            .first();

        const storedPassword = result ? result.value : null;
        const passwordHash = await hashPassword(password);

        // 支持明文密码（向后兼容）和哈希密码
        const isValid = storedPassword === null
            ? password === 'admin123'  // 默认密码
            : (storedPassword === password || storedPassword === passwordHash);

        if (isValid) {
            // 生成 token
            const token = await createToken(env);

            return new Response(JSON.stringify({ success: true, token }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': `nav_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
                    ...headers
                }
            });
        } else {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// 登出
async function logoutUser(request, env, headers) {
    const token = extractToken(request);
    if (token) {
        await env.KV.delete(`token:${token}`);
    }
    return new Response(JSON.stringify({ success: true, message: '已登出' }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'nav_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
            ...headers
        }
    });
}

// 检查认证状态
async function getAuthStatus(request, env, headers) {
    const token = extractToken(request);
    const isValid = await validateToken(token, env);
    return jsonResponse({ success: true, authenticated: isValid }, 200, headers);
}

// 验证密码（保留旧函数名兼容）
async function verifyPassword(request, env, headers) {
    try {
        const { password } = await request.json();

        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
            .bind('admin_password')
            .first();

        const storedPassword = result ? result.value : null;
        const passwordHash = await hashPassword(password);

        // 支持明文密码（向后兼容）和哈希密码
        const isValid = storedPassword === null
            ? password === 'admin123'  // 默认密码
            : (storedPassword === password || storedPassword === passwordHash);

        if (isValid) {
            return jsonResponse({ success: true }, 200, headers);
        } else {
            return jsonResponse({ success: false, error: '密码错误' }, 401, headers);
        }
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500, headers);
    }
}

// SHA-256 密码哈希
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 数据导出导入 ====================

// 导出所有数据
async function exportData(env, headers) {
    try {
        // 获取分类
        const { results: categories } = await env.DB.prepare(`
            SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order ASC
        `).all();

        // 获取站点
        const { results: sites } = await env.DB.prepare(`
            SELECT id, name, url, description, logo, category_id, sort_order FROM sites ORDER BY sort_order ASC
        `).all();

        // 获取设置（排除密码）
        const { results: settings } = await env.DB.prepare(`
            SELECT key, value FROM settings WHERE key != 'admin_password'
        `).all();

        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            categories,
            sites,
            settings
        };

        return new Response(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': 'attachment; filename="nav-dashboard-backup.json"',
                ...headers
            }
        });
    } catch (error) {
        return jsonResponse({ success: false, message: '导出失败: ' + error.message }, 500, headers);
    }
}

// 导入数据
async function importData(request, env, headers) {
    try {
        const data = await request.json();

        if (!data.categories || !data.sites) {
            return jsonResponse({ success: false, message: '无效的导入数据格式' }, 400, headers);
        }

        // 验证数据格式
        if (!Array.isArray(data.categories) || !Array.isArray(data.sites)) {
            return jsonResponse({ success: false, message: '无效的数据格式：categories 和 sites 必须是数组' }, 400, headers);
        }

        // 验证每个分类和站点的必要字段
        for (const cat of data.categories) {
            if (!cat.name) {
                return jsonResponse({ success: false, message: '分类数据缺少 name 字段' }, 400, headers);
            }
        }
        for (const site of data.sites) {
            if (!site.name || !site.url) {
                return jsonResponse({ success: false, message: '站点数据缺少 name 或 url 字段' }, 400, headers);
            }
        }

        console.log(`数据验证通过: ${data.categories.length} 个分类, ${data.sites.length} 个站点`);

        // 构建所有 SQL 语句
        const allStatements = [];

        // 1. 清空现有数据
        allStatements.push(env.DB.prepare('DELETE FROM sites'));
        allStatements.push(env.DB.prepare('DELETE FROM categories'));
        allStatements.push(env.DB.prepare("DELETE FROM settings WHERE key != 'admin_password'"));

        // 2. 插入分类（按顺序，使用递增 ID）
        for (let i = 0; i < data.categories.length; i++) {
            const cat = data.categories[i];
            allStatements.push(
                env.DB.prepare(`INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)`)
                    .bind(i + 1, cat.name || '未命名分类', cat.icon || '📁', cat.color || '#ff9a56', cat.sort_order || 0)
            );
        }

        // 3. 创建分类 ID 映射（旧 ID -> 新 ID）
        const categoryIdMap = {};
        for (let i = 0; i < data.categories.length; i++) {
            categoryIdMap[data.categories[i].id] = i + 1;
        }

        // 4. 插入站点
        for (const site of data.sites) {
            const newCategoryId = site.category_id ? (categoryIdMap[site.category_id] || null) : null;
            allStatements.push(
                env.DB.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
                    .bind(site.name || '未命名站点', site.url || '', site.description || '', site.logo || '', newCategoryId, site.sort_order || 0)
            );
        }

        // 5. 插入设置
        if (data.settings && Array.isArray(data.settings)) {
            for (const setting of data.settings) {
                if (setting.key && setting.key !== 'admin_password') {
                    allStatements.push(
                        env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
                            .bind(setting.key, setting.value || '')
                    );
                }
            }
        }

        // 6. 使用 batch 执行所有语句（原子操作）
        console.log(`准备执行 ${allStatements.length} 条 SQL 语句`);
        await env.DB.batch(allStatements);

        return jsonResponse({
            success: true,
            message: `导入成功: ${data.categories.length} 个分类, ${data.sites.length} 个站点`
        }, 200, headers);
    } catch (error) {
        console.error('导入失败:', error);
        return jsonResponse({ success: false, message: '导入失败: ' + error.message }, 500, headers);
    }
}


// 书签导入
async function importBookmarks(request, env, headers) {
    try {
        const html = await request.text();

        if (!html || !html.includes('<DT>')) {
            return jsonResponse({ success: false, message: '无效的书签文件格式' }, 400, headers);
        }

        // 解析书签 HTML
        const bookmarks = parseBookmarkHtml(html);

        if (bookmarks.length === 0) {
            return jsonResponse({ success: false, message: '未找到有效的书签' }, 400, headers);
        }

        console.log(`解析到 ${bookmarks.length} 个书签`);

        // 获取现有分类
        const { results: existingCategories } = await env.DB.prepare('SELECT id, name FROM categories').all();
        const categoryMap = {};
        for (const cat of existingCategories) {
            categoryMap[cat.name.toLowerCase()] = cat.id;
        }

        // 统计
        let categoriesCreated = 0;
        let sitesCreated = 0;
        let sitesSkipped = 0;

        // 获取现有站点 URL（去重用）
        const { results: existingSites } = await env.DB.prepare('SELECT url FROM sites').all();
        const existingUrls = new Set(existingSites.map(s => s.url.toLowerCase()));

        // 处理书签
        for (const bookmark of bookmarks) {
            // 处理分类
            let categoryId = null;
            if (bookmark.folder) {
                const folderLower = bookmark.folder.toLowerCase();
                if (categoryMap[folderLower]) {
                    categoryId = categoryMap[folderLower];
                } else {
                    // 创建新分类
                    const result = await env.DB.prepare(`
                        INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)
                    `).bind(bookmark.folder, '📁', '#a78bfa', 0).run();

                    categoryId = result.meta?.last_row_id;
                    if (categoryId) {
                        categoryMap[folderLower] = categoryId;
                        categoriesCreated++;
                    }
                }
            }

            // 跳过已存在的 URL
            if (existingUrls.has(bookmark.url.toLowerCase())) {
                sitesSkipped++;
                continue;
            }

            // 创建站点
            try {
                const logo = `https://www.google.com/s2/favicons?sz=128&domain=${new URL(bookmark.url).hostname}`;
                await env.DB.prepare(`
                    INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)
                `).bind(bookmark.name, bookmark.url, '', logo, categoryId, 0).run();

                existingUrls.add(bookmark.url.toLowerCase());
                sitesCreated++;
            } catch (siteError) {
                console.error(`创建站点失败: ${bookmark.name}`, siteError);
            }
        }

        return jsonResponse({
            success: true,
            message: `导入完成: 新建 ${categoriesCreated} 个分类, ${sitesCreated} 个站点` +
                (sitesSkipped > 0 ? `, 跳过 ${sitesSkipped} 个重复` : '')
        }, 200, headers);
    } catch (error) {
        console.error('书签导入失败:', error);
        return jsonResponse({ success: false, message: '书签导入失败: ' + error.message }, 500, headers);
    }
}

// 解析书签 HTML
function parseBookmarkHtml(html) {
    const bookmarks = [];
    let currentFolder = null;

    // 匹配文件夹
    const folderRegex = /<DT><H3[^>]*>([^<]+)<\/H3>/gi;
    // 匹配链接
    const linkRegex = /<DT><A[^>]*HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;

    // 按行处理以保持文件夹上下文
    const lines = html.split('\n');
    let depth = 0;
    const folderStack = [];

    for (const line of lines) {
        // 检测文件夹开始
        const folderMatch = /<DT><H3[^>]*>([^<]+)<\/H3>/i.exec(line);
        if (folderMatch) {
            currentFolder = folderMatch[1].trim();
            folderStack.push(currentFolder);
            depth++;
            continue;
        }

        // 检测文件夹结束
        if (line.includes('</DL>')) {
            folderStack.pop();
            currentFolder = folderStack[folderStack.length - 1] || null;
            depth = Math.max(0, depth - 1);
            continue;
        }

        // 检测链接
        const linkMatch = /<DT><A[^>]*HREF="([^"]+)"[^>]*>([^<]+)<\/A>/i.exec(line);
        if (linkMatch) {
            const url = linkMatch[1].trim();
            const name = linkMatch[2].trim();

            // 只处理 http/https 链接
            if (url.startsWith('http://') || url.startsWith('https://')) {
                bookmarks.push({
                    name: name,
                    url: url,
                    folder: currentFolder
                });
            }
        }
    }

    return bookmarks;
}

// ==================== 标签操作 ====================

// 获取所有标签
async function getTags(env, headers) {
    const { results } = await env.DB.prepare(`
        SELECT t.*,
        (SELECT COUNT(*) FROM site_tags WHERE tag_id = t.id) as sites_count
        FROM tags t
        ORDER BY t.name ASC
    `).all();

    return jsonResponse({ success: true, data: results }, 200, headers);
}

// 创建标签
async function createTag(request, env, headers) {
    try {
        const { name, color } = await request.json();

        if (!name || !name.trim()) {
            return jsonResponse({ success: false, message: '标签名称不能为空' }, 400, headers);
        }

        const result = await env.DB.prepare('INSERT INTO tags (name, color) VALUES (?, ?)')
            .bind(name.trim(), color || '#6366f1')
            .run();

        return jsonResponse({
            success: true,
            message: '标签创建成功',
            data: { id: result.meta.last_row_id }
        }, 200, headers);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return jsonResponse({ success: false, message: '标签名称已存在' }, 400, headers);
        }
        return jsonResponse({ success: false, message: error.message }, 500, headers);
    }
}

// 更新标签
async function updateTag(id, request, env, headers) {
    try {
        const { name, color } = await request.json();

        if (!name || !name.trim()) {
            return jsonResponse({ success: false, message: '标签名称不能为空' }, 400, headers);
        }

        const result = await env.DB.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
            .bind(name.trim(), color || '#6366f1', id)
            .run();

        if (result.meta.changes === 0) {
            return jsonResponse({ success: false, message: '标签不存在' }, 404, headers);
        }

        return jsonResponse({ success: true, message: '标签更新成功' }, 200, headers);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return jsonResponse({ success: false, message: '标签名称已存在' }, 400, headers);
        }
        return jsonResponse({ success: false, message: error.message }, 500, headers);
    }
}

// 删除标签
async function deleteTag(id, env, headers) {
    const result = await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '标签不存在' }, 404, headers);
    }

    return jsonResponse({ success: true, message: '标签删除成功' }, 200, headers);
}

// 获取站点的标签
async function getSiteTags(siteId, env, headers) {
    const { results } = await env.DB.prepare(`
        SELECT t.* FROM tags t
        INNER JOIN site_tags st ON t.id = st.tag_id
        WHERE st.site_id = ?
        ORDER BY t.name ASC
    `).bind(siteId).all();

    return jsonResponse({ success: true, data: results }, 200, headers);
}

// 设置站点的标签
async function setSiteTags(siteId, request, env, headers) {
    try {
        const { tag_ids } = await request.json();

        if (!Array.isArray(tag_ids)) {
            return jsonResponse({ success: false, message: 'tag_ids 必须是数组' }, 400, headers);
        }

        // 检查站点是否存在
        const site = await env.DB.prepare('SELECT id FROM sites WHERE id = ?').bind(siteId).first();
        if (!site) {
            return jsonResponse({ success: false, message: '站点不存在' }, 404, headers);
        }

        // 删除现有标签关联
        await env.DB.prepare('DELETE FROM site_tags WHERE site_id = ?').bind(siteId).run();

        // 添加新的标签关联
        for (const tagId of tag_ids) {
            await env.DB.prepare('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)')
                .bind(siteId, tagId)
                .run();
        }

        return jsonResponse({ success: true, message: '站点标签更新成功' }, 200, headers);
    } catch (error) {
        return jsonResponse({ success: false, message: error.message }, 500, headers);
    }
}

// 按标签筛选站点
async function filterSitesByTags(request, env, headers) {
    const url = new URL(request.url);
    const tagIdsParam = url.searchParams.get('tag_ids');
    const page = parseInt(url.searchParams.get('page')) || 1;
    const pageSize = parseInt(url.searchParams.get('pageSize')) || 24;
    const offset = (page - 1) * pageSize;

    if (!tagIdsParam) {
        return jsonResponse({ success: false, message: '请指定标签ID' }, 400, headers);
    }

    const tagIdArray = tagIdsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    if (tagIdArray.length === 0) {
        return jsonResponse({ success: false, message: '无效的标签ID' }, 400, headers);
    }

    const placeholders = tagIdArray.map(() => '?').join(',');

    // 查询同时拥有所有指定标签的站点数量
    const countQuery = `
        SELECT COUNT(*) as count FROM (
            SELECT s.id
            FROM sites s
            INNER JOIN site_tags st ON s.id = st.site_id
            WHERE st.tag_id IN (${placeholders})
            GROUP BY s.id
            HAVING COUNT(DISTINCT st.tag_id) = ?
        )
    `;
    const countResult = await env.DB.prepare(countQuery).bind(...tagIdArray, tagIdArray.length).first();
    const total = countResult?.count || 0;

    // 查询站点数据
    const dataQuery = `
        SELECT DISTINCT s.*, c.name as category_name, c.color as category_color
        FROM sites s
        LEFT JOIN categories c ON s.category_id = c.id
        INNER JOIN site_tags st ON s.id = st.site_id
        WHERE st.tag_id IN (${placeholders})
        GROUP BY s.id
        HAVING COUNT(DISTINCT st.tag_id) = ?
        ORDER BY s.sort_order ASC, s.created_at DESC
        LIMIT ? OFFSET ?
    `;
    const { results } = await env.DB.prepare(dataQuery)
        .bind(...tagIdArray, tagIdArray.length, pageSize, offset)
        .all();

    return jsonResponse({
        success: true,
        data: results,
        pagination: {
            page,
            pageSize,
            total,
            hasMore: offset + results.length < total
        }
    }, 200, headers);
}
