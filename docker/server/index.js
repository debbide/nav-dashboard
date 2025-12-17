const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer 配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        cb(null, filename);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// 缓存远程图片到本地
async function cacheRemoteImage(imageUrl) {
    // 如果已经是本地路径，直接返回
    if (!imageUrl || imageUrl.startsWith('/api/images/')) {
        return imageUrl;
    }

    // 验证 URL
    let parsedUrl;
    try {
        parsedUrl = new URL(imageUrl);
    } catch {
        return imageUrl;
    }

    // 如果是 Google Favicon API，尝试直接从原站获取
    if (imageUrl.includes('google.com/s2/favicons')) {
        const domainMatch = imageUrl.match(/domain=([^&]+)/);
        if (domainMatch) {
            const domain = decodeURIComponent(domainMatch[1]);
            // 尝试直接获取网站的 favicon
            const directFaviconUrl = `https://${domain}/favicon.ico`;
            const cached = await tryDownloadImage(directFaviconUrl);
            if (cached) return cached;

            // 备选：尝试其他 favicon 服务
            const fallbackApis = [
                `https://favicon.im/${domain}`,
                `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            ];

            for (const api of fallbackApis) {
                const result = await tryDownloadImage(api);
                if (result) return result;
            }

            return imageUrl; // 全部失败，返回原 URL
        }
    }

    // 普通图片 URL，直接下载
    return await tryDownloadImage(imageUrl) || imageUrl;
}

// 尝试下载单个图片
async function tryDownloadImage(imageUrl) {
    try {
        // 使用 URL 的 MD5 哈希作为文件名，避免重复下载
        const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');

        // 检查是否已存在该哈希的文件（忽略扩展名）
        const existingFiles = fs.readdirSync(uploadsDir);
        const existingFile = existingFiles.find(f => f.startsWith(urlHash));
        if (existingFile) {
            console.log(`图片已存在(跳过下载): ${imageUrl} -> /api/images/${existingFile}`);
            return `/api/images/${existingFile}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*'
            },
            redirect: 'follow'
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`下载失败 [${imageUrl}]: HTTP ${response.status} ${response.statusText}`);
            return null;
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
            console.log(`格式错误 [${imageUrl}]: Content-Type 是 ${contentType}`);
            return null;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length < 100 || buffer.length > 500 * 1024) {
            console.log(`大小不符 [${imageUrl}]: ${buffer.length} bytes (限制 100B - 500KB)`);
            return null;
        }

        const extMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/svg+xml': '.svg',
            'image/webp': '.webp',
            'image/x-icon': '.ico',
            'image/vnd.microsoft.icon': '.ico'
        };
        const ext = extMap[contentType] || '.ico';
        // 文件名格式: MD5哈希.扩展名
        const filename = `${urlHash}${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log(`图片已缓存: ${imageUrl} -> /api/images/${filename}`);
        return `/api/images/${filename}`;
    } catch (error) {
        console.error(`图片下载/保存失败 [${imageUrl}]:`, error.message);
        return null;
    }
}

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== API 路由 ====================

// --- 站点 API ---
app.get('/api/sites', (req, res) => {
    const { category, search, page = 1, pageSize = 24 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let whereClause = '';
    const params = [];

    if (search) {
        whereClause = `WHERE s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?`;
        const term = `%${search}%`;
        params.push(term, term, term);
    } else if (category && category !== 'all') {
        whereClause = `WHERE s.category_id = ?`;
        params.push(category);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM sites s ${whereClause}`);
    const total = countStmt.get(...params)?.total || 0;

    const dataStmt = db.prepare(`
        SELECT s.*, c.name as category_name, c.color as category_color 
        FROM sites s 
        LEFT JOIN categories c ON s.category_id = c.id
        ${whereClause}
        ORDER BY s.sort_order ASC, s.created_at DESC
        LIMIT ? OFFSET ?
    `);
    const results = dataStmt.all(...params, parseInt(pageSize), offset);

    res.json({
        success: true,
        data: results,
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total, hasMore: offset + results.length < total }
    });
});

app.post('/api/sites', async (req, res) => {
    const { name, url, description, logo, category_id, sort_order } = req.body;
    if (!name || !url) {
        return res.status(400).json({ success: false, message: '站点名称和URL为必填项' });
    }

    // 缓存远程 logo 到本地
    const cachedLogo = await cacheRemoteImage(logo);

    const stmt = db.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(name, url, description || '', cachedLogo || '', category_id || null, sort_order || 0);
    res.json({ success: true, message: '站点创建成功', data: { id: result.lastInsertRowid } });
});

app.put('/api/sites/:id', async (req, res) => {
    const { name, url, description, logo, category_id, sort_order } = req.body;
    if (!name || !url) {
        return res.status(400).json({ success: false, message: '站点名称和URL为必填项' });
    }

    // 缓存远程 logo 到本地
    const cachedLogo = await cacheRemoteImage(logo);

    const stmt = db.prepare(`UPDATE sites SET name=?, url=?, description=?, logo=?, category_id=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
    const result = stmt.run(name, url, description || '', cachedLogo || '', category_id || null, sort_order || 0, req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '站点不存在' });
    }
    res.json({ success: true, message: '站点更新成功' });
});

app.delete('/api/sites/:id', (req, res) => {
    const result = db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '站点不存在' });
    }
    res.json({ success: true, message: '站点删除成功' });
});

app.post('/api/sites/reorder', (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
        return res.status(400).json({ success: false, message: '无效的排序数据' });
    }
    const stmt = db.prepare('UPDATE sites SET sort_order = ? WHERE id = ?');
    const updateMany = db.transaction((items) => {
        for (const item of items) {
            stmt.run(item.sort_order, item.id);
        }
    });
    updateMany(order);
    res.json({ success: true, message: '排序更新成功' });
});

// --- 批量缓存所有站点图标 ---
app.post('/api/sites/cache-logos', async (req, res) => {
    try {
        const sites = db.prepare(`SELECT id, logo FROM sites WHERE logo IS NOT NULL AND logo != '' AND logo NOT LIKE '/api/images/%'`).all();

        if (sites.length === 0) {
            return res.json({ success: true, message: '没有需要缓存的外部图标', cached: 0 });
        }

        let cached = 0;
        let failed = 0;
        const updateStmt = db.prepare('UPDATE sites SET logo = ? WHERE id = ?');

        for (const site of sites) {
            const cachedLogo = await cacheRemoteImage(site.logo);
            if (cachedLogo !== site.logo) {
                updateStmt.run(cachedLogo, site.id);
                cached++;
            } else {
                failed++;
            }
        }

        res.json({
            success: true,
            message: `图标缓存完成: ${cached} 个成功, ${failed} 个失败`,
            cached,
            failed,
            total: sites.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '缓存失败: ' + error.message });
    }
});

// --- 分类 API ---
app.get('/api/categories', (req, res) => {
    const results = db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM sites WHERE category_id = c.id) as sites_count
        FROM categories c ORDER BY c.sort_order ASC, c.created_at ASC
    `).all();
    res.json({ success: true, data: results });
});

app.post('/api/categories', (req, res) => {
    const { name, icon, color, sort_order } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: '分类名称为必填项' });
    }
    const stmt = db.prepare(`INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)`);
    const result = stmt.run(name, icon || '', color || '#ff9a56', sort_order || 0);
    res.json({ success: true, message: '分类创建成功', data: { id: result.lastInsertRowid } });
});

app.put('/api/categories/:id', (req, res) => {
    const { name, icon, color, sort_order } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: '分类名称为必填项' });
    }
    const stmt = db.prepare(`UPDATE categories SET name=?, icon=?, color=?, sort_order=? WHERE id=?`);
    const result = stmt.run(name, icon || '', color || '#ff9a56', sort_order || 0, req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '分类不存在' });
    }
    res.json({ success: true, message: '分类更新成功' });
});

app.delete('/api/categories/:id', (req, res) => {
    const count = db.prepare('SELECT COUNT(*) as count FROM sites WHERE category_id = ?').get(req.params.id);
    if (count.count > 0) {
        return res.status(400).json({ success: false, message: `此分类下还有 ${count.count} 个站点，无法删除` });
    }
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '分类不存在' });
    }
    res.json({ success: true, message: '分类删除成功' });
});

app.post('/api/categories/reorder', (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
        return res.status(400).json({ success: false, message: '无效的排序数据' });
    }
    const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
    const updateMany = db.transaction((items) => {
        for (const item of items) {
            stmt.run(item.sort_order, item.id);
        }
    });
    updateMany(order);
    res.json({ success: true, message: '分类排序更新成功' });
});

// --- 设置 API ---
app.get('/api/settings/background', (req, res) => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('background_image');
    const url = result?.value || 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop';
    res.json({ background_image: url });
});

app.put('/api/settings/background', (req, res) => {
    const { background_image } = req.body;
    if (!background_image) {
        return res.status(400).json({ error: '背景图URL不能为空' });
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('background_image', background_image);
    res.json({ message: '背景图更新成功', background_image });
});

// --- 密码 API ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 登录失败限制（防暴力破解）
const loginAttempts = new Map(); // IP -> { count, lastAttempt }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

function checkLoginLimit(ip) {
    const attempt = loginAttempts.get(ip);
    if (!attempt) return { allowed: true };

    // 检查是否已过锁定时间
    if (Date.now() - attempt.lastAttempt > LOCKOUT_DURATION) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }

    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
        const remainingMs = LOCKOUT_DURATION - (Date.now() - attempt.lastAttempt);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }

    return { allowed: true };
}

function recordLoginFailure(ip) {
    const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempt.count++;
    attempt.lastAttempt = Date.now();
    loginAttempts.set(ip, attempt);
    return MAX_LOGIN_ATTEMPTS - attempt.count;
}

function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

app.get('/api/settings/password', (req, res) => {
    res.json({ has_password: true });
});

app.put('/api/settings/password', (req, res) => {
    const { old_password, new_password } = req.body;
    if (!new_password || new_password.length < 4) {
        return res.status(400).json({ error: '新密码不能少于4位' });
    }

    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
    const stored = result?.value || null;
    const oldHash = hashPassword(old_password);
    const isValid = stored === null
        ? old_password === (process.env.ADMIN_PASSWORD || 'admin123')
        : (stored === old_password || stored === oldHash);

    if (!isValid) {
        return res.status(401).json({ error: '原密码错误' });
    }

    const newHash = hashPassword(new_password);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_password', newHash);
    res.json({ message: '密码修改成功' });
});

app.post('/api/auth/verify', (req, res) => {
    const { password } = req.body;
    const ip = getClientIp(req);

    // 检查是否被锁定
    const limitCheck = checkLoginLimit(ip);
    if (!limitCheck.allowed) {
        return res.status(429).json({
            success: false,
            error: `登录尝试次数过多，请 ${limitCheck.remainingMin} 分钟后再试`
        });
    }

    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
    const stored = result?.value || null;
    const inputHash = hashPassword(password);

    const isValid = stored === null
        ? password === (process.env.ADMIN_PASSWORD || 'admin123')
        : (stored === password || stored === inputHash);

    if (isValid) {
        resetLoginAttempts(ip);
        res.json({ success: true });
    } else {
        const remaining = recordLoginFailure(ip);
        res.status(401).json({
            success: false,
            error: remaining > 0 ? `密码错误，还剩 ${remaining} 次尝试机会` : '密码错误，账号已锁定15分钟'
        });
    }
});

// --- 文件上传 API ---
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: '没有上传文件或文件类型不支持' });
    }
    res.json({ success: true, message: '上传成功', data: { url: `/api/images/${req.file.filename}` } });
});

app.get('/api/images/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Image not found');
    }
    res.sendFile(filePath);
});

// --- IP 信息 API ---
app.get('/api/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
    res.json({ ip, location: 'Local Network', isp: 'Self-hosted' });
});

// --- 图片代理 API ---
app.get('/api/proxy/image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).send('Missing url parameter');
    }
    try {
        new URL(imageUrl);
    } catch {
        return res.status(400).send('Invalid url parameter');
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavDashboard/1.0)', 'Accept': 'image/*' }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).send('Image fetch failed');
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/')) {
            return res.status(400).send('Not an image');
        }

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=604800');
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        res.status(504).send('Image proxy timeout');
    }
});

// --- 数据导出 API ---
app.get('/api/export', (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order ASC
        `).all();

        const sites = db.prepare(`
            SELECT id, name, url, description, logo, category_id, sort_order FROM sites ORDER BY sort_order ASC
        `).all();

        const settings = db.prepare(`
            SELECT key, value FROM settings WHERE key != 'admin_password'
        `).all();

        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            categories,
            sites,
            settings
        };

        res.set('Content-Type', 'application/json');
        res.set('Content-Disposition', 'attachment; filename="nav-dashboard-backup.json"');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        res.status(500).json({ success: false, message: '导出失败: ' + error.message });
    }
});

// --- 数据导入 API ---
app.post('/api/import', (req, res) => {
    try {
        const data = req.body;

        if (!data.categories || !data.sites) {
            return res.status(400).json({ success: false, message: '无效的导入数据格式' });
        }

        const importTransaction = db.transaction(() => {
            // 清空现有数据
            db.prepare('DELETE FROM sites').run();
            db.prepare('DELETE FROM categories').run();
            db.prepare("DELETE FROM settings WHERE key != 'admin_password'").run();

            // 导入分类
            const categoryIdMap = {};
            const insertCategory = db.prepare(`INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)`);
            for (const cat of data.categories) {
                const result = insertCategory.run(cat.name, cat.icon || '', cat.color || '#ff9a56', cat.sort_order || 0);
                categoryIdMap[cat.id] = result.lastInsertRowid;
            }

            // 导入站点
            const insertSite = db.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const site of data.sites) {
                const newCategoryId = site.category_id ? categoryIdMap[site.category_id] : null;
                insertSite.run(site.name, site.url, site.description || '', site.logo || '', newCategoryId, site.sort_order || 0);
            }

            // 导入设置
            if (data.settings) {
                const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
                for (const setting of data.settings) {
                    insertSetting.run(setting.key, setting.value);
                }
            }
        });

        importTransaction();

        res.json({
            success: true,
            message: `导入成功: ${data.categories.length} 个分类, ${data.sites.length} 个站点`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '导入失败: ' + error.message });
    }
});

// --- 书签导入 API ---
app.post('/api/import/bookmarks', express.text({ type: 'text/html', limit: '5mb' }), (req, res) => {
    try {
        const html = req.body;

        if (!html || typeof html !== 'string') {
            return res.status(400).json({ success: false, message: '无效的书签文件' });
        }

        // 简单的 HTML 书签解析
        const bookmarks = [];
        const categories = new Map();
        let currentFolder = '未分类';

        // 匹配文件夹名
        const folderRegex = /<DT><H3[^>]*>([^<]+)<\/H3>/gi;
        // 匹配书签
        const bookmarkRegex = /<DT><A[^>]*HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;
        // 匹配文件夹结束
        const folderEndRegex = /<\/DL>/gi;

        // 逐行解析
        const lines = html.split('\n');
        const folderStack = ['未分类'];

        for (const line of lines) {
            // 检查文件夹开始
            const folderMatch = /<DT><H3[^>]*>([^<]+)<\/H3>/i.exec(line);
            if (folderMatch) {
                currentFolder = folderMatch[1].trim();
                folderStack.push(currentFolder);
                if (!categories.has(currentFolder)) {
                    categories.set(currentFolder, { name: currentFolder, icon: '📁', color: '#a78bfa' });
                }
                continue;
            }

            // 检查书签
            const bookmarkMatch = /<DT><A[^>]*HREF="([^"]+)"[^>]*>([^<]+)<\/A>/i.exec(line);
            if (bookmarkMatch) {
                const url = bookmarkMatch[1].trim();
                const name = bookmarkMatch[2].trim();

                // 跳过 javascript: 和空链接
                if (url.startsWith('javascript:') || !url) continue;

                bookmarks.push({
                    name: name.substring(0, 50), // 限制名称长度
                    url,
                    category: folderStack[folderStack.length - 1],
                    logo: `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(new URL(url).hostname)}`
                });
                continue;
            }

            // 检查文件夹结束
            if (/<\/DL>/i.test(line) && folderStack.length > 1) {
                folderStack.pop();
            }
        }

        if (bookmarks.length === 0) {
            return res.status(400).json({ success: false, message: '未找到有效书签' });
        }

        // 导入到数据库
        const categoryIdMap = {};
        const insertCategory = db.prepare('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)');
        const insertSite = db.prepare('INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

        let sortOrder = 0;
        for (const [name, cat] of categories) {
            const result = insertCategory.run(cat.name, cat.icon, cat.color, sortOrder++);
            categoryIdMap[name] = result.lastInsertRowid;
        }

        let siteOrder = 0;
        for (const bm of bookmarks) {
            const categoryId = categoryIdMap[bm.category] || null;
            insertSite.run(bm.name, bm.url, '', bm.logo, categoryId, siteOrder++);
        }

        res.json({
            success: true,
            message: `导入成功: ${categories.size} 个分类, ${bookmarks.length} 个书签`,
            imported: { categories: categories.size, bookmarks: bookmarks.length }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '导入失败: ' + error.message });
    }
});

// SPA 回退
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 启动服务
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nav Dashboard v1.1.0 运行在 http://localhost:${PORT}`);
});
