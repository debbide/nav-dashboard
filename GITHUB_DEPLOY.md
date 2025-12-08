# GitHub Actions 部署指南

完整的 GitHub Secrets 配置和部署说明。

---

## 📋 部署方案

使用 **4 个 GitHub Secrets** 配置，实现推送代码即自动部署。

---

## 🔑 配置 Secrets

### 访问配置页面

https://github.com/debbide/nav-dashboard/settings/secrets/actions

---

## 1️⃣ CLOUDFLARE_API_TOKEN

### 获取步骤：

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token** 按钮
3. 选择模板 **Edit Cloudflare Workers**
4. 或者自定义权限（推荐）：
   ```
   ✅ Account - Workers Scripts - Edit
   ✅ Account - Cloudflare Pages - Edit
   ✅ Account - D1 - Edit
   ✅ Account - Workers KV Storage - Edit
   ```
5. 点击 **Continue to summary**
6. 点击 **Create Token**
7. **立即复制 Token**（只显示一次！）

### 添加到 GitHub：

- Name: `CLOUDFLARE_API_TOKEN`
- Secret: 粘贴刚才复制的 Token

---

## 2️⃣ CLOUDFLARE_ACCOUNT_ID

### 获取步骤：

1. 访问 https://dash.cloudflare.com
2. 在右侧侧边栏找到 **Account ID**
3. 点击复制图标

### 添加到 GitHub：

- Name: `CLOUDFLARE_ACCOUNT_ID`
- Secret: 粘贴 Account ID（格式：`a1b2c3d4e5f6...`）

---

## 3️⃣ D1_DATABASE_ID

### 获取步骤：

本地已创建数据库，直接使用：

```
110c9d6b-52d7-4d2c-876b-1c6ba08f22d4
```

如需查看所有数据库：
```powershell
npx wrangler d1 list
```

### 添加到 GitHub：

- Name: `D1_DATABASE_ID`
- Secret: `110c9d6b-52d7-4d2c-876b-1c6ba08f22d4`

---

## 4️⃣ KV_NAMESPACE_ID

### 获取步骤：

本地已创建命名空间，直接使用：

```
cb261e73c6414283a804222054699019
```

如需查看所有命名空间：
```powershell
npx wrangler kv:namespace list
```

### 添加到 GitHub：

- Name: `KV_NAMESPACE_ID`
- Secret: `cb261e73c6414283a804222054699019`

---

## ✅ 配置检查

添加完成后，确认 Secrets 页面显示：

- [x] CLOUDFLARE_API_TOKEN
- [x] CLOUDFLARE_ACCOUNT_ID
- [x] D1_DATABASE_ID
- [x] KV_NAMESPACE_ID

---

## 🚀 开始部署

### 第一次部署：

1. 访问 https://github.com/debbide/nav-dashboard/actions
2. 点击左侧 **Deploy to Cloudflare**
3. 点击右上角 **Run workflow**
4. 选择 `main` 分支
5. 点击 **Run workflow** 开始部署

### 查看部署进度：

点击正在运行的 workflow，查看实时日志。

### 部署成功标志：

看到 `✅ 部署完成！` 消息。

---

## ⚙️ Pages 绑定配置（首次部署后）

> **重要**：首次部署后需要在 Cloudflare Dashboard 配置一次 Pages 绑定

### 配置步骤：

1. 访问 https://dash.cloudflare.com
2. 左侧菜单选择 **Pages**
3. 点击项目 **nav-dashboard**
4. 进入 **Settings** 标签
5. 向下滚动到 **Functions** 部分
6. 添加以下绑定：

#### D1 Database Binding

- 点击 **Add binding** (在 D1 database bindings 下)
- Variable name: `DB`
- D1 database: 选择 `nav-dashboard-db`
- 点击 **Save**

#### KV Namespace Binding

- 点击 **Add binding** (在 KV namespace bindings 下)
- Variable name: `KV`
- KV namespace: 选择 ID 为 `cb261e73c6414283a804222054699019` 的命名空间
- 点击 **Save**

### 完成！

配置保存后，Pages 会自动重新部署，几分钟后即可访问。

---

## 🌐 访问你的导航站

部署成功后访问：

- **主页**: https://nav-dashboard.pages.dev
- **管理后台**: https://nav-dashboard.pages.dev/admin.html

---

## 🔄 日常使用

配置完成后，以后的流程非常简单：

```bash
# 1. 修改代码
# 2. 提交和推送
git add .
git commit -m "更新功能"
git push

# 3. 自动部署 ✨（无需任何操作）
```

GitHub Actions 会自动：
- 检测代码推送
- 更新配置文件
- 部署 Workers
- 部署 Pages

---

## 📊 部署状态

查看部署历史：
- https://github.com/debbide/nav-dashboard/actions

查看 Cloudflare 资源：
- D1 数据库：https://dash.cloudflare.com → D1
- KV 命名空间：https://dash.cloudflare.com → Workers → KV
- Pages 项目：https://dash.cloudflare.com → Pages

---

## 🐛 故障排查

### 问题 1: Actions 失败 "Unauthorized"

**原因**：API Token 无效或权限不足

**解决**：
1. 重新创建 API Token
2. 确保包含所有必要权限
3. 更新 GitHub Secret

---

### 问题 2: Pages 显示 "Not Found"

**原因**：未配置 Pages 绑定

**解决**：
按照上面的步骤配置 D1 和 KV 绑定

---

### 问题 3: 数据库初始化失败

**原因**：数据库已存在或 ID 错误

**解决**：
1. 检查 D1_DATABASE_ID 是否正确
2. 访问 Cloudflare Dashboard 验证数据库存在
3. 可以忽略此错误（continue-on-error: true）

---

### 问题 4: 图片上传失败

**原因**：KV 绑定未配置

**解决**：
确认 Pages 项目中已添加 KV 绑定

---

## 🎉 大功告成！

现在你有了一个完全自动化部署的导航站！

任何代码修改推送到 GitHub 后都会自动部署到 Cloudflare Pages 🚀
