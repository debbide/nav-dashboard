/**
 * WebDAV 备份路由模块
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const backup = require('../backup');

// 获取备份配置
router.get('/config', (req, res) => {
    const config = backup.getBackupConfig(db);
    // 不返回密码明文
    if (config.webdav_password) {
        config.webdav_password = '******';
    }
    res.json({ success: true, data: config });
});

// 保存备份配置
router.put('/config', (req, res) => {
    try {
        const { webdav_url, webdav_username, webdav_password, backup_frequency } = req.body;

        backup.saveBackupConfig(db, {
            webdav_url,
            webdav_username,
            webdav_password,
            backup_frequency
        });

        // 重新设置定时任务
        backup.setupScheduledBackup(db);

        res.json({ success: true, message: '备份配置已保存' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 测试 WebDAV 连接
router.post('/test', async (req, res) => {
    try {
        const { webdav_url, webdav_username, webdav_password } = req.body;
        const result = await backup.testConnection(webdav_url, webdav_username, webdav_password);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 立即执行备份
router.post('/now', async (req, res) => {
    try {
        const result = await backup.performBackup(db);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 获取云端备份列表
router.get('/list', async (req, res) => {
    try {
        const backups = await backup.listBackups(db);
        res.json({ success: true, data: backups });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 从云端恢复
router.post('/restore', async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ success: false, message: '请指定备份文件' });
        }
        const result = await backup.restoreBackup(db, filename);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
