# 导航站 - Cloudflare 版本

一个基于卡片式布局的现代化导航站点，采用磨砂玻璃（Glassmorphism）设计风格，部署在 Cloudflare 无服务器平台。

## ✨ 特性

- 🎨 **磨砂玻璃效果** - 现代化的 Glassmorphism 设计风格
- 🌈 **暖色调配色** - 温暖舒适的视觉体验
- 📱 **响应式布局** - 完美适配各种设备
- 🔍 **实时搜索** - 快速查找站点
- 📁 **分类管理** - 多级分类组织导航
- 🖼️ **灵活图标** - 支持远程 URL 和上传到 R2
- ⚙️ **后台管理** - 完整的 CRUD 功能
- ⚡ **边缘计算** - Cloudflare 全球网络加速

## 🏗️ 技术架构

- **Cloudflare Workers** - 无服务器后端 API
- **Cloudflare D1** - SQLite 边缘数据库
- **Cloudflare R2** - 对象存储（图片）
- **Cloudflare Pages** - 静态站点托管
- **原生 JavaScript** - 无框架依赖

## 📂 项目结构

```
nav-dashboard/
├── src/
│   └── index.js           # Workers 主文件
├── public/                # 静态文件（Pages）
│   ├── index.html         # 主页
│   ├── admin.html         # 管理后台
│   ├── css/
│   │   ├── style.css      # 主样式
│   │   └── admin.css      # 后台样式
│   └── js/
│       ├── main.js        # 主页逻辑
│       └── admin.js       # 后台逻辑
├── schema.sql             # D1 数据库架构
├── wrangler.toml          # Cloudflare 配置
└── package.json
```

## 🚀 部署指南

### 前置要求

1. Cloudflare 账户
2. Node.js 和 npm
3. Wrangler CLI

### 步骤 1: 安装依赖

```bash
npm install
```

### 步骤 2: 登录 Cloudflare

```bash
npx wrangler login
```

### 步骤 3: 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create nav-dashboard-db

# 复制输出的 database_id，更新到 wrangler.toml 中
```

### 步骤 4: 初始化数据库

```bash
# 执行 schema
npx wrangler d1 execute nav-dashboard-db --file=./schema.sql
```

### 步骤 5: 创建 R2 存储桶

```bash
# 创建 R2 存储桶
npx wrangler r2 bucket create nav-dashboard-images

# 启用公共访问
# 在 Cloudflare Dashboard -> R2 -> nav-dashboard-images -> Settings
# 启用 "Public Access" 并记录公共域名 ID
```

### 步骤 6: 更新配置

编辑 `wrangler.toml`，替换：
- `YOUR_D1_DATABASE_ID` - 替换为步骤 3 获取的 database_id
- `YOUR_R2_PUBLIC_ID` - 替换为 R2 存储桶的公共域名 ID

### 步骤 7: 部署 Workers

```bash
npm run deploy
```

### 步骤 8: 部署 Pages

```bash
# 方式 1: 通过 CLI
npm run pages:deploy

# 方式 2: 通过 Git（推荐）
# 1. 将代码推送到 GitHub
# 2. 在 Cloudflare Dashboard -> Pages 中连接仓库
# 3. 设置构建目录为 "public"
# 4. 部署
```

### 步骤 9: 配置 Pages 路由（重要）

在 Cloudflare Pages 项目设置中，添加 Workers 路由：

1. 进入 Pages 项目 -> Settings -> Functions
2. 添加 Service Binding:
   - Variable name: `API`
   - Service: `nav-dashboard` (你的 Workers 名称)
   - Environment: `production`

或者使用 Pages Functions，在 `public/_worker.js` 中：

```javascript
export { default } from '../src/index.js';
```

## 🧪 本地开发

### 开发 Workers

```bash
npm run dev
```

访问: http://localhost:8787

### 开发 Pages

```bash
npm run pages:dev
```

访问: http://localhost:8788

## 📋 API 文档

### 站点接口

- `GET /api/sites` - 获取所有站点
  - 查询参数: `category` (分类ID), `search` (搜索关键词)
- `GET /api/sites/:id` - 获取单个站点
- `POST /api/sites` - 创建站点
- `PUT /api/sites/:id` - 更新站点
- `DELETE /api/sites/:id` - 删除站点

### 分类接口

- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 文件上传

- `POST /api/upload` - 上传图片到 R2
  - Content-Type: `multipart/form-data`
  - 字段: `image`

## 🔧 配置说明

### wrangler.toml

```toml
name = "nav-dashboard"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "nav-dashboard-db"
database_id = "YOUR_D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "nav-dashboard-images"

[vars]
R2_PUBLIC_ID = "YOUR_R2_PUBLIC_ID"
```

## 🎯 使用说明

### 访问站点

部署完成后，访问你的 Pages 域名：
- 主页: `https://your-project.pages.dev`
- 管理后台: `https://your-project.pages.dev/admin.html`

### 添加站点

1. 访问管理后台
2. 点击"添加站点"
3. 填写站点信息
4. 选择分类
5. 上传 Logo 或输入远程 URL
6. 保存

### 管理分类

1. 在管理后台切换到"分类管理"
2. 添加或编辑分类
3. 设置图标（Emoji）和颜色
4. 调整排序

## 🔒 安全建议

1. **添加身份验证** - 为管理后台添加 Cloudflare Access 保护
2. **限制 API** - 使用 Workers 限流功能
3. **CORS 配置** - 根据需要调整 CORS 策略
4. **环境变量** - 敏感信息使用 Secrets 存储

## 💡 优化建议

### 性能优化

1. **启用缓存**
```javascript
// 在 Workers 中添加缓存
const cache = caches.default;
```

2. **使用 KV 缓存热点数据**
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_id"
```

### 功能扩展

- 添加站点访问统计
- 实现标签系统
- 支持导入/导出
- 添加站点收藏功能
- 实现评分和评论

## 📊 数据库管理

### 查询数据

```bash
npx wrangler d1 execute nav-dashboard-db --command="SELECT * FROM sites"
```

### 备份数据

```bash
npx wrangler d1 export nav-dashboard-db --output=backup.sql
```

### 恢复数据

```bash
npx wrangler d1 execute nav-dashboard-db --file=backup.sql
```

## 🐛 故障排查

### Workers 部署失败

- 检查 `wrangler.toml` 配置
- 确认 D1 database_id 正确
- 查看部署日志: `npx wrangler tail`

### 图片上传失败

- 确认 R2 存储桶已创建
- 检查 R2_PUBLIC_ID 配置
- 验证公共访问已启用

### API 调用失败

- 检查 CORS 配置
- 确认 Workers 路由正确
- 查看浏览器控制台错误

## 📝 更新日志

### v1.0.0 (2024-12-08)
- ✅ 初始版本发布
- ✅ 完整的 CRUD 功能
- ✅ Cloudflare 全平台部署
- ✅ 磨砂玻璃设计风格

## 📄 许可证

MIT License

## 🙏 致谢

感谢 Cloudflare 提供的强大无服务器平台！

---

**享受你的 Cloudflare 导航站！** ⚡🎉
