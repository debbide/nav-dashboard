// 数据管理功能 - 在页面加载后动态注入

document.addEventListener('DOMContentLoaded', function () {
    // 等待 admin.js 加载完成
    setTimeout(injectDataManagement, 100);
});

function injectDataManagement() {
    // 1. 添加数据管理菜单按钮
    const nav = document.querySelector('.admin-nav');
    if (nav && !document.querySelector('[data-tab="data"]')) {
        const dataBtn = document.createElement('button');
        dataBtn.className = 'nav-item';
        dataBtn.setAttribute('data-tab', 'data');
        dataBtn.innerHTML = '<span>💾</span><span>数据管理</span>';
        nav.appendChild(dataBtn);

        // 添加点击事件
        dataBtn.addEventListener('click', function () {
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.content-panel').forEach(panel => panel.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('dataPanel').classList.add('active');
        });
    }

    // 2. 添加数据管理面板
    const adminContent = document.querySelector('.admin-content');
    if (adminContent && !document.getElementById('dataPanel')) {
        const dataPanel = document.createElement('div');
        dataPanel.id = 'dataPanel';
        dataPanel.className = 'content-panel';
        dataPanel.innerHTML = `
            <div class="panel-header">
                <h2>💾 数据管理</h2>
            </div>
            <div class="table-container glass-effect" style="padding: 2rem;">
                <div style="max-width: 600px;">
                    <div class="form-group" style="margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; color: white;">📤 导出数据</h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: 1rem;">
                            导出分类、站点、标签、标签映射及非敏感设置为 JSON 文件，可用于备份或迁移。
                        </p>
                        <button class="btn-primary" onclick="exportData()">
                            <span>⬇️ 下载备份文件</span>
                        </button>
                    </div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.2); margin: 2rem 0;">
                    <div class="form-group" style="margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; color: white;">📥 导入数据</h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: 1rem;">
                            从备份文件导入数据。<strong style="color: #ff6b6b;">警告：将覆盖现有数据！</strong>
                        </p>
                        <input type="file" id="importFile" accept=".json" style="display: none;" onchange="handleImport(event)">
                        <button class="btn-primary" onclick="document.getElementById('importFile').click()">
                            <span>⬆️ 选择备份文件</span>
                        </button>
                        <div id="importMsg" class="password-msg" style="margin-top: 1rem;"></div>
                    </div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.2); margin: 2rem 0;">
                    <div class="form-group" style="margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; color: white;">📚 书签导入</h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: 1rem;">
                            从浏览器导出的书签 HTML 文件批量导入站点。<br>
                            <small>支持 Chrome、Firefox、Edge 等浏览器导出的书签文件</small>
                        </p>
                        <input type="file" id="bookmarkFile" accept=".html,.htm" style="display: none;" onchange="handleBookmarkImport(event)">
                        <button class="btn-primary" onclick="document.getElementById('bookmarkFile').click()">
                            <span>📁 选择书签文件</span>
                        </button>
                        <div id="bookmarkMsg" class="password-msg" style="margin-top: 1rem;"></div>
                    </div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.2); margin: 2rem 0;">
                    <div class="form-group">
                        <h3 style="margin-bottom: 1rem; color: white;">🖼️ 图标缓存</h3>
                        <p style="color: rgba(255,255,255,0.7); margin-bottom: 1rem;">
                            将所有外部图标下载并缓存到服务器本地，避免外部图片失效。
                        </p>
                        <button class="btn-primary" onclick="cacheAllLogos()" id="cacheLogosBtn">
                            <span>📥 缓存所有图标</span>
                        </button>
                        <button class="btn-secondary" onclick="restoreRemoteLogos()" id="restoreLogosBtn" style="margin-left: 1rem;">
                            <span>🌐 恢复网络图标</span>
                        </button>
                        <div id="cacheMsg" class="password-msg" style="margin-top: 1rem;"></div>
                    </div>
                </div>
            </div>
        `;
        adminContent.appendChild(dataPanel);
    }
}

// 数据导出
function exportData() {
    window.location.href = '/api/export';
}

// 数据导入
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const msgEl = document.getElementById('importMsg');

    if (!confirm('确定要导入数据吗？这将覆盖现有的分类、站点、标签及相关设置数据！')) {
        event.target.value = '';
        return;
    }

    try {
        let text = await file.text();
        // 去除可能的 BOM 头和首尾空白
        text = text.replace(/^\uFEFF/, '').trim();

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            msgEl.textContent = 'JSON 解析失败: ' + parseError.message;
            msgEl.className = 'password-msg error';
            return;
        }

        if (!data.categories || !data.sites) {
            msgEl.textContent = '无效的备份文件格式: 缺少 categories 或 sites 字段';
            msgEl.className = 'password-msg error';
            console.log('导入数据结构:', Object.keys(data));
            return;
        }

        const response = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: text
        });

        const result = await response.json();

        if (result.success) {
            msgEl.textContent = result.message;
            msgEl.className = 'password-msg success';
            setTimeout(() => location.reload(), 1500);
        } else {
            msgEl.textContent = result.message || '导入失败';
            msgEl.className = 'password-msg error';
        }
    } catch (error) {
        msgEl.textContent = '文件解析失败: ' + error.message;
        msgEl.className = 'password-msg error';
    }

    event.target.value = '';
}

// 缓存所有图标
async function cacheAllLogos() {
    const msgEl = document.getElementById('cacheMsg');
    const btn = document.getElementById('cacheLogosBtn');

    if (!confirm('确定要缓存所有外部图标吗？这可能需要一些时间。')) {
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ 缓存中...</span>';
    msgEl.textContent = '正在缓存外部图标，请稍候...';
    msgEl.className = 'password-msg';

    try {
        const response = await fetch('/api/sites/cache-logos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            msgEl.textContent = result.message;
            msgEl.className = 'password-msg success';
            if (result.cached > 0 || result.fixed > 0) {
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            msgEl.textContent = result.message || '缓存失败';
            msgEl.className = 'password-msg error';
        }
    } catch (error) {
        msgEl.textContent = '请求失败: ' + error.message;
        msgEl.className = 'password-msg error';
    }

    btn.disabled = false;
    btn.innerHTML = '<span>📥 缓存所有图标</span>';
}

// 恢复网络图标
async function restoreRemoteLogos() {
    const msgEl = document.getElementById('cacheMsg');
    const btn = document.getElementById('restoreLogosBtn');

    if (!confirm('确定要恢复为网络图标吗？\n这将把所有站点的图标重置为 Google Favicon 高清源。\n如果您的网络无法访问 Google 服务，图标将无法显示。')) {
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ 处理中...</span>';
    msgEl.textContent = '正在重置图标，请稍候...';
    msgEl.className = 'password-msg';

    try {
        const response = await fetch('/api/sites/restore-remote-logos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            msgEl.textContent = result.message;
            msgEl.className = 'password-msg success';
            setTimeout(() => location.reload(), 1500);
        } else {
            msgEl.textContent = result.message || '重置失败';
            msgEl.className = 'password-msg error';
        }
    } catch (error) {
        msgEl.textContent = '请求失败: ' + error.message;
        msgEl.className = 'password-msg error';
    }

    btn.disabled = false;
    btn.innerHTML = '<span>🌐 恢复网络图标</span>';
}

// 书签导入
async function handleBookmarkImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const msgEl = document.getElementById('bookmarkMsg');

    if (!confirm('确定要导入书签吗？这将添加新的分类和站点（不会覆盖现有数据）。')) {
        event.target.value = '';
        return;
    }

    msgEl.textContent = '正在解析书签文件...';
    msgEl.className = 'password-msg';

    try {
        const text = await file.text();

        const response = await fetch('/api/import/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'text/html' },
            body: text
        });

        const result = await response.json();

        if (result.success) {
            msgEl.textContent = result.message;
            msgEl.className = 'password-msg success';
            setTimeout(() => location.reload(), 1500);
        } else {
            msgEl.textContent = result.message || '导入失败';
            msgEl.className = 'password-msg error';
        }
    } catch (error) {
        msgEl.textContent = '导入失败: ' + error.message;
        msgEl.className = 'password-msg error';
    }

    event.target.value = '';
}
