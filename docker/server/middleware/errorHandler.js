/**
 * 全局错误处理中间件
 */

/**
 * 404 处理中间件
 */
function notFoundHandler(req, res, next) {
    // 只对 API 路由返回 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: `接口 ${req.method} ${req.path} 不存在`
        });
    }
    next();
}

/**
 * 全局错误处理中间件
 * 必须放在所有路由之后
 */
function errorHandler(err, req, res, next) {
    // 记录错误
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.error(err.stack || err);

    // Multer 文件上传错误
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            success: false,
            error: 'File Too Large',
            message: '文件大小超过限制（最大2MB）'
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: '不支持的文件字段'
        });
    }

    // JSON 解析错误
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Bad Request',
            message: 'JSON 格式错误'
        });
    }

    // 默认 500 错误
    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : err.message || '服务器内部错误';

    res.status(statusCode).json({
        success: false,
        error: statusCode === 500 ? 'Internal Server Error' : 'Error',
        message
    });
}

/**
 * 异步路由包装器 - 自动捕获 async 错误
 * @param {Function} fn - 异步路由处理函数
 * @returns {Function} 包装后的函数
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler
};
