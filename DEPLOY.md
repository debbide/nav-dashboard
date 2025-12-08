# 快速部署指南

基于 GitHub Actions 的一键部署方案，使用 4 个 Secrets 变量配置。

---

## 🚀 部署步骤

### 第 1 步：配置 GitHub Secrets

访问：https://github.com/debbide/nav-dashboard/settings/secrets/actions

依次添加以下 **4 个 Secrets**：

---

#### Secret 1: CLOUDFLARE_API_TOKEN

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token**
3. 使用模板 **Edit Cloudflare Workers**
4. 点击 **Create Token**
5. **复制** Token

添加到 GitHub：
- Name: `CLOUDFLARE_API_TOKEN`
- Secret: 粘贴 Token

---

#### Secret 2: CLOUDFLARE_ACCOUNT_ID

1. 访问 https://dash.cloudflare.com
2. 右侧侧边栏查看 **Account ID**
3. 复制 Account ID

添加到 GitHub：
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Secret: 粘贴 Account ID

---

#### Secret 3: D1_DATABASE_ID

**方式 A：使用现有数据库**
- Name: `D1_DATABASE_ID`
- Secret: `110c9d6b-52d7-4d2c-876b-1c6ba08f22d4`

**方式 B：创建新数据库**
```powershell
npx wrangler d1 create nav-dashboard-db
```
复制输出的 `database_id`

---

#### Secret 4: KV_NAMESPACE_ID

**方式 A：使用现有命名空间**
- Name: `KV_NAMESPACE_ID`
- Secret: `cb261e73c6414283a804222054699019`

**方式 B：创建新命名空间**
```powershell
npx wrangler kv:namespace create nav-images
```
复制输出的 `id`

---

### 第 2 步：运行部署

1. 访问：https://github.com/debbide/nav-dashboard/actions
2. 选择 **Deploy to Cloudflare** workflow
3. 点击 **Run workflow** → **Run workflow**
4. 等待部署完成 ✅

---

### 第 3 步：配置 Pages 绑定（仅首次）

部署完成后，在 Cloudflare Dashboard 配置一次：

1. 访问 https://dash.cloudflare.com → **Pages** → **nav-dashboard**
2. 进入 **Settings** → **Functions**
3. 添加以下绑定：

**D1 Database Binding**:
- Variable name: `DB`
- D1 database: `nav-dashboard-db`

**KV Namespace Binding**:
- Variable name: `KV`
- KV namespace: 选择包含 `nav-images` 的命名空间

4. 点击 **Save**

---

## 🎉 完成

访问你的导航站：
- **主页**：https://nav-dashboard.pages.dev
- **管理后台**：https://nav-dashboard.pages.dev/admin.html

---

## 🔄 后续更新

以后只需要：
1. 修改代码
2. 推送到 GitHub
3. **自动部署** ✨

无需任何手动操作！

---

## 💡 快速配置（推荐）

如果你已经在本地创建了资源，直接使用这些值：

```
CLOUDFLARE_API_TOKEN = [从 Dashboard 创建]
CLOUDFLARE_ACCOUNT_ID = [从 Dashboard 获取]
D1_DATABASE_ID = 110c9d6b-52d7-4d2c-876b-1c6ba08f22d4
KV_NAMESPACE_ID = cb261e73c6414283a804222054699019
```

---

## ❓ 常见问题

### Q: 部署失败？
A: 
1. 检查 4 个 Secrets 是否都已添加
2. 验证 API Token 权限是否正确
3. 查看 Actions 日志获取详细错误

### Q: Pages 显示 404 或错误？
A: 确认已在 Dashboard 配置 D1 和 KV 绑定

### Q: 如何更新数据库？
A: 修改 `schema.sql` 后推送代码，Actions 会自动执行

### Q: 如何查看部署日志？
A: 访问 https://github.com/debbide/nav-dashboard/actions

---

## 📚 相关文档

- **详细配置说明**：`.github/SECRETS_SETUP.md`
- **项目说明**：`README.md`
- **KV 配置说明**：`.github/KV_SETUP.md`
