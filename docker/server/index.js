/**
 * NavDashboard Docker 版后端入口
 * 重构后的精简版本 - 所有路由已模块化
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 导入路由模块
const sitesRouter = require('./routes/sites');
const categoriesRouter = require('./routes/categories');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const uploadRouter = require('./routes/upload');
const dataRouter = require('./routes/data');
const backupRouter = require('./routes/backup');

// 导入备份模块（用于定时任务）
const backup = require('./backup');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==================== API 路由 ====================
app.use('/api/sites', sitesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', uploadRouter);  // 兼容 /api/images/:filename 和 /api/proxy/image
app.use('/api', dataRouter);    // 兼容 /api/export, /api/import, /api/import/bookmarks
app.use('/api/backup', backupRouter);

// IP 信息 API
app.get('/api/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown';
    res.json({ ip, location: 'Local Network', isp: 'Self-hosted' });
});

// ==================== SPA 回退 ====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ==================== 启动服务 ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nav Dashboard v1.2.0 (Refactored) 运行在 http://localhost:${PORT}`);

    // 初始化定时备份
    backup.setupScheduledBackup(db);
});
