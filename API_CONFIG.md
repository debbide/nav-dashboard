# Workers API 配置（仅限 Cloudflare 兼容性支持）

> ⚠️ **注意**：此配置仅适用于 Cloudflare 部署方式。Cloudflare 部署目前仅作为现有用户的兼容性支持，不再作为新功能开发的主要路径。对于新用户，建议使用 [Docker 部署方式](README.md#方式一docker-部署推荐主要维护)。

如果需要手动配置 Workers API 地址，请按以下步骤：

## 获取 Workers 地址

部署完成后，在 GitHub Actions 日志中查找：
```
✅ Workers 已部署: https://nav-dashboard.xxxxx.workers.dev
```

或者访问：https://dash.cloudflare.com → Workers & Pages → nav-dashboard
查看 Workers 的域名。

## 配置方法

项目已自动配置，无需手动操作！

部署时会自动：
1. 获取 Workers 部署的域名
2. 注入到前端 HTML 中
3. 前端 JS 自动使用正确的 API 地址

## 本地开发

本地开发时，前端会自动使用 `http://localhost:8787`

运行：
```bash
npm run dev
```

## 自定义域名

如果设置了自定义域名：

1. 在 Cloudflare Dashboard 添加自定义域名
2. 前端会自动使用部署时注入的地址

无需修改代码！
