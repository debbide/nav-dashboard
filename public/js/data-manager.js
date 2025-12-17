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
                            导出所有分类、站点和设置数据为 JSON 文件，可用于备份或迁移到其他版本。
                        </p>
                        <button class="btn-primary" onclick="exportData()">
                            <span>⬇️ 下载备份文件</span>
                        </button>
                    </div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.2); margin: 2rem 0;">
                    <div class="form-group">
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

    if (!confirm('确定要导入数据吗？这将覆盖现有的所有分类、站点和设置数据！')) {
        event.target.value = '';
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.categories || !data.sites) {
            msgEl.textContent = '无效的备份文件格式';
            msgEl.className = 'password-msg error';
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
