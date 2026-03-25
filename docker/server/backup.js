/**
 * WebDAV 备份模块
 * 支持定时自动备份和手动备份/恢复
 */

const cron = require('node-cron');

let webdavClient = null;
let cronJob = null;
let createClientFn = null;
const SENSITIVE_SETTING_KEYS = new Set(['admin_password', 'webdav_password']);

function normalizeSettingsEntries(settings) {
    if (!settings) {
        return [];
    }

    if (Array.isArray(settings)) {
        return settings
            .filter(item => item && typeof item.key === 'string')
            .map(item => ({ key: item.key, value: item.value ?? '' }));
    }

    if (typeof settings === 'object') {
        return Object.entries(settings).map(([key, value]) => ({ key, value }));
    }

    return [];
}

// 动态导入 webdav (ESM 模块)
async function getWebDAVClient() {
    if (!createClientFn) {
        const webdav = await import('webdav');
        createClientFn = webdav.createClient;
    }
    return createClientFn;
}

// 获取备份配置
function getBackupConfig(db) {
    const config = {};
    const keys = ['webdav_url', 'webdav_username', 'webdav_password', 'backup_frequency', 'last_backup_time', 'last_backup_status'];

    for (const key of keys) {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        config[key] = row ? row.value : null;
    }

    return config;
}

// 保存备份配置
function saveBackupConfig(db, config) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    if (config.webdav_url !== undefined) {
        stmt.run('webdav_url', config.webdav_url);
    }
    if (config.webdav_username !== undefined) {
        stmt.run('webdav_username', config.webdav_username);
    }
    if (config.webdav_password !== undefined) {
        stmt.run('webdav_password', config.webdav_password);
    }
    if (config.backup_frequency !== undefined) {
        stmt.run('backup_frequency', config.backup_frequency);
    }
}

// 更新备份状态
function updateBackupStatus(db, status, time = null) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run('last_backup_status', status);
    if (time) {
        stmt.run('last_backup_time', time);
    }
}

// 创建 WebDAV 客户端
async function createWebDAVClient(url, username, password) {
    try {
        const createClient = await getWebDAVClient();
        webdavClient = createClient(url, {
            username,
            password
        });
        return webdavClient;
    } catch (error) {
        console.error('创建 WebDAV 客户端失败:', error.message);
        return null;
    }
}

// 导出数据为 JSON
function exportData(db) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
    const sites = db.prepare('SELECT * FROM sites ORDER BY sort_order ASC').all();
    const tags = db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
    const site_tags = db.prepare('SELECT site_id, tag_id FROM site_tags ORDER BY site_id ASC, tag_id ASC').all();

    // 获取非敏感设置
    const settings = {};
    const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT IN ('admin_password', 'webdav_password')").all();
    for (const row of rows) {
        settings[row.key] = row.value;
    }

    return {
        exportTime: new Date().toISOString(),
        version: '1.0',
        categories,
        sites,
        tags,
        site_tags,
        settings
    };
}

// 执行备份
async function performBackup(db) {
    const config = getBackupConfig(db);

    if (!config.webdav_url || !config.webdav_username || !config.webdav_password) {
        throw new Error('WebDAV 配置不完整');
    }

    // 创建客户端
    const client = await createWebDAVClient(config.webdav_url, config.webdav_username, config.webdav_password);
    if (!client) {
        throw new Error('无法创建 WebDAV 客户端');
    }

    // 导出数据
    const data = exportData(db);
    const jsonContent = JSON.stringify(data, null, 2);

    // 备份目录
    const backupDir = '/nav-backup';

    // 尝试创建备份目录（如果不存在）
    try {
        const dirExists = await client.exists(backupDir);
        if (!dirExists) {
            await client.createDirectory(backupDir);
            console.log(`创建备份目录: ${backupDir}`);
        }
    } catch (dirError) {
        console.warn('检查/创建目录失败，尝试直接上传:', dirError.message);
    }

    // 文件名：nav-dashboard-backup-YYYYMMDD.json
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `nav-dashboard-backup-${date}.json`;
    const filePath = `${backupDir}/${filename}`;

    try {
        // 尝试上传到备份目录
        await client.putFileContents(filePath, jsonContent, {
            contentLength: Buffer.byteLength(jsonContent, 'utf8'),
            overwrite: true
        });
    } catch (uploadError) {
        // 如果备份目录失败，尝试直接上传到根目录
        console.warn(`上传到 ${filePath} 失败，尝试根目录:`, uploadError.message);
        await client.putFileContents(`/${filename}`, jsonContent, {
            contentLength: Buffer.byteLength(jsonContent, 'utf8'),
            overwrite: true
        });
    }

    // 更新状态
    const now = new Date().toISOString();
    updateBackupStatus(db, 'success', now);

    // 清理超过7天的旧备份
    try {
        await cleanupOldBackups(client, 7);
    } catch (cleanupError) {
        console.warn('清理旧备份失败:', cleanupError.message);
    }

    console.log(`备份成功: ${filename}`);
    return { success: true, filename, time: now };
}

// 清理超过指定天数的旧备份
async function cleanupOldBackups(client, keepDays = 7) {
    const backupDir = '/nav-backup';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0].replace(/-/g, '');

    // 获取备份目录和根目录的文件
    const dirsToCheck = [backupDir, '/'];
    let deletedCount = 0;

    for (const dir of dirsToCheck) {
        try {
            const items = await client.getDirectoryContents(dir);
            const fileList = Array.isArray(items) ? items : (items.data || []);

            for (const item of fileList) {
                if (item.basename && item.basename.startsWith('nav-dashboard-backup-') && item.basename.endsWith('.json')) {
                    // 从文件名提取日期 nav-dashboard-backup-YYYYMMDD.json
                    const match = item.basename.match(/nav-dashboard-backup-(\d{8})\.json/);
                    if (match && match[1] < cutoffStr) {
                        const filePath = dir === '/' ? `/${item.basename}` : `${dir}/${item.basename}`;
                        try {
                            await client.deleteFile(filePath);
                            console.log(`删除旧备份: ${filePath}`);
                            deletedCount++;
                        } catch (delError) {
                            console.warn(`删除 ${filePath} 失败:`, delError.message);
                        }
                    }
                }
            }
        } catch (listError) {
            // 目录不存在或无法访问，跳过
        }
    }

    if (deletedCount > 0) {
        console.log(`已清理 ${deletedCount} 个旧备份文件`);
    }
}

// 从 WebDAV 获取备份文件列表
async function listBackups(db) {
    const config = getBackupConfig(db);

    if (!config.webdav_url || !config.webdav_username || !config.webdav_password) {
        throw new Error('WebDAV 配置不完整');
    }

    const client = await createWebDAVClient(config.webdav_url, config.webdav_username, config.webdav_password);
    if (!client) {
        throw new Error('无法创建 WebDAV 客户端');
    }

    const allBackups = [];
    const backupDir = '/nav-backup';

    // 辅助函数：从目录获取备份文件
    async function getBackupsFromDir(dir) {
        try {
            const items = await client.getDirectoryContents(dir);
            const fileList = Array.isArray(items) ? items : (items.data || []);
            return fileList
                .filter(item => item.basename && item.basename.startsWith('nav-dashboard-backup-') && item.basename.endsWith('.json'))
                .map(item => ({
                    filename: item.basename,
                    size: item.size || 0,
                    lastModified: item.lastmod || '',
                    path: dir === '/' ? `/${item.basename}` : `${dir}/${item.basename}`
                }));
        } catch (error) {
            console.warn(`列出目录 ${dir} 失败:`, error.message);
            return [];
        }
    }

    // 从备份目录获取
    const backupDirFiles = await getBackupsFromDir(backupDir);
    allBackups.push(...backupDirFiles);

    // 也从根目录获取（兼容旧备份）
    const rootFiles = await getBackupsFromDir('/');
    allBackups.push(...rootFiles);

    // 按文件名倒序排序
    return allBackups.sort((a, b) => b.filename.localeCompare(a.filename));
}

// 从 WebDAV 恢复数据
async function restoreBackup(db, filename, path = null) {
    const config = getBackupConfig(db);

    if (!config.webdav_url || !config.webdav_username || !config.webdav_password) {
        throw new Error('WebDAV 配置不完整');
    }

    const client = await createWebDAVClient(config.webdav_url, config.webdav_username, config.webdav_password);
    if (!client) {
        throw new Error('无法创建 WebDAV 客户端');
    }

    // 尝试多个可能的路径
    const pathsToTry = path ? [path] : [
        `/nav-backup/${filename}`,
        `/${filename}`
    ];

    let content = null;
    for (const tryPath of pathsToTry) {
        try {
            content = await client.getFileContents(tryPath, { format: 'text' });
            console.log(`成功从 ${tryPath} 读取备份`);
            break;
        } catch (error) {
            console.warn(`尝试路径 ${tryPath} 失败:`, error.message);
        }
    }

    if (!content) {
        throw new Error('无法找到备份文件');
    }

    const data = JSON.parse(content);

    // 验证数据格式
    if (!Array.isArray(data.categories) || !Array.isArray(data.sites)) {
        throw new Error('备份文件格式无效');
    }

    const tags = Array.isArray(data.tags) ? data.tags : [];
    const siteTags = Array.isArray(data.site_tags) ? data.site_tags : [];
    const settings = normalizeSettingsEntries(data.settings);

    // 原子恢复：所有数据在单一事务内完成，失败则整体回滚
    const restoreTransaction = db.transaction(() => {
        db.prepare('DELETE FROM site_tags').run();
        db.prepare('DELETE FROM sites').run();
        db.prepare('DELETE FROM tags').run();
        db.prepare('DELETE FROM categories').run();

        const insertCategory = db.prepare('INSERT INTO categories (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)');
        for (const cat of data.categories) {
            insertCategory.run(cat.id, cat.name, cat.icon || '', cat.color || '#ff9a56', cat.sort_order || 0);
        }

        const insertSite = db.prepare('INSERT INTO sites (id, name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const site of data.sites) {
            insertSite.run(site.id, site.name, site.url, site.description || '', site.logo || '', site.category_id, site.sort_order || 0);
        }

        const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
        for (const tag of tags) {
            insertTag.run(tag.id, tag.name, tag.color || '#6366f1');
        }

        const insertSiteTag = db.prepare('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)');
        for (const row of siteTags) {
            insertSiteTag.run(row.site_id, row.tag_id);
        }

        db.prepare("DELETE FROM settings WHERE key NOT IN ('admin_password', 'webdav_password')").run();
        const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const entry of settings) {
            if (!entry.key || SENSITIVE_SETTING_KEYS.has(entry.key)) {
                continue;
            }
            insertSetting.run(entry.key, entry.value ?? '');
        }
    });

    restoreTransaction();

    console.log(`恢复成功: ${filename}`);
    return {
        success: true,
        categories: data.categories.length,
        sites: data.sites.length,
        tags: tags.length,
        site_tags: siteTags.length
    };
}

// 设置定时备份
function setupScheduledBackup(db) {
    // 先停止现有任务
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }

    const config = getBackupConfig(db);
    const frequency = config.backup_frequency;

    if (!frequency || frequency === 'off') {
        console.log('定时备份已关闭');
        return;
    }

    let cronExpression;
    if (frequency === 'daily') {
        cronExpression = '0 3 * * *'; // 每天凌晨3点
    } else if (frequency === 'weekly') {
        cronExpression = '0 3 * * 0'; // 每周日凌晨3点
    } else {
        console.log(`未知的备份频率: ${frequency}`);
        return;
    }

    cronJob = cron.schedule(cronExpression, async () => {
        console.log(`执行定时备份 (${frequency})...`);
        try {
            await performBackup(db);
        } catch (error) {
            console.error('定时备份失败:', error.message);
            updateBackupStatus(db, `failed: ${error.message}`);
        }
    });

    console.log(`定时备份已设置: ${frequency} (${cronExpression})`);
}

// 测试 WebDAV 连接
async function testConnection(url, username, password) {
    try {
        const createClient = await getWebDAVClient();
        const client = createClient(url, { username, password });

        // 使用 exists 方法测试连接，比 getDirectoryContents 更简单可靠
        const exists = await client.exists('/');
        if (exists !== false) {
            return { success: true };
        }
        return { success: false, error: '无法访问目录' };
    } catch (error) {
        // 处理常见错误
        let errorMsg = error.message || '未知错误';
        if (errorMsg.includes('multistatus')) {
            // multistatus 解析错误但连接可能是正常的
            return { success: true, warning: 'WebDAV 响应格式非标准，但连接可用' };
        }
        if (errorMsg.includes('401')) {
            errorMsg = '认证失败，请检查用户名和密码';
        } else if (errorMsg.includes('404')) {
            errorMsg = '路径不存在，请检查 WebDAV 地址';
        }
        return { success: false, error: errorMsg };
    }
}

module.exports = {
    getBackupConfig,
    saveBackupConfig,
    performBackup,
    listBackups,
    restoreBackup,
    setupScheduledBackup,
    testConnection
};
