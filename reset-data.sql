-- 清空现有数据
DELETE FROM sites;
DELETE FROM categories;

-- 重置自增ID
DELETE FROM sqlite_sequence WHERE name='sites';
DELETE FROM sqlite_sequence WHERE name='categories';

-- 插入默认分类
INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('常用工具', '🛠️', '#a78bfa', 1),
  ('开发资源', '💻', '#c084fc', 2),
  ('设计素材', '🎨', '#e879f9', 3),
  ('学习教程', '📚', '#67e8f9', 4),
  ('娱乐休闲', '🎮', '#60a5fa', 5);

-- 插入示例站点
INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES
  ('GitHub', 'https://github.com', '全球最大的代码托管平台', 'https://github.githubassets.com/favicons/favicon.svg', 2, 1),
  ('Google', 'https://google.com', '全球最大的搜索引擎', 'https://www.google.com/favicon.ico', 1, 2),
  ('Stack Overflow', 'https://stackoverflow.com', '程序员问答社区', 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', 2, 3);
