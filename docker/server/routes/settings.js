/**
 * 设置路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword } = require('../utils/hash');

// 获取背景图
router.get('/background', (req, res) => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('background_image');
    const url = result?.value || 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop';
    res.json({ background_image: url });
});

// 更新背景图
router.put('/background', (req, res) => {
    const { background_image } = req.body;
    if (!background_image) {
        return res.status(400).json({ error: '背景图URL不能为空' });
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('background_image', background_image);
    res.json({ message: '背景图更新成功', background_image });
});

// 获取密码状态
router.get('/password', (req, res) => {
    res.json({ has_password: true });
});

// 修改密码
router.put('/password', (req, res) => {
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

module.exports = router;
