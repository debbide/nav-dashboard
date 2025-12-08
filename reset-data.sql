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
  -- 常用工具 (category_id = 1)
  ('Google', 'https://google.com', '搜索引擎', 'https://www.google.com/favicon.ico', 1, 1),
  ('Bing', 'https://bing.com', '微软搜索', 'https://www.bing.com/favicon.ico', 1, 2),
  ('百度', 'https://baidu.com', '百度搜索', 'https://www.baidu.com/favicon.ico', 1, 3),
  ('DeepL', 'https://deepl.com', '翻译工具', 'https://static.deepl.com/img/favicon/favicon_32.png', 1, 4),
  ('ChatGPT', 'https://chat.openai.com', 'AI对话', 'https://chat.openai.com/favicon.ico', 1, 5),
  
  -- 开发资源 (category_id = 2)
  ('GitHub', 'https://github.com', '代码托管', 'https://github.githubassets.com/favicons/favicon.svg', 2, 1),
  ('GitLab', 'https://gitlab.com', 'GitLab', 'https://gitlab.com/favicon.ico', 2, 2),
  ('Stack Overflow', 'https://stackoverflow.com', '问答社区', 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', 2, 3),
  ('NPM', 'https://npmjs.com', 'Node包管理', 'https://static.npmjs.com/favicon.ico', 2, 4),
  ('Docker Hub', 'https://hub.docker.com', '容器镜像', 'https://www.docker.com/favicon.ico', 2, 5),
  ('Cloudflare', 'https://cloudflare.com', 'CDN服务', 'https://www.cloudflare.com/favicon.ico', 2, 6),
  ('Vercel', 'https://vercel.com', '前端部署', 'https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico', 2, 7),
  
  -- 设计素材 (category_id = 3)
  ('Figma', 'https://figma.com', '设计工具', 'https://static.figma.com/app/icon/1/favicon.png', 3, 1),
  ('Dribbble', 'https://dribbble.com', '设计灵感', 'https://cdn.dribbble.com/assets/favicon-b38525134603b9513174ec887944bde1a869eb6cd414f4d640ee48ab2a15a26b.ico', 3, 2),
  ('Unsplash', 'https://unsplash.com', '免费图片', 'https://unsplash.com/favicon.ico', 3, 3),
  ('IconFont', 'https://iconfont.cn', '阿里图标', 'https://img.alicdn.com/imgextra/i2/O1CN01ZyAlrn1MwaMhqz36G_!!6000000001499-73-tps-64-64.ico', 3, 4),
  ('Canva', 'https://canva.com', '在线设计', 'https://static.canva.com/static/images/favicon.ico', 3, 5),
  
  -- 学习教程 (category_id = 4)
  ('MDN', 'https://developer.mozilla.org', 'Web文档', 'https://developer.mozilla.org/favicon.ico', 4, 1),
  ('W3Schools', 'https://w3schools.com', '教程网站', 'https://www.w3schools.com/favicon.ico', 4, 2),
  ('LeetCode', 'https://leetcode.cn', '刷题平台', 'https://leetcode.cn/favicon.ico', 4, 3),
  ('掘金', 'https://juejin.cn', '技术社区', 'https://lf3-cdn-tos.bytescm.com/obj/static/xitu_juejin_web/static/favicons/favicon-32x32.png', 4, 4),
  ('B站', 'https://bilibili.com', '视频学习', 'https://www.bilibili.com/favicon.ico', 4, 5),
  
  -- 娱乐休闲 (category_id = 5)
  ('YouTube', 'https://youtube.com', '视频平台', 'https://www.youtube.com/favicon.ico', 5, 1),
  ('Netflix', 'https://netflix.com', '流媒体', 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.ico', 5, 2),
  ('Spotify', 'https://spotify.com', '音乐平台', 'https://www.spotify.com/favicon.ico', 5, 3),
  ('Steam', 'https://store.steampowered.com', '游戏平台', 'https://store.steampowered.com/favicon.ico', 5, 4),
  ('Reddit', 'https://reddit.com', '社区论坛', 'https://www.reddit.com/favicon.ico', 5, 5);

-- 创建设置表（如果不存在）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 插入默认背景图设置
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('background_image', 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop');
