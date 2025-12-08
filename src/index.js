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
            // CSS/JS 文件：css/style.*.css 或 js/main.*.js
            const parts = requestedFile.split('/');
            const dir = parts[0];
            const fileName = parts[1].replace(/\.(css|js)$/, '');
            const ext = parts[1].split('.').pop();
            actualFile = files.find(f => f.match(new RegExp(`^${dir}/${fileName}\\.[a-f0-9]+\\.${ext}$`)));
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

    if (pathname.match(/^\/api\/sites\/\d+$/)) {
        const id = pathname.split('/').pop();
        if (method === 'GET') return await getSite(id, env, corsHeaders);
        if (method === 'PUT') return await updateSite(id, request, env, corsHeaders);
        if (method === 'DELETE') return await deleteSite(id, env, corsHeaders);
    }

    if (pathname === '/api/sites/reorder' && method === 'POST') {
        return await reorderSites(request, env, corsHeaders);
    }

    if (pathname === '/api/categories') {
        if (method === 'GET') return await getCategories(env, corsHeaders);
        if (method === 'POST') return await createCategory(request, env, corsHeaders);
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

    if (pathname === '/api/upload' && method === 'POST') {
        return await uploadFile(request, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/images\/.+$/)) {
        const filename = pathname.split('/').pop();
        return await getImage(filename, env, corsHeaders);
    }

    return jsonResponse({ success: false, message: 'API Not Found' }, 404, corsHeaders);
}

// ==================== 站点操作 ====================

async function getSites(request, env, corsHeaders) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    let query = `
    SELECT s.*, c.name as category_name, c.color as category_color 
    FROM sites s 
    LEFT JOIN categories c ON s.category_id = c.id
  `;
    const params = [];

    if (search) {
        query += ` WHERE s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?`;
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    } else if (category && category !== 'all') {
        query += ` WHERE s.category_id = ?`;
        params.push(category);
    }

    query += ` ORDER BY s.sort_order ASC, s.created_at DESC`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
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
