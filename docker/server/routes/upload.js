/**
 * 上传路由模块
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAllowedImageDomain } = require('../utils/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

// 上传目录
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer 配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon'];
        cb(null, allowed.includes(file.mimetype));
    }
});

// 上传图片（需要认证）
router.post('/', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: '没有上传文件或文件类型不支持' });
    }
    res.json({ success: true, message: '上传成功', data: { url: `/api/images/${req.file.filename}` } });
});

// 获取图片
router.get('/images/:filename', (req, res) => {
    // 安全检查：防止路径遍历
    const filename = path.basename(req.params.filename);
    if (filename !== req.params.filename || filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Image not found');
    }
    res.sendFile(filePath);
});

// 图片代理（带域名白名单）
router.get('/proxy/image', asyncHandler(async (req, res) => {
    const imageUrl = req.query.url;

    if (!imageUrl) {
        return res.status(400).json({
            success: false,
            error: 'Missing url parameter'
        });
    }

    // URL 格式验证
    let parsedUrl;
    try {
        parsedUrl = new URL(imageUrl);
    } catch {
        return res.status(400).json({
            success: false,
            error: 'Invalid url parameter'
        });
    }

    // 协议检查
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({
            success: false,
            error: 'Only http/https protocols are allowed'
        });
    }

    // SSRF 防护：检查域名白名单
    if (!isAllowedImageDomain(imageUrl)) {
        return res.status(403).json({
            success: false,
            error: 'Domain not allowed',
            message: '该域名不在允许列表中，如需添加请联系管理员'
        });
    }

    // 防止请求内网地址
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.endsWith('.local')) {
        return res.status(403).json({
            success: false,
            error: 'Internal addresses are not allowed'
        });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NavDashboard/1.0)',
                'Accept': 'image/*'
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).json({
                success: false,
                error: 'Image fetch failed',
                status: response.status
            });
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                error: 'Not an image',
                contentType
            });
        }

        // 限制响应大小（5MB）
        const contentLength = parseInt(response.headers.get('Content-Length') || '0');
        if (contentLength > 5 * 1024 * 1024) {
            return res.status(413).json({
                success: false,
                error: 'Image too large (max 5MB)'
            });
        }

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=604800');
        res.set('X-Content-Type-Options', 'nosniff');

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        if (error.name === 'AbortError') {
            return res.status(504).json({
                success: false,
                error: 'Image proxy timeout'
            });
        }
        throw error;
    }
}));

module.exports = router;
