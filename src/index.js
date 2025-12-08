export default {
    async fetch(request, env) {
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

            // 静态文件托管（由 Pages 处理）
            return new Response('Not Found', { status: 404 });
        } catch (error) {
            return jsonResponse({ success: false, message: error.message }, 500, corsHeaders);
        }
    },
};

// ==================== API 处理函数 ====================

async function handleAPI(request, env, pathname, corsHeaders) {
    const method = request.method;

    // 站点 API
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

    // 分类 API
    if (pathname === '/api/categories') {
        if (method === 'GET') return await getCategories(env, corsHeaders);
        if (method === 'POST') return await createCategory(request, env, corsHeaders);
    }

    if (pathname.match(/^\/api\/categories\/\d+$/)) {
        const id = pathname.split('/').pop();
        if (method === 'PUT') return await updateCategory(id, request, env, corsHeaders);
        if (method === 'DELETE') return await deleteCategory(id, env, corsHeaders);
    }

    // 文件上传 API
    if (pathname === '/api/upload' && method === 'POST') {
        return await uploadFile(request, env, corsHeaders);
    }

    return jsonResponse({ success: false, message: 'Not Found' }, 404, corsHeaders);
}

// ==================== 站点操作 ====================

// 获取所有站点
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

// 获取单个站点
async function getSite(id, env, corsHeaders) {
    const { results } = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).all();
    if (results.length === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }
    return jsonResponse({ success: true, data: results[0] }, 200, corsHeaders);
}

// 创建站点
async function createSite(request, env, corsHeaders) {
    const data = await request.json();
    const { name, url, description, logo, category_id, sort_order } = data;

    if (!name || !url) {
        return jsonResponse({ success: false, message: '站点名称和URL为必填项' }, 400, corsHeaders);
    }

    const result = await env.DB.prepare(`
    INSERT INTO sites (name, url, description, logo, category_id, sort_order) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
        name,
        url,
        description || '',
        logo || '',
        category_id || null,
        sort_order || 0
    ).run();

    return jsonResponse({
        success: true,
        message: '站点创建成功',
        data: { id: result.meta.last_row_id }
    }, 200, corsHeaders);
}

// 更新站点
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
  `).bind(
        name,
        url,
        description || '',
        logo || '',
        category_id || null,
        sort_order || 0,
        id
    ).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '站点更新成功' }, 200, corsHeaders);
}

// 删除站点
async function deleteSite(id, env, corsHeaders) {
    const result = await env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '站点不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '站点删除成功' }, 200, corsHeaders);
}

// ==================== 分类操作 ====================

// 获取所有分类
async function getCategories(env, corsHeaders) {
    const { results } = await env.DB.prepare(`
    SELECT c.*, 
    (SELECT COUNT(*) FROM sites WHERE category_id = c.id) as sites_count
    FROM categories c
    ORDER BY c.sort_order ASC, c.created_at ASC
  `).all();

    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
}

// 创建分类
async function createCategory(request, env, corsHeaders) {
    const data = await request.json();
    const { name, icon, color, sort_order } = data;

    if (!name) {
        return jsonResponse({ success: false, message: '分类名称为必填项' }, 400, corsHeaders);
    }

    const result = await env.DB.prepare(`
    INSERT INTO categories (name, icon, color, sort_order) 
    VALUES (?, ?, ?, ?)
  `).bind(
        name,
        icon || '',
        color || '#ff9a56',
        sort_order || 0
    ).run();

    return jsonResponse({
        success: true,
        message: '分类创建成功',
        data: { id: result.meta.last_row_id }
    }, 200, corsHeaders);
}

// 更新分类
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
  `).bind(
        name,
        icon || '',
        color || '#ff9a56',
        sort_order || 0,
        id
    ).run();

    if (result.meta.changes === 0) {
        return jsonResponse({ success: false, message: '分类不存在' }, 404, corsHeaders);
    }

    return jsonResponse({ success: true, message: '分类更新成功' }, 200, corsHeaders);
}

// 删除分类
async function deleteCategory(id, env, corsHeaders) {
    // 检查是否有站点使用此分类
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

        // 检查文件类型
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return jsonResponse({ success: false, message: '只支持图片文件' }, 400, corsHeaders);
        }

        // 检查文件大小（5MB）
        if (file.size > 5 * 1024 * 1024) {
            return jsonResponse({ success: false, message: '文件大小不能超过 5MB' }, 400, corsHeaders);
        }

        // 生成唯一文件名
        const ext = file.name.split('.').pop();
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        // 上传到 R2
        await env.BUCKET.put(filename, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            },
        });

        // 返回公共 URL
        const fileUrl = `https://pub-${env.R2_PUBLIC_ID}.r2.dev/${filename}`;

        return jsonResponse({
            success: true,
            message: '上传成功',
            data: { url: fileUrl }
        }, 200, corsHeaders);
    } catch (error) {
        return jsonResponse({ success: false, message: error.message }, 500, corsHeaders);
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
