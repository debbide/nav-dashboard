/**
 * 认证路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword } = require('../utils/hash');
const { getClientIp, checkLoginLimit, recordLoginFailure, resetLoginAttempts } = require('../middleware/rateLimit');

// 验证密码
router.post('/verify', (req, res) => {
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

module.exports = router;
