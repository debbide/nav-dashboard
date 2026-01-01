/**
 * 上传路由模块
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// 上传图片
router.post('/', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: '没有上传文件或文件类型不支持' });
    }
    res.json({ success: true, message: '上传成功', data: { url: `/api/images/${req.file.filename}` } });
});

// 获取图片
router.get('/images/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Image not found');
    }
    res.sendFile(filePath);
});

// 图片代理
router.get('/proxy/image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).send('Missing url parameter');
    }
    try {
        new URL(imageUrl);
    } catch {
        return res.status(400).send('Invalid url parameter');
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavDashboard/1.0)', 'Accept': 'image/*' }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).send('Image fetch failed');
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/')) {
            return res.status(400).send('Not an image');
        }

        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=604800');
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        res.status(504).send('Image proxy timeout');
    }
});

module.exports = router;
