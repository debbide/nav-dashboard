# 导航仪表盘 NavDashboard

一个基于卡片式布局的现代化导航站点，采用磨砂玻璃（Glassmorphism）设计风格。Docker 是目前主要维护的部署方式，同时保留 Cloudflare 兼容性支持。

**🔗 在线演示**：https://nav.cscs.qzz.io

## ✨ 特性

### 🎨 界面设计
- **磨砂玻璃效果** - 现代化的 Glassmorphism 设计风格
- **暖色调配色** - 温暖舒适的视觉体验
- **📱 响应式布局** - 完美适配各种设备
- **骨架屏加载** - 优雅的加载体验

### 🔍 搜索功能
- **多引擎搜索** - 支持 Google、Bing、GitHub 一键切换
- **实时搜索** - 快速筛选站点
- **智能建议** - 搜索自动补全

### ⚙️ 管理功能
- **站点管理** - 完整的 CRUD 功能
- **分类管理** - 多级分类组织导航
- **拖拽排序** - 直观的排序操作
- **🖼️ 灵活图标** - 支持远程 URL 和本地上传
- **🔗 Logo API** - 多源自动获取

### 🔒 安全特性
- **密码哈希** - SHA-256 加密存储
- **API 限流** - 防暴力破解
- **Session 管理** - 安全的会话控制

### 🧩 浏览器插件
- **右键菜单** - 任意网页右键添加到导航站
- **自动获取** - 自动填充标题、URL、图标
- **分类选择** - 支持选择已有分类
- **双版本兼容** - 同时支持 Docker 版和 CF 版

---

## 🚀 快速部署

### 🐳 方式一：Docker 部署（推荐/主要维护）

适合有自己服务器的用户，数据本地存储，是目前项目的主要维护路径。

#### docker-compose.yml

```yaml
services:
  nav-dashboard:
    image: ghcr.io/debbide/simple-nav-dashboard:v1.3.0
    container_name: nav-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    environment:
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}
      - TZ=${TZ:-Asia/Shanghai}
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

#### 部署步骤

```bash
# 创建目录
mkdir nav-dashboard && cd nav-dashboard

# 创建 .env（必须设置强密码）
cat > .env <<'EOF'
ADMIN_PASSWORD=replace-with-a-strong-password
TZ=Asia/Shanghai
EOF

# 创建 docker-compose.yml（内容如上）

# 启动
docker-compose up -d

# 访问
# 主页：http://你的IP:3000
# 后台：http://你的IP:3000/admin.html
```

> 部署前请先设置强 `ADMIN_PASSWORD`，避免使用弱口令。

#### 更新升级

```bash
docker-compose pull
docker-compose up -d
```

---

### ☁️ 方式二：Cloudflare 部署（仅限兼容性支持）

> ⚠️ **注意**：Cloudflare 部署方式目前仅作为现有用户的兼容性支持，不再作为新功能开发的主要路径。

免费部署到 Cloudflare Pages，全球 CDN 加速。

#### 第 1 步：Fork 仓库

点击右上角 Fork 按钮，将仓库复制到你的 GitHub 账号。

#### 第 2 步：创建 Cloudflare 资源

登录 [Cloudflare Dashboard](https://dash.cloudflare.com)：

1. **创建 D1 数据库**
   - 进入 Workers & Pages → D1
   - 点击 Create database
   - 名称填 `nav-dashboard-db`
   - 记录 Database ID

2. **创建 KV 命名空间**
   - 进入 Workers & Pages → KV
   - 点击 Create a namespace
   - 名称填 `nav-dashboard-kv`
   - 记录 Namespace ID

#### 第 3 步：获取 API Token

1. 访问 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 Create Token
3. 选择 **Edit Cloudflare Workers** 模板
4. 创建并复制 Token

#### 第 4 步：配置 GitHub Secrets

进入你 Fork 的仓库 → Settings → Secrets and variables → Actions

添加以下 4 个 Secrets：

| Secret 名称 | 说明 |
|------------|------|
| `CLOUDFLARE_API_TOKEN` | 刚才创建的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard 右侧的 Account ID |
| `D1_DATABASE_ID` | 创建的数据库 ID |
| `KV_NAMESPACE_ID` | 创建的 KV 命名空间 ID |

#### 第 5 步：运行部署

1. 进入 Actions 页面
2. 运行 **Initialize Database**（首次）
3. 运行 **Deploy to Cloudflare**

#### 第 6 步：配置 Pages 绑定

> ⚠️ 首次部署后需要手动配置一次

1. 进入 Cloudflare Dashboard → Pages → nav-dashboard
2. Settings → Functions
3. 添加 D1 绑定：Variable name = `DB`，选择对应数据库
4. 添加 KV 绑定：Variable name = `KV`，选择对应命名空间

**🎉 完成！** 访问 `https://nav-dashboard.pages.dev`

---

## 🧩 浏览器插件

支持在任意网页右键快速添加到导航仪表盘。

### 安装步骤

1. 下载仓库中的 `chrome-extension` 文件夹
2. 打开 Chrome 访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `chrome-extension` 文件夹

### 配置插件

1. 点击工具栏的插件图标
2. 点击 ⚙️ 设置按钮
3. 输入你的导航站地址：
   - Docker 版：`http://你的IP:3000`
   - CF 版：`https://nav-dashboard.pages.dev`
4. 如果设置了密码，填入密码
5. 保存并测试连接

### 使用方法

**右键菜单**
- 在任意网页空白处右键
- 点击「添加到导航仪表盘」
- 确认信息后点击添加

**点击图标**
- 直接点击工具栏插件图标
- 自动填充当前页面信息
- 选择分类后添加

---

## 📂 项目结构

```
nav-dashboard/
├── src/
│   └── index.js           # Workers API
├── public/                # 前端静态文件
├── docker/                # Docker 版本（主要维护）
├── chrome-extension/      # 浏览器插件
├── .github/workflows/     # GitHub Actions
├── schema.sql             # 数据库架构
└── wrangler.toml          # Cloudflare 配置
```

---

## 📋 API 接口

### 站点接口
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/sites` | 获取所有站点 |
| `POST` | `/api/sites` | 创建站点 |
| `PUT` | `/api/sites/:id` | 更新站点 |
| `DELETE` | `/api/sites/:id` | 删除站点 |

### 分类接口
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 获取所有分类 |
| `POST` | `/api/categories` | 创建分类 |
| `PUT` | `/api/categories/:id` | 更新分类 |
| `DELETE` | `/api/categories/:id` | 删除分类 |

### 其他接口
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传图片 |
| `POST` | `/api/auth/verify` | 验证密码 |
| `GET` | `/api/export` | 导出数据 |
| `POST` | `/api/import` | 导入数据 |

---

## 🛠️ 本地开发

```bash
# Docker 版开发（推荐）
cd docker
npm install
npm run dev

# Docker 版最小测试
npm test

# CF 版开发（仅限兼容性维护）
npm install
npm run dev
```

Docker 管理相关写操作现在由服务端鉴权保护，前端隐藏按钮不再是唯一保护层。

---

## 🐛 故障排查

### Docker 版无法访问？
检查防火墙是否开放端口。

### CF 版部署失败？
1. 检查 4 个 Secrets 是否正确配置。
2. 验证 API Token 权限。
3. 查看 Actions 日志。

### CF 版 Pages 显示错误？
确认已配置 D1 和 KV 绑定（第 6 步）。

### 插件提示网络错误？
检查 API 地址是否正确，确认导航站正在运行。

---

## 🔄 升级指南

### 从旧版本升级

如果你从旧版本升级，可能需要手动执行数据库迁移。

#### Docker 版升级（主要维护）

新版本服务器启动时会**自动检测并添加新字段**，通常只需：

```bash
docker-compose pull
docker-compose up -d
```

如果遇到 `no such column: click_count` 错误，可手动执行：

```bash
# 进入容器执行 SQL
docker exec -it nav-dashboard sqlite3 /app/data/nav.db "ALTER TABLE sites ADD COLUMN click_count INTEGER DEFAULT 0;"

# 重启容器
docker-compose restart
```

#### Cloudflare 版升级（仅限兼容性维护）

在 Cloudflare Dashboard 的 D1 数据库控制台执行：

```sql
ALTER TABLE sites ADD COLUMN click_count INTEGER DEFAULT 0;
```

---

## 📄 许可证

MIT License

---

**⭐ 如果觉得不错，欢迎 Star 支持！**
