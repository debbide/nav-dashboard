# 导航站 - Docker 版本（主要维护）

一个基于卡片式布局的现代化导航站点，采用磨砂玻璃设计风格，支持 Docker 自托管部署。这是目前项目的主要维护版本。

![导航站截图](../screenshot.png)

## ✨ 特性

- 🎨 磨砂玻璃效果 + 暖色调设计
- 🌙 暗色模式切换
- 🔍 多引擎搜索 (Google/Bing/GitHub)
- 📱 响应式布局
- 🖼️ 灵活图标支持 (URL/本地上传)
- 🔒 密码保护管理后台

## 🚀 快速部署

### 使用 Docker Compose（推荐）

```bash
# 1) 创建 .env 并设置强密码（必填）
cat > .env <<'EOF'
ADMIN_PASSWORD=replace-with-a-strong-password
TZ=Asia/Shanghai
EOF

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问：`http://localhost:3000`

> 请务必在启动前设置强 `ADMIN_PASSWORD`，不要使用弱口令。

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t nav-dashboard .

# 运行容器
docker run -d \
  --name nav-dashboard \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  -e ADMIN_PASSWORD=replace-with-a-strong-password \
  nav-dashboard
```

## ⚙️ 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `ADMIN_PASSWORD` | *(必填，无安全默认值建议)* | 管理后台密码 |
| `TZ` | `UTC` | 时区 |

### 数据持久化

```yaml
volumes:
  - ./data:/app/data       # SQLite 数据库
  - ./uploads:/app/uploads # 上传的图片
```

## 📂 目录结构

```
docker/
├── server/
│   ├── index.js    # Express 后端
│   └── db.js       # 数据库模块
├── public/         # 前端静态文件
├── data/           # SQLite 数据 (运行时)
├── uploads/        # 上传图片 (运行时)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🔧 管理后台

访问 `/admin.html` 进入管理后台

**管理密码**：使用部署时设置的 `ADMIN_PASSWORD`

管理员相关写操作和备份接口由服务端鉴权保护，未登录请求会返回 `401`。

## ✅ 基础验证

```bash
npm test
```

当前最小测试覆盖 Docker 端的服务启动结构和关键鉴权边界。

## 📄 许可证

MIT License
