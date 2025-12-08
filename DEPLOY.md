# Cloudflare 导航站部署指南

## 🎯 快速部署步骤

### 1. 准备工作

```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login
```

### 2. 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create nav-dashboard-db
```

**重要**：复制输出中的 `database_id`，例如：
```
✅ Successfully created DB 'nav-dashboard-db'
database_id = "xxxx-xxxx-xxxx-xxxx"
```

### 3. 更新 wrangler.toml

编辑 `wrangler.toml`，将 `YOUR_D1_DATABASE_ID` 替换为上一步获取的 `database_id`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nav-dashboard-db"
database_id = "替换为你的database_id"
```

### 4. 初始化数据库

```bash
# 执行数据库架构和初始数据
npx wrangler d1 execute nav-dashboard-db --file=./schema.sql
```

### 5. 创建 R2 存储桶

```bash
# 创建存储桶
npx wrangler r2 bucket create nav-dashboard-images
```

### 6. 配置 R2 公共访问

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **R2** -> **nav-dashboard-images**
3. 点击 **Settings** -> **Public Access**
4. 点击 **Allow Access**
5. 复制公共域名，格式为: `pub-xxxxxxxxxx.r2.dev`
6. 提取 `pub-` 后面的 ID 部分

### 7. 更新 R2 配置

编辑 `wrangler.toml`，将 `YOUR_R2_PUBLIC_ID` 替换为上一步获取的 ID：

```toml
[vars]
R2_PUBLIC_ID = "替换为你的R2公共域名ID"
```

### 8. 部署 Workers

```bash
# 部署后端 API
npm run deploy
```

部署成功后会显示 Workers URL，例如：
```
Published nav-dashboard (1.23 sec)
  https://nav-dashboard.your-subdomain.workers.dev
```

### 9. 部署 Pages

#### 方式 A: 通过 Git（推荐）

1. 将代码推送到 GitHub
2. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com) -> **Pages**
3. 点击 **Create a project** -> **Connect to Git**
4. 选择你的仓库
5. 配置构建设置：
   - **Build command**: 留空
   - **Build output directory**: `public`
6. 点击 **Save and Deploy**

#### 方式 B: 直接部署

```bash
npm run pages:deploy
```

### 10. 配置 Pages 与 Workers 集成

由于 Pages 和 Workers 是分开部署的，需要在前端配置 API 地址：

编辑 `public/js/main.js` 和 `public/js/admin.js`，在文件开头添加：

```javascript
// 配置 API 地址
const API_BASE = 'https://nav-dashboard.your-subdomain.workers.dev';

// 修改所有 fetch 调用，例如：
// 从: fetch('/api/sites')
// 改为: fetch(`${API_BASE}/api/sites`)
```

或者使用 **Pages Functions** 进行代理：

创建 `public/_worker.js`:
```javascript
export { default } from '../src/index.js';
```

这样可以直接使用相对路径 `/api/sites`。

### 11. 验证部署

访问你的 Pages 域名：
- 主页: `https://your-project.pages.dev`
- 管理后台: `https://your-project.pages.dev/admin.html`

## 🧪 本地开发

### 开发 Workers

```bash
npm run dev
```

访问: http://localhost:8787/api/sites

### 开发 Pages

```bash
npm run pages:dev
```

访问: http://localhost:8788

## 🔍 常见问题

### Q: D1 数据库执行失败？
A: 确保已登录 Cloudflare：`npx wrangler login`

### Q: R2 图片无法访问？
A: 检查 R2 存储桶的公共访问是否已启用

### Q: API 返回 CORS 错误？
A: Workers 已配置 CORS，检查前端是否正确调用 API

### Q: Pages 无法连接 Workers？
A: 使用 Pages Functions 或在前端配置完整的 Workers URL

## 📋 检查清单

- [ ] 已安装 Node.js 和 npm
- [ ] 已登录 Cloudflare CLI
- [ ] D1 数据库已创建并初始化
- [ ] R2 存储桶已创建并启用公共访问
- [ ] wrangler.toml 配置已更新
- [ ] Workers 部署成功
- [ ] Pages 部署成功
- [ ] 可以访问主页
- [ ] 可以访问管理后台
- [ ] 可以添加站点
- [ ] 可以上传图片

## 🎉 完成！

现在你的导航站已经成功部署到 Cloudflare！

访问地址：
- **主页**: https://your-project.pages.dev
- **管理后台**: https://your-project.pages.dev/admin.html
- **API**: https://nav-dashboard.your-subdomain.workers.dev

享受你的全球分布式导航站！⚡
