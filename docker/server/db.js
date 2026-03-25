const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.NAV_DATA_DIR
    ? path.resolve(process.env.NAV_DATA_DIR)
    : path.join(__dirname, '..', 'data');
const dbPath = process.env.NAV_DB_PATH
    ? path.resolve(process.env.NAV_DB_PATH)
    : path.join(dataDir, 'nav.db');

// 确保数据库目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

// 启用 WAL 模式提升性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
function initDatabase() {
    // 创建分类表
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT DEFAULT '#ff9a56',
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 创建站点表
    db.exec(`
        CREATE TABLE IF NOT EXISTS sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            description TEXT,
            logo TEXT,
            category_id INTEGER,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
    `);

    // 创建设置表
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    // 创建标签表
    db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#6366f1',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 创建站点-标签关联表
    db.exec(`
        CREATE TABLE IF NOT EXISTS site_tags (
            site_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (site_id, tag_id),
            FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
    `);

    // ==================== 添加索引优化查询性能 ====================
    // 站点表索引
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sites_category_id ON sites(category_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sites_sort_order ON sites(sort_order)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sites_category_sort ON sites(category_id, sort_order)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sites_created_at ON sites(created_at)`);

    // 分类表索引
    db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order)`);

    // 站点名称搜索索引（用于 LIKE 查询优化）
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name)`);

    // 标签相关索引
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_site_tags_site_id ON site_tags(site_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_site_tags_tag_id ON site_tags(tag_id)`);

    // ==================== 数据库迁移：添加新字段 ====================
    // 检查 sites 表是否有 click_count 字段，没有则添加
    const columns = db.prepare("PRAGMA table_info(sites)").all();
    const hasClickCount = columns.some(col => col.name === 'click_count');
    if (!hasClickCount) {
        db.exec(`ALTER TABLE sites ADD COLUMN click_count INTEGER DEFAULT 0`);
        console.log('✅ 已添加 click_count 字段');
    }

    // 插入默认数据（如果表为空）
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (categoryCount.count === 0) {
        const insertCategory = db.prepare(`
            INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)
        `);
        insertCategory.run('常用工具', '🛠️', '#ff9a56', 1);
        insertCategory.run('开发资源', '💻', '#ffb347', 2);
        insertCategory.run('设计素材', '🎨', '#ffc875', 3);
        insertCategory.run('学习教程', '📚', '#ffd89b', 4);
        insertCategory.run('娱乐休闲', '🎮', '#ffe4a3', 5);

        // 插入示例站点
        const insertSite = db.prepare(`
            INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertSite.run('GitHub', 'https://github.com', '全球最大的代码托管平台', 'https://github.githubassets.com/favicons/favicon.svg', 2, 1);
        insertSite.run('Google', 'https://google.com', '全球最大的搜索引擎', 'https://www.google.com/favicon.ico', 1, 2);
        insertSite.run('Stack Overflow', 'https://stackoverflow.com', '程序员问答社区', 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', 2, 3);
    }

    // 插入默认背景图
    const bgSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('background_image');
    if (!bgSetting) {
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
            'background_image',
            'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop'
        );
    }

    console.log('✅ 数据库初始化完成（含索引）');
}

/**
 * 获取数据库健康状态
 * @returns {{ ok: boolean, tables: number, sites: number, categories: number }}
 */
function getHealthStatus() {
    try {
        const tables = db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`).get();
        const sites = db.prepare('SELECT COUNT(*) as count FROM sites').get();
        const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();

        return {
            ok: true,
            tables: tables.count,
            sites: sites.count,
            categories: categories.count
        };
    } catch (error) {
        return {
            ok: false,
            error: error.message
        };
    }
}

// 初始化
initDatabase();

module.exports = db;
module.exports.getHealthStatus = getHealthStatus;
module.exports.dbPath = dbPath;
