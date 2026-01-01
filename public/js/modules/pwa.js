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
 * 设置复制链接功能
 */
export function setupCopyLinks() {
    // 复制到剪贴板
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showCopyToast();
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showCopyToast();
        }
    }

    function showCopyToast() {
        const toast = document.getElementById('copyToast');
        if (toast) {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 1500);
        }
    }

    // 右键复制
    document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.url) {
            e.preventDefault();
            copyToClipboard(card.dataset.url);
        }
    });

    // 移动端长按复制
    let longPressTimer = null;
    document.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.url) {
            longPressTimer = setTimeout(() => {
                e.preventDefault();
                copyToClipboard(card.dataset.url);
            }, 600);
        }
    });

    document.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    document.addEventListener('touchmove', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}
