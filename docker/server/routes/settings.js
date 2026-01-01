/**
 * 设置路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword } = require('../utils/hash');

// ==================== 背景图设置 ====================

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

// ==================== 主题设置 ====================

// 默认主题配置
const DEFAULT_THEME = {
    primaryColor: '#a78bfa',
    accentColor: '#e879f9',
    cardStyle: 'glass',  // glass | solid | minimal
    cardRadius: 12,
    darkMode: false
};

// 获取主题设置
router.get('/theme', (req, res) => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
    let theme = DEFAULT_THEME;

    if (result?.value) {
        try {
            theme = { ...DEFAULT_THEME, ...JSON.parse(result.value) };
        } catch (e) {
            console.error('解析主题设置失败:', e);
        }
    }

    res.json({ success: true, data: theme });
});

// 更新主题设置
router.put('/theme', (req, res) => {
    const { primaryColor, accentColor, cardStyle, cardRadius, darkMode } = req.body;

    // 验证颜色格式
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (primaryColor && !colorRegex.test(primaryColor)) {
        return res.status(400).json({ success: false, error: '主题色格式无效' });
    }
    if (accentColor && !colorRegex.test(accentColor)) {
        return res.status(400).json({ success: false, error: '强调色格式无效' });
    }

    // 验证卡片样式
    const validStyles = ['glass', 'solid', 'minimal'];
    if (cardStyle && !validStyles.includes(cardStyle)) {
        return res.status(400).json({ success: false, error: '卡片样式无效' });
    }

    // 验证圆角
    if (cardRadius !== undefined && (typeof cardRadius !== 'number' || cardRadius < 0 || cardRadius > 24)) {
        return res.status(400).json({ success: false, error: '圆角值无效（0-24）' });
    }

    // 获取现有设置
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
    let currentTheme = DEFAULT_THEME;
    if (existing?.value) {
        try {
            currentTheme = { ...DEFAULT_THEME, ...JSON.parse(existing.value) };
        } catch (e) {}
    }

    // 合并新设置
    const newTheme = {
        ...currentTheme,
        ...(primaryColor && { primaryColor }),
        ...(accentColor && { accentColor }),
        ...(cardStyle && { cardStyle }),
        ...(cardRadius !== undefined && { cardRadius }),
        ...(darkMode !== undefined && { darkMode })
    };

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('theme', JSON.stringify(newTheme));
    res.json({ success: true, message: '主题设置已保存', data: newTheme });
});

// ==================== 布局设置 ====================

// 默认布局配置
const DEFAULT_LAYOUT = {
    viewMode: 'grid',      // grid | list | compact
    columns: 6,            // 网格列数 (4-8)
    cardSize: 'medium',    // small | medium | large
    showDescription: false,
    showCategory: false
};

// 获取布局设置
router.get('/layout', (req, res) => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('layout');
    let layout = DEFAULT_LAYOUT;

    if (result?.value) {
        try {
            layout = { ...DEFAULT_LAYOUT, ...JSON.parse(result.value) };
        } catch (e) {
            console.error('解析布局设置失败:', e);
        }
    }

    res.json({ success: true, data: layout });
});

// 更新布局设置
router.put('/layout', (req, res) => {
    const { viewMode, columns, cardSize, showDescription, showCategory } = req.body;

    // 验证视图模式
    const validModes = ['grid', 'list', 'compact'];
    if (viewMode && !validModes.includes(viewMode)) {
        return res.status(400).json({ success: false, error: '视图模式无效' });
    }

    // 验证列数
    if (columns !== undefined && (typeof columns !== 'number' || columns < 4 || columns > 8)) {
        return res.status(400).json({ success: false, error: '列数无效（4-8）' });
    }

    // 验证卡片尺寸
    const validSizes = ['small', 'medium', 'large'];
    if (cardSize && !validSizes.includes(cardSize)) {
        return res.status(400).json({ success: false, error: '卡片尺寸无效' });
    }

    // 获取现有设置
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('layout');
    let currentLayout = DEFAULT_LAYOUT;
    if (existing?.value) {
        try {
            currentLayout = { ...DEFAULT_LAYOUT, ...JSON.parse(existing.value) };
        } catch (e) {}
    }

    // 合并新设置
    const newLayout = {
        ...currentLayout,
        ...(viewMode && { viewMode }),
        ...(columns !== undefined && { columns }),
        ...(cardSize && { cardSize }),
        ...(showDescription !== undefined && { showDescription }),
        ...(showCategory !== undefined && { showCategory })
    };

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('layout', JSON.stringify(newLayout));
    res.json({ success: true, message: '布局设置已保存', data: newLayout });
});

// ==================== 获取所有前端设置 ====================

router.get('/frontend', (req, res) => {
    const bgResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('background_image');
    const themeResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
    const layoutResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('layout');

    let theme = DEFAULT_THEME;
    let layout = DEFAULT_LAYOUT;

    if (themeResult?.value) {
        try { theme = { ...DEFAULT_THEME, ...JSON.parse(themeResult.value) }; } catch (e) {}
    }
    if (layoutResult?.value) {
        try { layout = { ...DEFAULT_LAYOUT, ...JSON.parse(layoutResult.value) }; } catch (e) {}
    }

    res.json({
        success: true,
        data: {
            background_image: bgResult?.value || 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop',
            theme,
            layout
        }
    });
});

// ==================== 密码设置 ====================

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
