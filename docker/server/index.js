/**
 * NavDashboard Docker 版后端入口
 * v1.3.0 - 增强版本
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const compression = require('compression');

// 导入路由模块
const sitesRouter = require('./routes/sites');
const categoriesRouter = require('./routes/categories');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const uploadRouter = require('./routes/upload');
const dataRouter = require('./routes/data');
const backupRouter = require('./routes/backup');

// 导入中间件
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 导入备份模块和数据库
const backup = require('./backup');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.3.0';

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==================== 中间件 ====================
// Gzip 压缩
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// 请求日志（简易版，无需额外依赖）
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = `${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
        // 只记录 API 请求和错误
        if (req.path.startsWith('/api/') || res.statusCode >= 400) {
            console.log(log);
        }
    });
    next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 安全头
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// 静态文件服务（带缓存）
app.use(express.static(path.join(__dirname, '..', 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// ==================== 健康检查 ====================
app.get('/health', (req, res) => {
    const dbStatus = db.getHealthStatus();
    const status = dbStatus.ok ? 'healthy' : 'unhealthy';

    res.status(dbStatus.ok ? 200 : 503).json({
        status,
        version: VERSION,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: dbStatus
    });
});

// 简化版健康检查（用于负载均衡器）
app.get('/health/live', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health/ready', (req, res) => {
    const dbStatus = db.getHealthStatus();
    if (dbStatus.ok) {
        res.status(200).send('Ready');
    } else {
        res.status(503).send('Not Ready');
    }
});

// ==================== API v1 路由 ====================
// 新版 API（带版本号）
app.use('/api/v1/sites', sitesRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1', uploadRouter);
app.use('/api/v1', dataRouter);
app.use('/api/v1/backup', backupRouter);

// 兼容旧版 API（无版本号）
app.use('/api/sites', sitesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', uploadRouter);
app.use('/api', dataRouter);
app.use('/api/backup', backupRouter);

// IP 信息 API
app.get('/api/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
    res.json({ ip, location: 'Local Network', isp: 'Self-hosted' });
});
app.get('/api/v1/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
    res.json({ ip, location: 'Local Network', isp: 'Self-hosted' });
});

// ==================== 错误处理 ====================
// API 404 处理
app.use(notFoundHandler);

// ==================== SPA 回退 ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 全局错误处理（必须放在最后）
app.use(errorHandler);

// ==================== 启动服务 ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nav Dashboard v${VERSION} 运行在 http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);

    // 初始化定时备份
    backup.setupScheduledBackup(db);
});
