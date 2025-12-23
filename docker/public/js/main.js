// 使用相对路径 - Workers 同时提供前端和 API
const API_BASE = '';

// ==================== 分页状态 ====================
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentCategory = 'all';
let currentSearchTerm = '';

// ==================== 主要功能 ====================

// 加载背景图
async function loadBackground() {
    try {
        const response = await fetch(`${API_BASE}/api/settings/background`);
        const data = await response.json();

        if (data.background_image) {
            document.body.style.backgroundImage = `linear-gradient(135deg, rgba(224, 195, 252, 0.15) 0%, rgba(142, 197, 252, 0.15) 50%, rgba(184, 240, 245, 0.15) 100%), url('${data.background_image}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';
        }
    } catch (error) {
        console.error('加载背景图失败:', error);
    }
}

// 加载分类
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/api/categories`);
        const data = await response.json();

        if (data.success) {
            renderCategories(data.data);
        }
    } catch (error) {
        console.error('加载分类失败:', error);
    }
}

// 动态生成骨架屏
function showSkeletons(count = null) {
    const container = document.getElementById('sitesGrid');
    const lastCount = count || parseInt(localStorage.getItem('lastSiteCount')) || 6;
    const skeletonCount = Math.min(Math.max(lastCount, 4), 12);

    container.innerHTML = Array(skeletonCount).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-logo"></div>
            <div class="skeleton-text"></div>
        </div>
    `).join('');
}

// 隐藏骨架屏（带动画）
function hideSkeletons() {
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach((skeleton, index) => {
        setTimeout(() => {
            skeleton.classList.add('fade-out');
        }, index * 30);
    });
}

// 加载站点（首次加载）
async function loadSites(categoryId = 'all', searchTerm = '') {
    // 重置分页状态
    currentPage = 1;
    hasMore = true;
    currentCategory = categoryId;
    currentSearchTerm = searchTerm;

    // 显示骨架屏
    showSkeletons();

    try {
        const data = await fetchSites(categoryId, 1, searchTerm);

        if (data.success) {
            // 记住站点数量用于下次骨架屏
            localStorage.setItem('lastSiteCount', data.data.length.toString());

            // 隐藏骨架屏后渲染
            hideSkeletons();
            setTimeout(() => {
                renderSites(data.data, false);
                setupLazyLoad();

                // 更新分页状态
                if (data.pagination) {
                    hasMore = data.pagination.hasMore;
                    updateLoadMoreTrigger();
                }
            }, 150);
        }
    } catch (error) {
        console.error('加载站点失败:', error);
        document.getElementById('sitesGrid').innerHTML = '<div class="no-results">加载失败，请刷新重试</div>';
    }
}

// 获取站点 API
async function fetchSites(categoryId, page, searchTerm = '') {
    let url = `${API_BASE}/api/sites?page=${page}&pageSize=24`;

    if (categoryId && categoryId !== 'all') {
        url += `&category=${categoryId}`;
    }

    if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
    }

    const response = await fetch(url);
    return await response.json();
}

// 加载更多站点
async function loadMoreSites() {
    if (isLoading || !hasMore) return;

    isLoading = true;
    showLoadingIndicator();

    try {
        currentPage++;
        const data = await fetchSites(currentCategory, currentPage, currentSearchTerm);

        if (data.success && data.data.length > 0) {
            appendSites(data.data);
            setupLazyLoad();

            if (data.pagination) {
                hasMore = data.pagination.hasMore;
            }
        } else {
            hasMore = false;
        }
    } catch (error) {
        console.error('加载更多失败:', error);
        currentPage--; // 回滚页码
    }

    isLoading = false;
    hideLoadingIndicator();
    updateLoadMoreTrigger();
}

// 追加站点到网格
function appendSites(sites) {
    const container = document.getElementById('sitesGrid');

    sites.forEach(site => {
        const card = createSiteCard(site);
        if (card) {
            card.classList.add('site-card-enter');
            container.appendChild(card);
            // 触发重绘后添加动画类
            requestAnimationFrame(() => {
                card.classList.add('site-card-enter-active');
            });
        }
    });
}

// 渲染分类
function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    // 默认选中第一个分类（常用工具）
    const defaultCategoryId = categories.length > 0 ? categories[0].id : 'all';

    // 先添加其他分类（第一个默认激活）
    categories.forEach((category, index) => {
        const isActive = index === 0;
        const tab = createCategoryTab(category.id, category.name, category.color, isActive, category.icon);
        container.appendChild(tab);
    });

    // 最后添加"全部"标签（放在底部，不激活）
    const allTab = createCategoryTab('all', '全部', '#a78bfa', categories.length === 0, '🔯');
    container.appendChild(allTab);

    // 默认加载第一个分类的站点
    currentCategory = defaultCategoryId;
    loadSites(defaultCategoryId);
}

// 创建分类标签
function createCategoryTab(id, name, color, active = false, icon = '') {
    const tab = document.createElement('button');
    tab.className = 'category-tab' + (active ? ' active' : '');
    tab.dataset.category = id;
    tab.style.setProperty('--category-color', color);

    if (icon) {
        tab.innerHTML = `<span class="category-icon">${icon}</span>${name}`;
    } else {
        tab.textContent = name;
    }

    tab.addEventListener('click', () => {
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadSites(id, document.getElementById('searchInput').value);
    });

    return tab;
}

// 渲染站点
function renderSites(sites, append = false) {
    const container = document.getElementById('sitesGrid');

    if (!append) {
        container.innerHTML = '';
    }

    if (sites.length === 0 && !append) {
        container.innerHTML = '<div class="no-results">暂无站点</div>';
        return;
    }

    sites.forEach(site => {
        const card = createSiteCard(site);
        if (card) {
            container.appendChild(card);
        }
    });
}

// 默认图标路径
const DEFAULT_ICON = '/default-icon.png';

// 创建站点卡片（优化图片加载）
function createSiteCard(site) {
    const logo = site.logo || DEFAULT_ICON;

    const card = document.createElement('div');
    card.className = 'site-card glass-effect';
    card.dataset.siteId = site.id;
    card.dataset.tooltip = site.name;
    card.dataset.url = site.url;

    card.innerHTML = `
        <div class="logo-wrapper">
            <div class="logo-placeholder"></div>
            <img class="site-logo lazy" 
                 data-src="${logo}" 
                 alt="${site.name}">
        </div>
        <span class="site-name">${site.name}</span>
    `;

    // 点击跳转
    card.addEventListener('click', () => {
        window.open(site.url, '_blank');
    });

    return card;
}

// Intersection Observer 懒加载
function setupLazyLoad() {
    const images = document.querySelectorAll('img.lazy:not([src])');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => img.classList.add('loaded');
                    img.onerror = () => {
                        // 加载失败时使用默认图标
                        if (img.src !== DEFAULT_ICON) {
                            img.src = DEFAULT_ICON;
                        } else {
                            img.parentElement.classList.add('fallback');
                        }
                    };
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '50px' });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // 降级：直接加载
        images.forEach(img => {
            img.src = img.dataset.src;
            img.onload = () => img.classList.add('loaded');
        });
    }
}

// 无限滚动设置
let scrollObserver = null;

function setupInfiniteScroll() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (!trigger) return;

    // 允许点击加载更多（兜底方案）
    trigger.addEventListener('click', () => {
        if (hasMore && !isLoading) {
            loadMoreSites();
        }
    });

    // 使用 IntersectionObserver
    if ('IntersectionObserver' in window) {
        scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadMoreSites();
            }
        }, {
            root: null, // 使用 viewport
            rootMargin: '300px', // 提前 300px 触发
            threshold: 0
        });

        scrollObserver.observe(trigger);
    }

    // 备用方案：监听滚动事件
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            checkAndLoadMore();
        }, 100);
    }, { passive: true });
}

// 检查并加载更多（备用方案）
function checkAndLoadMore() {
    if (!hasMore || isLoading) return;

    const trigger = document.getElementById('loadMoreTrigger');
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    // 如果 trigger 在视口内或接近视口底部 300px 范围内
    if (rect.top < windowHeight + 300) {
        loadMoreSites();
    }
}

// 更新加载触发器显示状态
function updateLoadMoreTrigger() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.style.display = hasMore ? 'flex' : 'none';

        // 渲染完成后检查是否需要继续加载
        if (hasMore) {
            setTimeout(() => {
                checkAndLoadMore();
            }, 200);
        }
    }
}

// 显示加载指示器
function showLoadingIndicator() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.classList.add('loading');
    }
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.classList.remove('loading');
    }
}

// 搜索引擎功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestions = document.getElementById('searchSuggestions');
    const engineBtns = document.querySelectorAll('.engine-btn');

    let currentEngine = 'google';

    const engines = {
        google: 'https://www.google.com/search?q=',
        bing: 'https://www.bing.com/search?q=',
        github: 'https://github.com/search?q=',
        duckduckgo: 'https://duckduckgo.com/?q='
    };

    // 搜索引擎按钮切换
    engineBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            engineBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentEngine = btn.dataset.engine;
            searchInput.focus();
        });
    });

    // 外部搜索
    function doSearch() {
        const query = searchInput.value.trim();
        if (query) {
            window.open(engines[currentEngine] + encodeURIComponent(query), '_blank');
            hideSuggestions();
        }
    }

    // 显示站内搜索建议
    async function showSuggestions() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
            hideSuggestions();
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/sites?search=${encodeURIComponent(query)}&pageSize=6`);
            const data = await response.json();

            if (data.success) {
                const matches = data.data.slice(0, 6);

                if (matches.length > 0) {
                    suggestions.innerHTML = `
                        <div class="suggestion-header">📌 站内匹配</div>
                        ${matches.map(site => `
                            <a href="${site.url}" target="_blank" class="suggestion-item">
                                <img src="${site.logo || ''}" alt="" onerror="this.style.display='none'">
                                <span class="suggestion-name">${site.name}</span>
                                <span class="suggestion-url">${getDomain(site.url)}</span>
                            </a>
                        `).join('')}
                    `;
                    suggestions.classList.add('active');

                    // 为搜索建议项添加点击后清空搜索框的逻辑
                    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            searchInput.value = '';
                            hideSuggestions();
                        });
                    });
                } else {
                    suggestions.innerHTML = `<div class="suggestion-empty">无匹配站点，按 Enter 搜索</div>`;
                    suggestions.classList.add('active');
                }
            }
        } catch (error) {
            console.error('搜索建议加载失败:', error);
        }
    }

    function hideSuggestions() {
        suggestions.classList.remove('active');
    }

    function getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    // 防抖搜索
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(showSuggestions, 200);
    });

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
        if (e.key === 'Escape') hideSuggestions();
    });

    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-wrapper')) {
            hideSuggestions();
        }
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadBackground();
    loadCategories();
    setupSearch();
    setupInfiniteScroll();
    registerServiceWorker();
    setupKeyboardShortcuts();
    initPwaPrompt();
    setupCopyLinks();
    setupTooltip();
});

// ==================== 自定义 Tooltip ====================
function setupTooltip() {
    // 创建 tooltip 元素
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        padding: 8px 12px;
        background: rgba(30, 41, 59, 0.95);
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        border-radius: 8px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 99999;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        white-space: nowrap;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    document.body.appendChild(tooltip);

    // 监听悬停事件
    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.tooltip) {
            // 检测名称是否被截断
            const nameEl = card.querySelector('.site-name');
            if (nameEl && nameEl.scrollWidth > nameEl.clientWidth) {
                tooltip.textContent = card.dataset.tooltip;
                tooltip.style.opacity = '1';
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.site-card');
        if (card) {
            tooltip.style.opacity = '0';
        }
    });

    // 更新 tooltip 位置
    document.addEventListener('mousemove', (e) => {
        if (tooltip.style.opacity === '1') {
            const x = e.clientX;
            const y = e.clientY - 40;
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
            tooltip.style.transform = 'translateX(-50%)';
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K 或 Cmd+K 聚焦搜索框
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // Esc 键失焦并关闭建议
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput');
            const suggestions = document.getElementById('searchSuggestions');
            if (document.activeElement === searchInput) {
                searchInput.blur();
            }
            if (suggestions) {
                suggestions.classList.remove('active');
            }
        }

        // / 键快速搜索（不在输入框时）
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
}

// ==================== 暗色模式 ====================

function initTheme() {
    const toggle = document.getElementById('themeToggle');
    const isDark = localStorage.getItem('darkMode') === 'true';

    if (isDark) {
        document.documentElement.classList.add('dark-mode');
        toggle.textContent = '☀️';
    }

    toggle.addEventListener('click', () => {
        const isDarkNow = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDarkNow);
        toggle.textContent = isDarkNow ? '☀️' : '🌙';
    });
}

// ==================== Service Worker ====================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    }
}

// ==================== PWA 安装提示 ====================

let deferredPrompt = null;

// 监听 beforeinstallprompt 事件
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // 检查是否已经安装或已关闭过提示
    if (localStorage.getItem('pwaDismissed')) return;

    // 移动端显示安装提示
    if (isMobile()) {
        setTimeout(() => {
            const prompt = document.getElementById('pwaPrompt');
            if (prompt) prompt.style.display = 'flex';
        }, 3000); // 3秒后显示
    }
});

// 检测移动端
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 初始化 PWA 提示
function initPwaPrompt() {
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

// ==================== 复制链接功能 ====================

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyToast();
    } catch (err) {
        // 降级方案
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

// 显示复制成功提示
function showCopyToast() {
    const toast = document.getElementById('copyToast');
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 1500);
    }
}

// 设置站点卡片右键复制
function setupCopyLinks() {
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


// ==================== 编辑模式 ====================

let isEditMode = false;
let draggedCard = null;
let allSitesData = []; // 存储所有站点数据用于排序

// 初始化编辑模式
function initEditMode() {
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
        // 检查是否已解锁，更新按钮状态
        if (sessionStorage.getItem('editModeUnlocked') === 'true') {
            editModeBtn.classList.add('active');
            editModeBtn.querySelector('span:last-child').textContent = '退出编辑';
        }

        editModeBtn.addEventListener('click', () => {
            gearMenu.style.display = 'none'; // 关闭菜单

            if (isEditMode) {
                disableEditMode();
                editModeBtn.classList.remove('active');
                editModeBtn.querySelector('span:last-child').textContent = '编辑排序';
            } else {
                // 检查是否已解锁
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
        confirmBtn.addEventListener('click', verifyEditPassword);
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') verifyEditPassword();
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

// 验证密码
async function verifyEditPassword() {
    const passwordInput = document.getElementById('editPassword');
    const passwordError = document.getElementById('passwordError');
    const passwordModal = document.getElementById('passwordModal');
    const editModeBtn = document.getElementById('editModeBtn');

    try {
        const response = await fetch(`${API_BASE}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passwordInput.value })
        });

        const result = await response.json();

        if (result.success) {
            sessionStorage.setItem('editModeUnlocked', 'true');
            passwordModal.style.display = 'none';
            passwordInput.value = '';
            enableEditMode();
            if (editModeBtn) {
                editModeBtn.classList.add('active');
                editModeBtn.querySelector('span:last-child').textContent = '退出编辑';
            }
        } else {
            passwordError.textContent = result.error || '密码错误';
            passwordInput.select();
        }
    } catch (error) {
        passwordError.textContent = '验证失败，请重试';
    }
}

// 启用编辑模式
function enableEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode');

    // 为所有站点卡片添加拖拽事件
    setupDragAndDrop();
}

// 禁用编辑模式
function disableEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');

    // 移除拖拽事件
    removeDragAndDrop();
}

// 设置拖拽事件
function setupDragAndDrop() {
    const container = document.getElementById('sitesGrid');
    const cards = container.querySelectorAll('.site-card');

    cards.forEach(card => {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);

        // 阻止点击跳转
        card.addEventListener('click', preventClickInEditMode);
    });
}

// 移除拖拽事件
function removeDragAndDrop() {
    const container = document.getElementById('sitesGrid');
    const cards = container.querySelectorAll('.site-card');

    cards.forEach(card => {
        card.removeAttribute('draggable');
        card.removeEventListener('dragstart', handleDragStart);
        card.removeEventListener('dragend', handleDragEnd);
        card.removeEventListener('dragover', handleDragOver);
        card.removeEventListener('dragleave', handleDragLeave);
        card.removeEventListener('drop', handleDrop);
        card.removeEventListener('click', preventClickInEditMode);
    });
}

// 阻止编辑模式下的点击跳转
function preventClickInEditMode(e) {
    if (isEditMode) {
        e.preventDefault();
    }
}

// 拖拽开始
function handleDragStart(e) {
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

// 拖拽结束
function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.site-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedCard = null;
}

// 拖拽经过
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedCard) {
        this.classList.add('drag-over');
    }
    return false;
}

// 拖拽离开
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

// 放下
async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (draggedCard !== this) {
        const container = document.getElementById('sitesGrid');
        const cards = Array.from(container.querySelectorAll('.site-card'));
        const draggedIndex = cards.indexOf(draggedCard);
        const targetIndex = cards.indexOf(this);

        // 交换位置
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedCard, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedCard, this);
        }

        // 保存新顺序
        await saveNewOrder();
    }

    this.classList.remove('drag-over');
    return false;
}

// 保存新顺序到服务器
async function saveNewOrder() {
    const container = document.getElementById('sitesGrid');
    const cards = Array.from(container.querySelectorAll('.site-card'));

    const order = cards.map((card, index) => ({
        id: parseInt(card.dataset.siteId),
        sort_order: index
    })).filter(item => !isNaN(item.id));

    if (order.length === 0) return;

    try {
        const response = await fetch(`${API_BASE}/api/sites/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order })
        });

        const result = await response.json();
        if (!result.success) {
            console.error('排序保存失败:', result.message);
        }
    } catch (error) {
        console.error('排序保存失败:', error);
    }
}

// 在初始化时调用
document.addEventListener('DOMContentLoaded', () => {
    initEditMode();
    initQuickAdd();
});

// ==================== 快速添加功能 ====================

// 存储待执行的回调（验证密码后执行）
let pendingQuickAddAction = null;

function initQuickAdd() {
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

        // 检查是否已验证
        if (sessionStorage.getItem('editModeUnlocked') === 'true') {
            openQuickAddModal();
        } else {
            // 设置回调，验证成功后打开快速添加弹窗
            pendingQuickAddAction = openQuickAddModal;
            passwordModal.style.display = 'flex';
            document.getElementById('editPassword').focus();
            document.getElementById('passwordError').textContent = '';
        }
    });

    // 打开快速添加弹窗
    function openQuickAddModal() {
        quickAddName.value = '';
        quickAddUrl.value = '';
        quickAddLogo.value = '';
        quickAddLogoPreview.innerHTML = '';
        quickAddError.textContent = '';
        // 加载分类选项
        loadQuickAddCategories();
        quickAddModal.style.display = 'flex';
        quickAddName.focus();
    }

    // 加载分类到下拉框
    async function loadQuickAddCategories() {
        try {
            const response = await fetch(`${API_BASE}/api/categories`);
            const data = await response.json();
            if (data.success && data.data) {
                quickAddCategory.innerHTML = '<option value="">选择分类...</option>' +
                    data.data.map(cat => `<option value="${cat.id}">${cat.icon || ''} ${cat.name}</option>`).join('');
                // 默认选中当前分类
                if (currentCategory && currentCategory !== 'all') {
                    quickAddCategory.value = currentCategory;
                }
            }
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    // 关闭快速添加弹窗
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

        // 如果没有logo，自动获取Google Favicon
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
            const response = await fetch(`${API_BASE}/api/sites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    url,
                    logo,
                    category_id: quickAddCategory.value || null,
                    sort_order: 0
                })
            });

            const result = await response.json();

            if (result.success) {
                closeQuickAddModal();
                // 刷新当前分类列表
                loadSites(currentCategory, currentSearchTerm);
                showQuickAddToast('✅ 网站添加成功');
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

// 显示简易Toast提示
function showQuickAddToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-size: 0.9rem;
        z-index: 3000;
        animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeInUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 修改原有的验证密码函数，支持快速添加回调
const originalVerifyEditPassword = verifyEditPassword;
verifyEditPassword = async function () {
    const passwordInput = document.getElementById('editPassword');
    const passwordError = document.getElementById('passwordError');
    const passwordModal = document.getElementById('passwordModal');
    const editModeBtn = document.getElementById('editModeBtn');

    try {
        const response = await fetch(`${API_BASE}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passwordInput.value })
        });

        const result = await response.json();

        if (result.success) {
            sessionStorage.setItem('editModeUnlocked', 'true');
            passwordModal.style.display = 'none';
            passwordInput.value = '';

            // 如果有待执行的快速添加回调
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
};
