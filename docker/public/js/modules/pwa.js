/**
 * PWA 模块
 */

let deferredPrompt = null;

/**
 * 检测移动端
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 注册 Service Worker
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    }
}

/**
 * 初始化 PWA 安装提示
 */
export function initPwaPrompt() {
    // 监听 beforeinstallprompt 事件
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        if (localStorage.getItem('pwaDismissed')) return;

        if (isMobile()) {
            setTimeout(() => {
                const prompt = document.getElementById('pwaPrompt');
                if (prompt) prompt.style.display = 'flex';
            }, 3000);
        }
    });

    const installBtn = document.getElementById('pwaInstall');
    const closeBtn = document.getElementById('pwaClose');
    const prompt = document.getElementById('pwaPrompt');

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('PWA install:', outcome);
                deferredPrompt = null;
            }
            if (prompt) prompt.style.display = 'none';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (prompt) prompt.style.display = 'none';
            localStorage.setItem('pwaDismissed', 'true');
        });
    }
}

/**
 * 复制到剪贴板（供右键菜单等调用）
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast();
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast();
    }
}

export function showToast(text = '✓ 链接已复制') {
    const toast = document.getElementById('copyToast');
    if (toast) {
        toast.textContent = text;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 1500);
    }
}
