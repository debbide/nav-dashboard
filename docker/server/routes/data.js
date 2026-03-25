/**
 * 数据导入导出路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const SENSITIVE_SETTING_KEYS = new Set(['admin_password', 'webdav_password']);

function normalizeSettingsEntries(settings) {
    if (!settings) {
        return [];
    }
    if (Array.isArray(settings)) {
        return settings.filter(item => item && typeof item.key === 'string');
    }
    if (typeof settings === 'object') {
        return Object.entries(settings).map(([key, value]) => ({ key, value }));
    }
    return [];
}

// 数据导出（需要认证）
router.get('/export', requireAuth, (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order ASC
        `).all();

        const sites = db.prepare(`
            SELECT id, name, url, description, logo, category_id, sort_order FROM sites ORDER BY sort_order ASC
        `).all();

        const tags = db.prepare(`
            SELECT id, name, color FROM tags ORDER BY name ASC
        `).all();

        const site_tags = db.prepare(`
            SELECT site_id, tag_id FROM site_tags ORDER BY site_id ASC, tag_id ASC
        `).all();

        const settings = db.prepare(`
            SELECT key, value FROM settings WHERE key NOT IN ('admin_password', 'webdav_password')
        `).all();

        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            categories,
            sites,
            tags,
            site_tags,
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

        if (!Array.isArray(data.categories) || !Array.isArray(data.sites)) {
            return res.status(400).json({ success: false, message: '无效的导入数据格式' });
        }

        const importTransaction = db.transaction(() => {
            // 清空现有数据
            db.prepare('DELETE FROM site_tags').run();
            db.prepare('DELETE FROM sites').run();
            db.prepare('DELETE FROM tags').run();
            db.prepare('DELETE FROM categories').run();
            db.prepare("DELETE FROM settings WHERE key NOT IN ('admin_password', 'webdav_password')").run();

            // 导入分类
            const categoryIdMap = {};
            const insertCategory = db.prepare(`INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)`);
            for (const cat of data.categories) {
                const result = insertCategory.run(cat.name, cat.icon || '', cat.color || '#ff9a56', cat.sort_order || 0);
                categoryIdMap[cat.id] = result.lastInsertRowid;
            }

            // 导入站点
            const siteIdMap = {};
            const insertSite = db.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const site of data.sites) {
                const newCategoryId = site.category_id ? categoryIdMap[site.category_id] : null;
                const result = insertSite.run(site.name, site.url, site.description || '', site.logo || '', newCategoryId, site.sort_order || 0);
                siteIdMap[site.id] = result.lastInsertRowid;
            }

            // 导入标签
            const tagIdMap = {};
            if (Array.isArray(data.tags)) {
                const insertTag = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
                for (const tag of data.tags) {
                    const result = insertTag.run(tag.name, tag.color || '#6366f1');
                    tagIdMap[tag.id] = result.lastInsertRowid;
                }
            }

            // 导入站点-标签关联
            if (Array.isArray(data.site_tags)) {
                const insertSiteTag = db.prepare('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)');
                for (const row of data.site_tags) {
                    const newSiteId = siteIdMap[row.site_id];
                    const newTagId = tagIdMap[row.tag_id];
                    if (newSiteId && newTagId) {
                        insertSiteTag.run(newSiteId, newTagId);
                    }
                }
            }

            // 导入设置
            const settings = normalizeSettingsEntries(data.settings);
            if (settings.length > 0) {
                const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
                for (const setting of settings) {
                    if (!setting || !setting.key || SENSITIVE_SETTING_KEYS.has(setting.key)) {
                        continue;
                    }
                    insertSetting.run(setting.key, setting.value ?? '');
                }
            }
        });

        importTransaction();

        res.json({
            success: true,
            message: `导入成功: ${data.categories.length} 个分类, ${data.sites.length} 个站点, ${(data.tags || []).length} 个标签`
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
