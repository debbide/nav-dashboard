# GitHub Actions 自动部署指南

## 🚀 部署步骤

### 1️⃣ 获取 Cloudflare API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **Create Token**
3. 使用模板 **Edit Cloudflare Workers**
4. 或者自定义权限：
   - Account - Cloudflare Pages - Edit
   - Account - D1 - Edit
   - Account - R2 - Edit
5. 点击 **Continue to summary** → **Create Token**
6. **复制并保存** 这个 Token（只显示一次）

### 2️⃣ 获取 Account ID

1. 访问 https://dash.cloudflare.com
2. 右侧侧边栏可以看到 **Account ID**
3. 复制这个 ID

### 3️⃣ 初始化 Git 仓库

```powershell
# 进入项目目录
cd e:\ck\docker\nav-dashboard

# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit - Cloudflare 导航站"
```

### 4️⃣ 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名称：`nav-dashboard`（或其他名称）
3. 设置为 **Public** 或 **Private**
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 **Create repository**

### 5️⃣ 推送代码到 GitHub

```powershell
# 添加远程仓库（替换为你的 GitHub 用户名）
git remote add origin https://github.com/你的用户名/nav-dashboard.git

# 重命名分支为 main
git branch -M main

# 推送代码
git push -u origin main
```

### 6️⃣ 配置 GitHub Secrets

1. 在 GitHub 仓库页面，点击 **Settings**
2. 左侧菜单选择 **Secrets and variables** → **Actions**
3. 点击 **New repository secret**

添加以下两个 Secrets：

**Secret 1: CLOUDFLARE_API_TOKEN**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: 粘贴步骤 1 获取的 API Token

**Secret 2: CLOUDFLARE_ACCOUNT_ID**
- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: 粘贴步骤 2 获取的 Account ID

### 7️⃣ 配置 Pages 项目绑定

在 Cloudflare Dashboard 配置（只需一次）：

1. 访问 https://dash.cloudflare.com → **Pages** → **nav-dashboard**
2. 进入 **Settings** → **Functions**
3. 添加 **D1 database binding**:
   - Variable name: `DB`
   - D1 database: `nav-dashboard-db`
4. 添加 **R2 bucket binding**:
   - Variable name: `BUCKET`
   - R2 bucket: `nav-dashboard-images`
5. 添加 **Environment variable**:
   - Variable name: `R2_PUBLIC_ID`
   - Value: `f249af155623469d94c5404717ea3888.r2.dev`
6. 点击 **Save**

### 8️⃣ 触发自动部署

配置完成后，有两种方式触发部署：

**方式 1: 推送代码**
```powershell
# 修改代码后
git add .
git commit -m "更新功能"
git push
```

**方式 2: 手动触发**
1. 在 GitHub 仓库页面，点击 **Actions**
2. 选择 **Deploy to Cloudflare**
3. 点击 **Run workflow**

### 9️⃣ 查看部署状态

1. 在 GitHub 仓库页面，点击 **Actions**
2. 查看最新的 workflow run
3. 等待部署完成 ✅

### 🎉 完成！

部署成功后访问：
- 主页：https://nav-dashboard.pages.dev
- 管理后台：https://nav-dashboard.pages.dev/admin.html

---

## 📝 常见问题

### Q: Actions 失败显示权限错误？
A: 检查 API Token 权限是否正确，需要包含 Pages 编辑权限

### Q: 部署成功但页面显示错误？
A: 确认 Pages 项目的 D1、R2 绑定已配置

### Q: 如何更新代码？
A: 直接修改代码并推送，Actions 会自动部署：
```powershell
git add .
git commit -m "更新说明"
git push
```

---

## 🔄 后续更新流程

以后只需要：
1. 修改代码
2. `git add .`
3. `git commit -m "说明"`
4. `git push`
5. 自动部署 ✨

简单高效！
