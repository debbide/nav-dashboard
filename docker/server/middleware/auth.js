/**
 * 认证中间件
 * 用于保护需要管理员权限的 API
 */
const crypto = require('crypto');
const db = require('../db');
const { verifyPassword, sha256Hash } = require('../utils/hash');

// Token 存储（内存中，重启后失效）
const tokens = new Map();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

/**
 * 生成安全的 token
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * 创建新 token
 */
function createToken() {
    const token = generateToken();
    const expiry = Date.now() + TOKEN_EXPIRY;
    tokens.set(token, { expiry, createdAt: Date.now() });

    // 清理过期 token
    cleanExpiredTokens();

    return token;
}

/**
 * 验证 token
 */
function validateToken(token) {
    if (!token) return false;

    const data = tokens.get(token);
    if (!data) return false;

    if (Date.now() > data.expiry) {
        tokens.delete(token);
        return false;
    }

    return true;
}

/**
 * 清理过期 token
 */
function cleanExpiredTokens() {
    const now = Date.now();
    for (const [token, data] of tokens.entries()) {
        if (now > data.expiry) {
            tokens.delete(token);
        }
    }
}

/**
 * 从请求中提取 token
 */
function extractToken(req) {
    // 优先从 Authorization header 获取
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    // 其次从 X-Auth-Token header 获取
    if (req.headers['x-auth-token']) {
        return req.headers['x-auth-token'];
    }

    // 最后从 cookie 获取
    const cookies = req.headers.cookie;
    if (cookies) {
        const match = cookies.match(/nav_token=([^;]+)/);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * 认证中间件 - 保护写操作
 */
function requireAuth(req, res, next) {
    const token = extractToken(req);

    if (!validateToken(token)) {
        return res.status(401).json({
            success: false,
            error: '未登录或登录已过期，请先登录'
        });
    }

    next();
}

/**
 * 可选认证中间件 - 不阻止请求，但标记是否已认证
 */
function optionalAuth(req, res, next) {
    const token = extractToken(req);
    req.isAuthenticated = validateToken(token);
    next();
}

/**
 * 登录并获取 token
 */
async function login(password) {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password');
    const stored = result?.value || null;
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';

    let isValid = false;

    if (stored === null) {
        isValid = password === defaultPassword;
    } else if (stored.startsWith('$scrypt$')) {
        isValid = await verifyPassword(password, stored);
    } else if (stored.length === 64) {
        isValid = sha256Hash(password) === stored;
    } else {
        isValid = password === stored;
    }

    if (isValid) {
        const token = createToken();
        return { success: true, token };
    }

    return { success: false };
}

/**
 * 登出
 */
function logout(token) {
    if (token) {
        tokens.delete(token);
    }
}

module.exports = {
    requireAuth,
    optionalAuth,
    createToken,
    validateToken,
    extractToken,
    login,
    logout
};
