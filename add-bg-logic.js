const fs = require('fs');

// 读取admin.js
const jsPath = 'public/js/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// 在文件末尾添加背景设置相关功能
const backgroundCode = `

// ==================== 背景设置功能 ====================

// 加载当前背景设置
async function loadBackgroundSetting() {
    try {
        const response = await fetch(\`\${API_BASE}/api/settings/background\`);
        const data = await response.json();
        
        if (data.background_image) {
            document.getElementById('backgroundUrl').value = data.background_image;
        }
    } catch (error) {
        console.error('加载背景设置失败:', error);
    }
}

// 保存背景设置
async function saveBackgroundSetting(url) {
    try {
        const response = await fetch(\`\${API_BASE}/api/settings/background\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ background_image: url })
        });
        
        const data = await response.json();
        
        if (data.background_image) {
            showNotification('背景设置已保存', 'success');
            // 更新首页背景
            if (window.opener) {
                window.opener.location.reload();
            }
        } else {
            showNotification(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存背景设置失败:', error);
        showNotification(\`保存失败: \${error.message}\`, 'error');
    }
}

// 初始化背景设置表单
function initBackgroundSettings() {
    const form = document.getElementById('backgroundForm');
    if (!form) return;
    
    // 加载当前背景
    loadBackgroundSetting();
    
    // 表单提交
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('backgroundUrl').value.trim();
        
        if (!url) {
            showNotification('请输入背景图片URL', 'error');
            return;
        }
        
        await saveBackgroundSetting(url);
    });
    
    // 预设背景按钮
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = btn.dataset.url;
            document.getElementById('backgroundUrl').value = url;
            await saveBackgroundSetting(url);
        });
        
        // 鼠标悬停效果
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = '#a78bfa';
            btn.style.transform = 'translateY(-2px)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'translateY(0)';
        });
    });
}

// 在切换到背景设置标签时初始化
const originalSwitchTab = window.switchTab || function() {};
window.switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'background') {
        initBackgroundSettings();
    }
};
`;

// 添加到文件末尾
js += backgroundCode;

// 写回文件
fs.writeFileSync(jsPath, js, 'utf8');

console.log('✅ admin.js已更新');
