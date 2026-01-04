/**
 * 认证路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, verifyPassword, sha256Hash, needsUpgrade } = require('../utils/hash');
const { getClientIp, checkLoginLimit, recordLoginFailure, resetLoginAttempts } = require('../middleware/rateLimit');
const { asyncHandler } = require('../middleware/errorHandler');
const { createToken, extractToken, logout, validateToken } = require('../middleware/auth');

// 验证密码（登录）
router.post('/verify', asyncHandler(async (req, res) => {
    const { password } = req.body;
    const ip = getClientIp(req);

    if (!password) {
        return res.status(400).json({ success: false, error: '请输入密码' });
    }

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
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

    let isValid = false;

    if (stored === null) {
        // 未设置密码，使用默认密码
        isValid = password === defaultPassword;
    } else if (stored.startsWith('$scrypt$')) {
        // 新格式 scrypt
        isValid = await verifyPassword(password, stored);
    } else if (stored.length === 64) {
        // 旧格式 SHA-256
        isValid = sha256Hash(password) === stored;
    } else {
        // 明文密码（不推荐）
        isValid = password === stored;
    }

    if (isValid) {
        resetLoginAttempts(ip);

        // 自动升级密码哈希格式
        if (stored && needsUpgrade(stored)) {
            try {
                const newHash = await hashPassword(password);
                db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newHash, 'admin_password');
                console.log('✅ 密码已自动升级为安全哈希格式');
            } catch (e) {
                console.error('密码升级失败:', e.message);
            }
        }

        // 生成 token
        const token = createToken();

        // 设置 cookie
        res.setHeader('Set-Cookie', `nav_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${24 * 60 * 60}`);

        res.json({ success: true, token });
    } else {
        const remaining = recordLoginFailure(ip);
        res.status(401).json({
            success: false,
            error: remaining > 0 ? `密码错误，还剩 ${remaining} 次尝试机会` : '密码错误，账号已锁定15分钟'
        });
    }
}));

// 登出
router.post('/logout', (req, res) => {
    const token = extractToken(req);
    logout(token);

    // 清除 cookie
    res.setHeader('Set-Cookie', 'nav_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');

    res.json({ success: true, message: '已登出' });
});

// 检查登录状态
router.get('/status', (req, res) => {
    const token = extractToken(req);
    const isAuthenticated = validateToken(token);

    res.json({ success: true, authenticated: isAuthenticated });
});

module.exports = router;
