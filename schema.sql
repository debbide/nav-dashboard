-- 创建分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#ff9a56',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建站点表
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
);

-- 插入默认分类
INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('常用工具', '🛠️', '#ff9a56', 1),
  ('开发资源', '💻', '#ffb347', 2),
  ('设计素材', '🎨', '#ffc875', 3),
  ('学习教程', '📚', '#ffd89b', 4),
  ('娱乐休闲', '🎮', '#ffe4a3', 5);

-- 插入示例站点
INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES
  ('GitHub', 'https://github.com', '全球最大的代码托管平台', 'https://github.githubassets.com/favicons/favicon.svg', 2, 1),
  ('Google', 'https://google.com', '全球最大的搜索引擎', 'https://www.google.com/favicon.ico', 1, 2),
  ('Stack Overflow', 'https://stackoverflow.com', '程序员问答社区', 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', 2, 3);
