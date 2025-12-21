export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const { pathname } = url;

        // CORS 头部
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // 处理 OPTIONS 请求
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // API 路由
            if (pathname.startsWith('/api/')) {
                // API 请求限流检查
                const rateLimitResult = await checkRateLimit(request, env);
                if (!rateLimitResult.allowed) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: '请求过于频繁，请稍后再试'
                    }), {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': '60',
                            ...corsHeaders
                        }
                    });
                }
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

// 提供静态文件
async function serveStatic(pathname, env) {
    try {
        if (!env.__STATIC_CONTENT) {
            return new Response('__STATIC_CONTENT is not available', { status: 500 });
        }

        // 处理根路径和文件路径
        let requestedFile = pathname === '/' ? 'index.html' : pathname.substring(1);

        // 列出所有文件以查找匹配的哈希文件
        const list = await env.__STATIC_CONTENT.list();
        const files = list.keys.map(k => k.name);

        // 查找匹配的文件（考虑内容哈希）
        let actualFile = null;

        if (requestedFile === 'index.html' || requestedFile === 'admin.html') {
            // HTML 文件：index.*.html 或 admin.*.html
            const baseName = requestedFile.replace('.html', '');
            actualFile = files.find(f => f.match(new RegExp(`^${baseName}\\.[a-f0-9]+\\.html$`)));
        } else if (requestedFile.startsWith('css/') || requestedFile.startsWith('js/')) {
            // CSS/JS 文件：先尝试精确匹配，再尝试哈希匹配
            // 例如 js/admin.js 或 js/admin.abc123.js
            actualFile = files.find(f => f === requestedFile);
            if (!actualFile) {
                const parts = requestedFile.split('/');
                const dir = parts[0];
                const fileName = parts[1].replace(/\.(css|js)$/, '');
                const ext = parts[1].split('.').pop();
                // 转义文件名中的特殊正则字符（如 - . 等）
                const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
                actualFile = files.find(f => f.match(new RegExp(`^${dir}/${escapedFileName}\\.[a-f0-9]+\\.${ext}$`)));
            }
        } else if (requestedFile.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i)) {
            // 图片文件：直接查找或带哈希
            const ext = requestedFile.split('.').pop();
            const baseName = requestedFile.replace(/\.[^.]+$/, '');
            actualFile = files.find(f => f === requestedFile) ||
                files.find(f => f.match(new RegExp(`^${baseName}\\.[a-f0-9]+\\.${ext}$`)));
        } else {
            // 其他文件直接查找
            actualFile = files.find(f => f === requestedFile);
        }

        // 如果找不到请求的文件，尝试返回 index.html（用于 SPA）
        if (!actualFile) {
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

// ==================== API 处理函数 ====================

async function handleAPI(request, env, pathname, corsHeaders) {
    const method = request.method;

    if (pathname === '/api/sites') {
        if (method === 'GET') return await getSites(request, env, corsHeaders);
        if (method === 'POST') return await createSite(request, env, corsHeaders);
    }

    // reorder必须在数字ID路由之前
    if (pathname === '/api/sites/reorder' && method === 'POST') {
        return await reorderSites(request, env, corsHeaders);
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

    // Password API
    if (pathname === '/api/settings/password') {
        if (method === 'GET') return await getPasswordSetting(env, corsHeaders);
        if (method === 'PUT') return await updatePasswordSetting(request, env, corsHeaders);
    }

    if (pathname === '/api/auth/verify' && method === 'POST') {
        return await verifyPassword(request, env, corsHeaders);
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

    const result = await env.DB.prepare(`
    INSERT INTO sites (name, url, description, logo, category_id, sort_order) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(name, url, description || '', logo || '', category_id || null, sort_order || 0).run();

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

    const result = await env.DB.prepare(`
    UPDATE sites 
    SET name = ?, url = ?, description = ?, logo = ?, category_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(name, url, description || '', logo || '', category_id || null, sort_order || 0, id).run();

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
        return jsonResponse({ error: error.message }, 500, headers);
    }
}

// 更新背景图设置
async function updateBackgroundSetting(request, env, headers) {
    try {
        const { background_image } = await request.json();

        if (!background_image) {
            return jsonResponse({ error: '背景图URL不能为空' }, 400, headers);
        }

        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('background_image', background_image)
            .run();

        return jsonResponse({ message: '背景图更新成功', background_image }, 200, headers);
    } catch (error) {
        return jsonResponse({ error: error.message }, 500, headers);
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
        return jsonResponse({ error: error.message }, 500, headers);
    }
}

// 更新密码设置（使用哈希）
async function updatePasswordSetting(request, env, headers) {
    try {
        const { old_password, new_password } = await request.json();

        if (!new_password || new_password.length < 4) {
            return jsonResponse({ error: '新密码不能少于4位' }, 400, headers);
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
            return jsonResponse({ error: '原密码错误' }, 401, headers);
        }

        // 存储新密码的哈希
        const newPasswordHash = await hashPassword(new_password);
        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .bind('admin_password', newPasswordHash)
            .run();

        return jsonResponse({ message: '密码修改成功' }, 200, headers);
    } catch (error) {
        return jsonResponse({ error: error.message }, 500, headers);
    }
}

// 验证密码（支持明文和哈希）
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
        return jsonResponse({ error: error.message }, 500, headers);
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

// API 请求限流检查（100次/分钟）
async function checkRateLimit(request, env) {
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const key = `ratelimit:${ip}`;
    const limit = 100;  // 每分钟最大请求数
    const window = 60;  // 时间窗口（秒）

    try {
        // 从 KV 获取当前计数
        const data = await env.KV.get(key, 'json');
        const now = Math.floor(Date.now() / 1000);

        if (data && data.timestamp > now - window) {
            // 在时间窗口内
            if (data.count >= limit) {
                return { allowed: false, remaining: 0 };
            }
            // 增加计数
            await env.KV.put(key, JSON.stringify({
                count: data.count + 1,
                timestamp: data.timestamp
            }), { expirationTtl: window });
            return { allowed: true, remaining: limit - data.count - 1 };
        } else {
            // 新的时间窗口
            await env.KV.put(key, JSON.stringify({
                count: 1,
                timestamp: now
            }), { expirationTtl: window });
            return { allowed: true, remaining: limit - 1 };
        }
    } catch (error) {
        // 如果 KV 出错，允许请求通过
        console.error('Rate limit check error:', error);
        return { allowed: true, remaining: limit };
    }
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
