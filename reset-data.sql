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

-- 插入网站（只使用有图标的）
INSERT INTO sites (name, url, description, logo, category_id, sort_order) VALUES
  -- 常用工具 (category_id = 1)
  ('Google', 'https://google.com', '搜索引擎', 'https://www.google.com/favicon.ico', 1, 1),
  ('Gmail', 'https://mail.google.com', '谷歌邮箱', 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico', 1, 2),
  ('Outlook', 'https://outlook.live.com', '微软邮箱', 'https://outlook.live.com/favicon.ico', 1, 3),
  ('DeepL', 'https://deepl.com', '翻译工具', 'https://static.deepl.com/img/favicon/favicon_32.png', 1, 4),
  ('ChatGPT', 'https://chat.openai.com', 'AI对话', 'https://chat.openai.com/favicon.ico', 1, 5),
  ('Claude', 'https://claude.ai', 'AI助手', 'https://claude.ai/favicon.ico', 1, 6),
  ('Notion', 'https://notion.so', '笔记工具', 'https://www.notion.so/images/favicon.ico', 1, 7),
  ('Trello', 'https://trello.com', '任务管理', 'https://trello.com/favicon.ico', 1, 8),
  
  -- 开发资源 (category_id = 2)
  ('GitHub', 'https://github.com', '代码托管', 'https://github.githubassets.com/favicons/favicon.svg', 2, 1),
  ('GitLab', 'https://gitlab.com', 'GitLab', 'https://gitlab.com/favicon.ico', 2, 2),
  ('Bitbucket', 'https://bitbucket.org', '代码托管', 'https://bitbucket.org/favicon.ico', 2, 3),
  ('Stack Overflow', 'https://stackoverflow.com', '问答社区', 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico', 2, 4),
  ('NPM', 'https://npmjs.com', 'Node包管理', 'https://static.npmjs.com/favicon.ico', 2, 5),
  ('Docker Hub', 'https://hub.docker.com', '容器镜像', 'https://www.docker.com/favicon.ico', 2, 6),
  ('Cloudflare', 'https://cloudflare.com', 'CDN服务', 'https://www.cloudflare.com/favicon.ico', 2, 7),
  ('Vercel', 'https://vercel.com', '前端部署', 'https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico', 2, 8),
  ('Netlify', 'https://netlify.com', '网站托管', 'https://www.netlify.com/favicon.ico', 2, 9),
  ('Railway', 'https://railway.app', '应用部署', 'https://railway.app/favicon.ico', 2, 10),
  ('Supabase', 'https://supabase.com', '后端服务', 'https://supabase.com/favicon.ico', 2, 11),
  ('CodePen', 'https://codepen.io', '前端演示', 'https://codepen.io/favicon.ico', 2, 12),
  
  -- 设计素材 (category_id = 3)
  ('Figma', 'https://figma.com', '设计工具', 'https://static.figma.com/app/icon/1/favicon.png', 3, 1),
  ('Dribbble', 'https://dribbble.com', '设计灵感', 'https://cdn.dribbble.com/assets/favicon-b38525134603b9513174ec887944bde1a869eb6cd414f4d640ee48ab2a15a26b.ico', 3, 2),
  ('Behance', 'https://behance.net', '作品展示', 'https://www.behance.net/favicon.ico', 3, 3),
  ('Unsplash', 'https://unsplash.com', '免费图片', 'https://unsplash.com/favicon.ico', 3, 4),
  ('Pexels', 'https://pexels.com', '免费素材', 'https://www.pexels.com/favicon.ico', 3, 5),
  ('Canva', 'https://canva.com', '在线设计', 'https://static.canva.com/static/images/favicon.ico', 3, 6),
  ('Coolors', 'https://coolors.co', '配色工具', 'https://coolors.co/favicon.ico', 3, 7),
  ('FontAwesome', 'https://fontawesome.com', '图标库', 'https://fontawesome.com/favicon.ico', 3, 8),
  
  -- 学习教程 (category_id = 4)
  ('MDN', 'https://developer.mozilla.org', 'Web文档', 'https://developer.mozilla.org/favicon.ico', 4, 1),
  ('W3Schools', 'https://w3schools.com', '教程网站', 'https://www.w3schools.com/favicon.ico', 4, 2),
  ('LeetCode', 'https://leetcode.com', '刷题平台', 'https://leetcode.com/favicon.ico', 4, 3),
  ('freeCodeCamp', 'https://freecodecamp.org', '编程学习', 'https://www.freecodecamp.org/favicon.ico', 4, 4),
  ('Coursera', 'https://coursera.org', '在线课程', 'https://www.coursera.org/favicon.ico', 4, 5),
  ('Udemy', 'https://udemy.com', '在线课程', 'https://www.udemy.com/favicon.ico', 4, 6),
  ('Medium', 'https://medium.com', '技术博客', 'https://medium.com/favicon.ico', 4, 7),
  ('Dev.to', 'https://dev.to', '开发者社区', 'https://dev.to/favicon.ico', 4, 8),
  
  -- 娱乐休闲 (category_id = 5)
  ('YouTube', 'https://youtube.com', '视频平台', 'https://www.youtube.com/favicon.ico', 5, 1),
  ('Netflix', 'https://netflix.com', '流媒体', 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.ico', 5, 2),
  ('Spotify', 'https://spotify.com', '音乐平台', 'https://www.spotify.com/favicon.ico', 5, 3),
  ('Twitch', 'https://twitch.tv', '游戏直播', 'https://www.twitch.tv/favicon.ico', 5, 4),
  ('Discord', 'https://discord.com', '社区聊天', 'https://discord.com/favicon.ico', 5, 5),
  ('Reddit', 'https://reddit.com', '社区论坛', 'https://www.reddit.com/favicon.ico', 5, 6),
  ('Twitter', 'https://twitter.com', '社交媒体', 'https://abs.twimg.com/favicons/twitter.ico', 5, 7),
  ('Instagram', 'https://instagram.com', '图片分享', 'https://www.instagram.com/favicon.ico', 5, 8);

-- 创建设置表（如果不存在）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 插入默认背景图设置
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('background_image', 'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop');
