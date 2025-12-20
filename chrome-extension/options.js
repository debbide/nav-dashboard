document.addEventListener('DOMContentLoaded', async () => {
    const apiUrlInput = document.getElementById('apiUrl');
    const passwordInput = document.getElementById('password');
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    const messageDiv = document.getElementById('message');
    const testResultDiv = document.getElementById('testResult');

    // 加载已保存的设置
    const config = await chrome.storage.sync.get(['apiUrl', 'password']);
    if (config.apiUrl) {
        apiUrlInput.value = config.apiUrl;
    }
    if (config.password) {
        passwordInput.value = config.password;
    }

    // 显示消息
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 3000);
    }

    // 保存设置
    saveBtn.addEventListener('click', async () => {
        let apiUrl = apiUrlInput.value.trim();
        const password = passwordInput.value;

        if (!apiUrl) {
            showMessage('请输入 API 地址', 'error');
            return;
        }

        // 移除末尾的斜杠
        apiUrl = apiUrl.replace(/\/+$/, '');

        // 验证 URL 格式
        try {
            new URL(apiUrl);
        } catch (e) {
            showMessage('请输入有效的 URL 地址', 'error');
            return;
        }

        // 保存到 storage
        await chrome.storage.sync.set({ apiUrl, password });
        showMessage('✅ 设置已保存', 'success');
    });

    // 测试连接
    testBtn.addEventListener('click', async () => {
        let apiUrl = apiUrlInput.value.trim().replace(/\/+$/, '');

        if (!apiUrl) {
            testResultDiv.textContent = '❌ 请先输入 API 地址';
            testResultDiv.className = 'test-result error';
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = '测试中...';
        testResultDiv.className = 'test-result';

        try {
            const response = await fetch(`${apiUrl}/api/categories`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                const count = data.data?.length || 0;
                testResultDiv.textContent = `✅ 连接成功！发现 ${count} 个分类`;
                testResultDiv.className = 'test-result success';
            } else {
                throw new Error(data.message || '未知错误');
            }
        } catch (error) {
            testResultDiv.textContent = `❌ 连接失败: ${error.message}`;
            testResultDiv.className = 'test-result error';
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = '测试 API 连接';
        }
    });

    // 回车保存
    [apiUrlInput, passwordInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    });
});
