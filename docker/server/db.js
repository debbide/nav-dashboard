const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nav.db');
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

    console.log('✅ 数据库初始化完成');
}

// 初始化
initDatabase();

module.exports = db;
