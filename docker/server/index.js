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

app.post('/api/sites', (req, res) => {
    const { name, url, description, logo, category_id, sort_order } = req.body;
    if (!name || !url) {
        return res.status(400).json({ success: false, message: '站点名称和URL为必填项' });
    }
    const stmt = db.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(name, url, description || '', logo || '', category_id || null, sort_order || 0);
    res.json({ success: true, message: '站点创建成功', data: { id: result.lastInsertRowid } });
});

app.put('/api/sites/:id', (req, res) => {
    const { name, url, description, logo, category_id, sort_order } = req.body;
    if (!name || !url) {
        return res.status(400).json({ success: false, message: '站点名称和URL为必填项' });
    }
    const stmt = db.prepare(`UPDATE sites SET name=?, url=?, description=?, logo=?, category_id=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
    const result = stmt.run(name, url, description || '', logo || '', category_id || null, sort_order || 0, req.params.id);
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
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
    const stored = result?.value || null;
    const inputHash = hashPassword(password);

    const isValid = stored === null
        ? password === (process.env.ADMIN_PASSWORD || 'admin123')
        : (stored === password || stored === inputHash);

    if (isValid) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: '密码错误' });
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

// SPA 回退
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 启动服务
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nav Dashboard 运行在 http://localhost:${PORT}`);
});
