/**
 * 快速添加和编辑模式模块
 */

import { verifyPassword, createSite, fetchCategories } from './api.js';
import { loadSites, currentCategory, currentSearchTerm, showToast } from './ui.js';
import { enableEditMode, disableEditMode, getEditMode } from './drag.js';

const DEFAULT_ICON = '/default-icon.png';

// 存储待执行的回调
let pendingQuickAddAction = null;

/**
 * 初始化编辑模式
 */
export function initEditMode() {
    const gearMenuBtn = document.getElementById('gearMenuBtn');
    const gearMenu = document.getElementById('gearMenu');
    const editModeBtn = document.getElementById('editModeBtn');
    const passwordModal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('editPassword');
    const confirmBtn = document.getElementById('passwordConfirmBtn');
    const cancelBtn = document.getElementById('passwordCancelBtn');
    const passwordError = document.getElementById('passwordError');

    if (!gearMenuBtn || !gearMenu) return;

    // 齿轮菜单显示/隐藏
    gearMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = gearMenu.style.display === 'block';
        gearMenu.style.display = isVisible ? 'none' : 'block';
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
        if (!gearMenu.contains(e.target) && e.target !== gearMenuBtn) {
            gearMenu.style.display = 'none';
        }
    });

    // 编辑排序按钮
    if (editModeBtn) {
        if (sessionStorage.getItem('editModeUnlocked') === 'true') {
            editModeBtn.classList.add('active');
            editModeBtn.querySelector('span:last-child').textContent = '退出编辑';
        }

        editModeBtn.addEventListener('click', () => {
            gearMenu.style.display = 'none';

            if (getEditMode()) {
                disableEditMode();
                editModeBtn.classList.remove('active');
                editModeBtn.querySelector('span:last-child').textContent = '编辑排序';
            } else {
                if (sessionStorage.getItem('editModeUnlocked') === 'true') {
                    enableEditMode();
                    editModeBtn.classList.add('active');
                    editModeBtn.querySelector('span:last-child').textContent = '退出编辑';
                } else {
                    passwordModal.style.display = 'flex';
                    passwordInput.focus();
                    passwordError.textContent = '';
                }
            }
        });
    }

    // 确认密码
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => handleVerifyPassword());
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleVerifyPassword();
        });
    }

    // 取消
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            passwordModal.style.display = 'none';
            passwordInput.value = '';
            passwordError.textContent = '';
        });
    }

    // 点击遮罩关闭
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                passwordModal.style.display = 'none';
                passwordInput.value = '';
            }
        });
    }
}

/**
 * 验证密码
 */
async function handleVerifyPassword() {
    const passwordInput = document.getElementById('editPassword');
    const passwordError = document.getElementById('passwordError');
    const passwordModal = document.getElementById('passwordModal');
    const editModeBtn = document.getElementById('editModeBtn');

    try {
        const result = await verifyPassword(passwordInput.value);

        if (result.success) {
            sessionStorage.setItem('editModeUnlocked', 'true');
            passwordModal.style.display = 'none';
            passwordInput.value = '';

            if (pendingQuickAddAction) {
                pendingQuickAddAction();
                pendingQuickAddAction = null;
            } else {
                enableEditMode();
                if (editModeBtn) {
                    editModeBtn.classList.add('active');
                    editModeBtn.querySelector('span:last-child').textContent = '退出编辑';
                }
            }
        } else {
            passwordError.textContent = result.error || '密码错误';
            passwordInput.select();
        }
    } catch (error) {
        passwordError.textContent = '验证失败，请重试';
    }
}

/**
 * 初始化快速添加功能
 */
export function initQuickAdd() {
    const quickAddBtn = document.getElementById('quickAddBtn');
    const quickAddModal = document.getElementById('quickAddModal');
    const quickAddName = document.getElementById('quickAddName');
    const quickAddUrl = document.getElementById('quickAddUrl');
    const quickAddLogo = document.getElementById('quickAddLogo');
    const quickAddFetch1 = document.getElementById('quickAddFetch1');
    const quickAddFetch2 = document.getElementById('quickAddFetch2');
    const quickAddDefault = document.getElementById('quickAddDefault');
    const quickAddLogoPreview = document.getElementById('quickAddLogoPreview');
    const quickAddCancelBtn = document.getElementById('quickAddCancelBtn');
    const quickAddConfirmBtn = document.getElementById('quickAddConfirmBtn');
    const quickAddError = document.getElementById('quickAddError');
    const quickAddCategory = document.getElementById('quickAddCategory');
    const gearMenu = document.getElementById('gearMenu');
    const passwordModal = document.getElementById('passwordModal');

    if (!quickAddBtn || !quickAddModal) return;

    // 点击快速添加按钮
    quickAddBtn.addEventListener('click', () => {
        gearMenu.style.display = 'none';

        if (sessionStorage.getItem('editModeUnlocked') === 'true') {
            openQuickAddModal();
        } else {
            pendingQuickAddAction = openQuickAddModal;
            passwordModal.style.display = 'flex';
            document.getElementById('editPassword').focus();
            document.getElementById('passwordError').textContent = '';
        }
    });

    // 打开快速添加弹窗
    async function openQuickAddModal() {
        quickAddName.value = '';
        quickAddUrl.value = '';
        quickAddLogo.value = '';
        quickAddLogoPreview.innerHTML = '';
        quickAddError.textContent = '';
        await loadQuickAddCategories();
        quickAddModal.style.display = 'flex';
        quickAddName.focus();
    }

    // 加载分类到下拉框
    async function loadQuickAddCategories() {
        try {
            const data = await fetchCategories();
            if (data.success && data.data) {
                quickAddCategory.innerHTML = '<option value="">选择分类...</option>' +
                    data.data.map(cat => `<option value="${cat.id}">${cat.icon || ''} ${cat.name}</option>`).join('');

                // 动态获取当前分类
                import('./ui.js').then(ui => {
                    if (ui.currentCategory && ui.currentCategory !== 'all') {
                        quickAddCategory.value = ui.currentCategory;
                    }
                });
            }
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    function closeQuickAddModal() {
        quickAddModal.style.display = 'none';
    }

    // 获取Logo - Google源
    quickAddFetch1.addEventListener('click', () => {
        const url = quickAddUrl.value.trim();
        if (!url) {
            quickAddError.textContent = '请先输入网站URL';
            return;
        }
        try {
            const domain = new URL(url).hostname;
            const logo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
            quickAddLogo.value = logo;
            updateQuickAddPreview(logo);
            quickAddError.textContent = '';
        } catch {
            quickAddError.textContent = 'URL格式无效';
        }
    });

    // 获取Logo - toolb.cn源
    quickAddFetch2.addEventListener('click', () => {
        const url = quickAddUrl.value.trim();
        if (!url) {
            quickAddError.textContent = '请先输入网站URL';
            return;
        }
        try {
            const domain = new URL(url).hostname;
            const logo = `https://toolb.cn/favicon/${domain}`;
            quickAddLogo.value = logo;
            updateQuickAddPreview(logo);
            quickAddError.textContent = '';
        } catch {
            quickAddError.textContent = 'URL格式无效';
        }
    });

    // 使用默认图标
    if (quickAddDefault) {
        quickAddDefault.addEventListener('click', () => {
            quickAddLogo.value = DEFAULT_ICON;
            updateQuickAddPreview(DEFAULT_ICON);
            quickAddError.textContent = '';
        });
    }

    // Logo输入变化时更新预览
    quickAddLogo.addEventListener('input', (e) => {
        updateQuickAddPreview(e.target.value);
    });

    function updateQuickAddPreview(url) {
        if (url && url.trim()) {
            quickAddLogoPreview.innerHTML = `<img src="${url}" alt="Logo" onerror="this.style.display='none'">`;
        } else {
            quickAddLogoPreview.innerHTML = '';
        }
    }

    // 取消按钮
    quickAddCancelBtn.addEventListener('click', closeQuickAddModal);

    // 点击遮罩关闭
    quickAddModal.addEventListener('click', (e) => {
        if (e.target === quickAddModal) {
            closeQuickAddModal();
        }
    });

    // 确认添加
    quickAddConfirmBtn.addEventListener('click', handleQuickAdd);
    quickAddName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') quickAddUrl.focus();
    });
    quickAddUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleQuickAdd();
    });

    async function handleQuickAdd() {
        const name = quickAddName.value.trim();
        const url = quickAddUrl.value.trim();
        let logo = quickAddLogo.value.trim();

        if (!name) {
            quickAddError.textContent = '请输入网站名称';
            quickAddName.focus();
            return;
        }
        if (!url) {
            quickAddError.textContent = '请输入网站URL';
            quickAddUrl.focus();
            return;
        }

        if (!logo) {
            try {
                const domain = new URL(url).hostname;
                logo = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
            } catch {
                quickAddError.textContent = 'URL格式无效';
                return;
            }
        }

        quickAddConfirmBtn.disabled = true;
        quickAddConfirmBtn.textContent = '添加中...';

        try {
            const result = await createSite({
                name,
                url,
                logo,
                category_id: quickAddCategory.value || null,
                sort_order: 0
            });

            if (result.success) {
                closeQuickAddModal();
                // 刷新当前分类列表
                import('./ui.js').then(ui => {
                    ui.loadSites(ui.currentCategory, ui.currentSearchTerm);
                });
                showToast('✅ 网站添加成功');
            } else {
                quickAddError.textContent = result.message || '添加失败';
            }
        } catch (error) {
            quickAddError.textContent = '网络错误，请重试';
        } finally {
            quickAddConfirmBtn.disabled = false;
            quickAddConfirmBtn.textContent = '添加';
        }
    }
}
