/**
 * 站点路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { cacheRemoteImage, tryDownloadImage, uploadsDir } = require('../utils/imageCache');
const { validateSiteData } = require('../utils/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs');

// 获取站点列表
router.get('/', (req, res) => {
    const { category, search, page = 1, pageSize = 24 } = req.query;

    // 参数验证
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 24));
    const offset = (pageNum - 1) * pageSizeNum;

    let whereClause = '';
    const params = [];

    if (search) {
        // 限制搜索词长度
        const searchTerm = String(search).slice(0, 100);
        whereClause = `WHERE s.name LIKE ? OR s.description LIKE ? OR s.url LIKE ?`;
        const term = `%${searchTerm}%`;
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
    const results = dataStmt.all(...params, pageSizeNum, offset);

    res.json({
        success: true,
        data: results,
        pagination: { page: pageNum, pageSize: pageSizeNum, total, hasMore: offset + results.length < total }
    });
});

// 创建站点
router.post('/', asyncHandler(async (req, res) => {
    const { category_id, sort_order } = req.body;

    // 输入验证
    const validation = validateSiteData(req.body);
    if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.error });
    }

    const { name, url, description } = validation.sanitized;
    let siteLogo = validation.sanitized.logo;

    // 自动获取 favicon
    if (!siteLogo) {
        try {
            const domain = new URL(url).hostname;
            siteLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        } catch (e) {
            siteLogo = '';
        }
    }

    const stmt = db.prepare(`INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(name, url, description, siteLogo, category_id || null, sort_order || 0);
    res.json({ success: true, message: '站点创建成功', data: { id: result.lastInsertRowid } });
}));

// 更新站点
router.put('/:id', asyncHandler(async (req, res) => {
    const { category_id, sort_order } = req.body;
    const siteId = parseInt(req.params.id);

    if (isNaN(siteId)) {
        return res.status(400).json({ success: false, message: '无效的站点ID' });
    }

    // 输入验证
    const validation = validateSiteData(req.body);
    if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.error });
    }

    const { name, url, description } = validation.sanitized;
    let siteLogo = validation.sanitized.logo;

    if (!siteLogo) {
        try {
            const domain = new URL(url).hostname;
            siteLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        } catch (e) {
            siteLogo = '';
        }
    }

    const stmt = db.prepare(`UPDATE sites SET name=?, url=?, description=?, logo=?, category_id=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
    const result = stmt.run(name, url, description, siteLogo, category_id || null, sort_order || 0, siteId);

    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '站点不存在' });
    }
    res.json({ success: true, message: '站点更新成功' });
}));

// 删除站点
router.delete('/:id', (req, res) => {
    const siteId = parseInt(req.params.id);
    if (isNaN(siteId)) {
        return res.status(400).json({ success: false, message: '无效的站点ID' });
    }

    const result = db.prepare('DELETE FROM sites WHERE id = ?').run(siteId);
    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '站点不存在' });
    }
    res.json({ success: true, message: '站点删除成功' });
});

// 站点排序
router.post('/reorder', (req, res) => {
    const { order } = req.body;

    if (!order || !Array.isArray(order)) {
        return res.status(400).json({ success: false, message: '无效的排序数据' });
    }

    // 验证排序数据
    if (order.length > 1000) {
        return res.status(400).json({ success: false, message: '排序数据过多' });
    }

    for (const item of order) {
        if (typeof item.id !== 'number' || typeof item.sort_order !== 'number') {
            return res.status(400).json({ success: false, message: '排序数据格式错误' });
        }
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

// 恢复为网络图标
router.post('/restore-remote-logos', asyncHandler(async (req, res) => {
    const sites = db.prepare(`SELECT id, name, url FROM sites`).all();
    let updated = 0;
    let failed = 0;
    const updateStmt = db.prepare('UPDATE sites SET logo = ? WHERE id = ?');

    for (const site of sites) {
        try {
            const domain = new URL(site.url).hostname;
            const newLogo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
            updateStmt.run(newLogo, site.id);
            updated++;
        } catch (e) {
            console.error(`重置图标失败 [${site.name}]:`, e.message);
            failed++;
        }
    }

    res.json({
        success: true,
        message: `图标重置完成: ${updated} 个已恢复为网络图标`,
        updated,
        failed,
        total: sites.length
    });
}));

// 批量缓存站点图标
router.post('/cache-logos', asyncHandler(async (req, res) => {
    const sites = db.prepare(`SELECT id, name, url, logo FROM sites WHERE logo IS NOT NULL AND logo != ''`).all();

    let cached = 0;
    let failed = 0;
    let fixed = 0;
    const updateStmt = db.prepare('UPDATE sites SET logo = ? WHERE id = ?');

    for (const site of sites) {
        let newLogo = site.logo;
        let needsUpdate = false;

        // 情况1: 已经是本地路径，检查文件是否存在
        if (site.logo && site.logo.startsWith('/api/images/')) {
            const filename = site.logo.replace('/api/images/', '');
            const filePath = path.join(uploadsDir, filename);

            if (!fs.existsSync(filePath)) {
                console.log(`发现丢失的图标: ${site.name} (${site.logo})，尝试重新获取...`);
                try {
                    const domain = new URL(site.url).hostname;
                    const fallbackUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
                    const result = await tryDownloadImage(fallbackUrl);
                    if (result) {
                        newLogo = result;
                        needsUpdate = true;
                        fixed++;
                    } else {
                        failed++;
                    }
                } catch (e) {
                    console.error(`修复图标失败 [${site.name}]:`, e.message);
                    failed++;
                }
            }
        }
        // 情况2: 远程 URL，尝试缓存
        else if (site.logo && !site.logo.startsWith('/api/images/')) {
            const result = await cacheRemoteImage(site.logo);
            if (result && result !== site.logo) {
                newLogo = result;
                needsUpdate = true;
                cached++;
            } else if (!result) {
                failed++;
            }
        }

        if (needsUpdate) {
            updateStmt.run(newLogo, site.id);
        }
    }

    res.json({
        success: true,
        message: `图标处理完成: 缓存 ${cached} 个, 修复 ${fixed} 个, 失败 ${failed} 个`,
        cached,
        fixed,
        failed,
        total: sites.length
    });
}));

module.exports = router;
