/**
 * 登录限流中间件
 */

// 登录尝试记录
const loginAttempts = new Map(); // IP -> { count, lastAttempt }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟

/**
 * 获取客户端 IP
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

/**
 * 检查是否被限流
 */
function checkLoginLimit(ip) {
    const attempt = loginAttempts.get(ip);
    if (!attempt) return { allowed: true };

    // 检查是否已过锁定时间
    if (Date.now() - attempt.lastAttempt > LOCKOUT_DURATION) {
        loginAttempts.delete(ip);
        return { allowed: true };
    }

    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
        const remainingMs = LOCKOUT_DURATION - (Date.now() - attempt.lastAttempt);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { allowed: false, remainingMin };
    }

    return { allowed: true };
}

/**
 * 记录登录失败
 */
function recordLoginFailure(ip) {
    const attempt = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempt.count++;
    attempt.lastAttempt = Date.now();
    loginAttempts.set(ip, attempt);
    return MAX_LOGIN_ATTEMPTS - attempt.count;
}

/**
 * 重置登录尝试
 */
function resetLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

/**
 * 限流中间件
 */
function rateLimitMiddleware(req, res, next) {
    const ip = getClientIp(req);
    const limitCheck = checkLoginLimit(ip);

    if (!limitCheck.allowed) {
        return res.status(429).json({
            success: false,
            error: `登录尝试次数过多，请 ${limitCheck.remainingMin} 分钟后再试`
        });
    }

    req.clientIp = ip;
    next();
}

module.exports = {
    getClientIp,
    checkLoginLimit,
    recordLoginFailure,
    resetLoginAttempts,
    rateLimitMiddleware
};
