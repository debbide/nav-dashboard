/**
 * 数据导入导出路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// 数据导出（需要认证）
router.get('/export', requireAuth, (req, res) => {
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

// 数据导入（需要认证）
router.post('/import', requireAuth, (req, res) => {
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

// 书签导入（需要认证）
router.post('/import/bookmarks', requireAuth, express.text({ type: 'text/html', limit: '5mb' }), (req, res) => {
    try {
        const html = req.body;

        if (!html || typeof html !== 'string') {
            return res.status(400).json({ success: false, message: '无效的书签文件' });
        }

        // 简单的 HTML 书签解析
        const bookmarks = [];
        const categories = new Map();
        let currentFolder = '未分类';

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
                    name: name.substring(0, 50),
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

module.exports = router;
