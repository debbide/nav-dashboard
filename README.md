# 导航站 - Cloudflare 版本

一个基于卡片式布局的现代化导航站点，采用磨砂玻璃（Glassmorphism）设计风格，部署在 Cloudflare 无服务器平台。

![导航站截图](screenshot.png)

## ✨ 特性

- 🎨 **磨砂玻璃效果** - 现代化的 Glassmorphism 设计风格
- 🌈 **暖色调配色** - 温暖舒适的视觉体验
- 📱 **响应式布局** - 完美适配各种设备
- 🔍 **实时搜索** - 快速查找站点
- 📁 **分类管理** - 多级分类组织导航
- 🖼️ **灵活图标** - 支持远程 URL 和本地上传
- 🔗 **Logo 自动获取** - 支持 Google / toolb.cn 双源 API 一键获取网站图标
- ⚙️ **后台管理** - 完整的 CRUD 功能
- ⚡ **边缘计算** - Cloudflare 全球网络加速
- 🚀 **一键部署** - GitHub Actions 自动部署

## 🏗️ 技术架构

- **Cloudflare Workers** - 无服务器后端 API
- **Cloudflare D1** - SQLite 边缘数据库
- **Cloudflare KV** - 键值存储（图片）
- **Cloudflare Pages** - 静态站点托管
- **原生 JavaScript** - 无框架依赖

## 🚀 快速部署

### 第 1 步：Fork 或克隆仓库

```bash
git clone https://github.com/debbide/nav-dashboard.git
cd nav-dashboard
```

### 第 2 步：配置 GitHub Secrets

访问：`设置` → `Secrets and variables` → `Actions`

添加以下 **4 个 Secrets**：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | API 令牌 | [创建 Token](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | 账户 ID | [Dashboard](https://dash.cloudflare.com) 右侧 |
| `D1_DATABASE_ID` | D1 数据库 ID | `wrangler d1 create nav-dashboard-db` |
| `KV_NAMESPACE_ID` | KV 命名空间 ID | `wrangler kv:namespace create nav-images` |

**API Token 权限配置参考：**

![API Token 权限配置](api-token-permissions.png)

> 💡 详细配置步骤请查看 [GITHUB_DEPLOY.md](GITHUB_DEPLOY.md)

### 第 3 步：初始化数据库（⚠️ 仅首次部署执行）

> **重要**：此步骤只需在首次部署时执行一次，后续更新无需重复！

1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **Initialize Database**
3. 点击 **Run workflow**
4. `reset_data` 选择 `true` 可导入示例数据，选择 `false` 则只创建空表

### 第 4 步：部署应用

1. 选择 **Deploy to Cloudflare**
2. 点击 **Run workflow**
3. 后续代码更新会自动触发部署

### 🎉 完成！

访问：`https://nav-dashboard.你的账户.workers.dev`

## 📂 项目结构

```
nav-dashboard/
├── src/
│   └── index.js           # Workers API
├── public/                # 前端静态文件
│   ├── index.html         # 主页
│   ├── admin.html         # 管理后台
│   ├── css/               # 样式文件
│   └── js/                # 脚本文件
├── .github/
│   └── workflows/
│       └── deploy.yml     # GitHub Actions
├── schema.sql             # D1 数据库架构
├── wrangler.toml          # Cloudflare 配置
└── package.json
```

## 🎯 主要功能

### 主页功能
- ✅ 卡片式站点展示
- ✅ 分类标签过滤
- ✅ 实时搜索
- ✅ 响应式布局

### 管理后台
- ✅ 站点管理（增删改查）
- ✅ 分类管理
- ✅ 图片上传（KV 存储）
- ✅ 排序功能

## 📋 API 接口

### 站点接口
- `GET /api/sites` - 获取所有站点
- `POST /api/sites` - 创建站点
- `PUT /api/sites/:id` - 更新站点
- `DELETE /api/sites/:id` - 删除站点

### 分类接口
- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 文件接口
- `POST /api/upload` - 上传图片到 KV
- `GET /api/images/{filename}` - 获取图片

## 🎨 设计特色

### 磨砂玻璃效果
```css
.glass-effect {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### 暖色调配色
- 主色：`#ff9a56` 🧡
- 辅助色：`#ffb347` 🍊
- 渐变背景：紫色到橙色

## 🔄 更新流程

配置完成后，以后只需：

```bash
git add .
git commit -m "更新内容"
git push
```

GitHub Actions 会自动部署！🚀

## 📚 文档

- [DEPLOY.md](DEPLOY.md) - 快速部署指南
- [GITHUB_DEPLOY.md](GITHUB_DEPLOY.md) - 详细部署文档
- [.github/SECRETS_SETUP.md](.github/SECRETS_SETUP.md) - Secrets 配置
- [.github/KV_SETUP.md](.github/KV_SETUP.md) - KV 存储说明

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署 Workers
npm run deploy

# 部署 Pages
npm run pages:deploy
```

## 🔒 安全建议

生产环境建议：
1. 为管理后台添加身份验证
2. 使用 HTTPS
3. 限制 API 访问频率
4. 定期备份数据

## 📊 数据管理

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

### 部署失败？
1. 检查 4 个 Secrets 是否正确配置
2. 验证 API Token 权限
3. 查看 Actions 日志

### Pages 显示错误？
确认已配置 D1 和 KV 绑定

### 图片无法上传？
检查 KV 命名空间绑定是否正确

## 📄 许可证

MIT License

## 🙏 致谢

感谢 Cloudflare 提供的强大无服务器平台！

---

**现在就开始部署你的导航站吧！** ⚡🎉
