/**
 * 标签路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// 获取所有标签
router.get('/', (req, res) => {
    const results = db.prepare(`
        SELECT t.*,
        (SELECT COUNT(*) FROM site_tags WHERE tag_id = t.id) as sites_count
        FROM tags t
        ORDER BY t.name ASC
    `).all();
    res.json({ success: true, data: results });
});

// 创建标签（需要认证）
router.post('/', requireAuth, (req, res) => {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: '标签名称不能为空' });
    }

    try {
        const stmt = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
        const result = stmt.run(name.trim(), color || '#6366f1');
        res.json({ success: true, message: '标签创建成功', data: { id: result.lastInsertRowid } });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ success: false, message: '标签名称已存在' });
        }
        throw error;
    }
});

// 更新标签（需要认证）
router.put('/:id', requireAuth, (req, res) => {
    const { name, color } = req.body;
    const tagId = parseInt(req.params.id);

    if (isNaN(tagId)) {
        return res.status(400).json({ success: false, message: '无效的标签ID' });
    }
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: '标签名称不能为空' });
    }

    try {
        const stmt = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?');
        const result = stmt.run(name.trim(), color || '#6366f1', tagId);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: '标签不存在' });
        }
        res.json({ success: true, message: '标签更新成功' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ success: false, message: '标签名称已存在' });
        }
        throw error;
    }
});

// 删除标签（需要认证）
router.delete('/:id', requireAuth, (req, res) => {
    const tagId = parseInt(req.params.id);

    if (isNaN(tagId)) {
        return res.status(400).json({ success: false, message: '无效的标签ID' });
    }

    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);

    if (result.changes === 0) {
        return res.status(404).json({ success: false, message: '标签不存在' });
    }
    res.json({ success: true, message: '标签删除成功' });
});

// 获取站点的标签
router.get('/site/:siteId', (req, res) => {
    const siteId = parseInt(req.params.siteId);

    if (isNaN(siteId)) {
        return res.status(400).json({ success: false, message: '无效的站点ID' });
    }

    const results = db.prepare(`
        SELECT t.* FROM tags t
        INNER JOIN site_tags st ON t.id = st.tag_id
        WHERE st.site_id = ?
        ORDER BY t.name ASC
    `).all(siteId);

    res.json({ success: true, data: results });
});

// 设置站点的标签（需要认证）
router.put('/site/:siteId', requireAuth, (req, res) => {
    const siteId = parseInt(req.params.siteId);
    const { tag_ids } = req.body;

    if (isNaN(siteId)) {
        return res.status(400).json({ success: false, message: '无效的站点ID' });
    }

    if (!Array.isArray(tag_ids)) {
        return res.status(400).json({ success: false, message: 'tag_ids 必须是数组' });
    }

    // 检查站点是否存在
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
        return res.status(404).json({ success: false, message: '站点不存在' });
    }

    // 使用事务更新标签
    const updateTags = db.transaction((siteId, tagIds) => {
        // 删除现有标签关联
        db.prepare('DELETE FROM site_tags WHERE site_id = ?').run(siteId);

        // 添加新的标签关联
        if (tagIds.length > 0) {
            const insertStmt = db.prepare('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)');
            for (const tagId of tagIds) {
                insertStmt.run(siteId, tagId);
            }
        }
    });

    updateTags(siteId, tag_ids);

    res.json({ success: true, message: '站点标签更新成功' });
});

// 按标签筛选站点
router.get('/filter', (req, res) => {
    const { tag_ids, page = 1, pageSize = 24 } = req.query;

    if (!tag_ids) {
        return res.status(400).json({ success: false, message: '请指定标签ID' });
    }

    const tagIdArray = tag_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));

    if (tagIdArray.length === 0) {
        return res.status(400).json({ success: false, message: '无效的标签ID' });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 24));
    const offset = (pageNum - 1) * pageSizeNum;

    // 查询同时拥有所有指定标签的站点
    const placeholders = tagIdArray.map(() => '?').join(',');
    const countQuery = `
        SELECT COUNT(DISTINCT s.id) as total
        FROM sites s
        INNER JOIN site_tags st ON s.id = st.site_id
        WHERE st.tag_id IN (${placeholders})
        GROUP BY s.id
        HAVING COUNT(DISTINCT st.tag_id) = ?
    `;
    const countResults = db.prepare(countQuery).all(...tagIdArray, tagIdArray.length);
    const total = countResults.length;

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
    const results = db.prepare(dataQuery).all(...tagIdArray, tagIdArray.length, pageSizeNum, offset);

    // 获取所有站点的标签
    if (results.length > 0) {
        try {
            const siteIds = results.map(s => s.id);
            const sitePlaceholders = siteIds.map(() => '?').join(',');
            const tagsStmt = db.prepare(`
                SELECT st.site_id, t.id, t.name, t.color
                FROM site_tags st
                INNER JOIN tags t ON st.tag_id = t.id
                WHERE st.site_id IN (${sitePlaceholders})
            `);
            const tagResults = tagsStmt.all(...siteIds);

            const tagsBySite = {};
            for (const tag of tagResults) {
                if (!tagsBySite[tag.site_id]) {
                    tagsBySite[tag.site_id] = [];
                }
                tagsBySite[tag.site_id].push({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color
                });
            }

            for (const site of results) {
                site.tags = tagsBySite[site.id] || [];
            }
        } catch (e) {
            for (const site of results) {
                site.tags = [];
            }
        }
    }

    res.json({
        success: true,
        data: results,
        pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            hasMore: offset + results.length < total
        }
    });
});

module.exports = router;
