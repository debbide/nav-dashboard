/**
 * 分类路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取分类列表
router.get('/', (req, res) => {
    const results = db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM sites WHERE category_id = c.id) as sites_count
        FROM categories c ORDER BY c.sort_order ASC, c.created_at ASC
    `).all();
    res.json({ success: true, data: results });
});

// 创建分类
router.post('/', (req, res) => {
    const { name, icon, color, sort_order } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: '分类名称为必填项' });
    }
    const stmt = db.prepare(`INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)`);
    const result = stmt.run(name, icon || '', color || '#ff9a56', sort_order || 0);
    res.json({ success: true, message: '分类创建成功', data: { id: result.lastInsertRowid } });
});

// 更新分类
router.put('/:id', (req, res) => {
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

// 删除分类
router.delete('/:id', (req, res) => {
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

// 分类排序
router.post('/reorder', (req, res) => {
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

module.exports = router;
