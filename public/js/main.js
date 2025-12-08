// 全局状态
let allSites = [];
let allCategories = [];
let currentCategory = 'all';

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// 初始化函数
async function init() {
    await Promise.all([
        loadCategories(),
        loadSites()
    ]);

    // 绑定事件监听器
    bindEventListeners();
}

// 绑定事件监听器
function bindEventListeners() {
    // 搜索框
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch(e.target.value);
        }, 300);
    });
}

// 加载分类
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const result = await response.json();

        if (result.success) {
            allCategories = result.data;
            renderCategories();
        }
    } catch (error) {
        console.error('加载分类失败:', error);
    }
}

// 渲染分类标签
function renderCategories() {
    const categoriesList = document.getElementById('categoriesList');

    // 保留"全部"按钮
    const allButton = categoriesList.querySelector('[data-category="all"]');
    categoriesList.innerHTML = '';
    categoriesList.appendChild(allButton);

    // 渲染分类按钮
    allCategories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-tab glass-effect';
        button.dataset.category = category.id;
        button.textContent = `${category.icon || ''} ${category.name}`;

        if (category.color) {
            button.style.setProperty('--category-color', category.color);
        }

        button.addEventListener('click', () => {
            handleCategoryChange(category.id);
        });

        categoriesList.appendChild(button);
    });
}

// 处理分类切换
function handleCategoryChange(categoryId) {
    currentCategory = categoryId;

    // 更新按钮状态
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const activeTab = document.querySelector(`[data-category="${categoryId}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // 过滤并渲染站点
    filterAndRenderSites();
}

// 加载站点
async function loadSites() {
    try {
        const sitesGrid = document.getElementById('sitesGrid');
        sitesGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>加载中...</p></div>';

        const response = await fetch('/api/sites');
        const result = await response.json();

        if (result.success) {
            allSites = result.data;
            filterAndRenderSites();
        }
    } catch (error) {
        console.error('加载站点失败:', error);
        showError('加载站点失败，请刷新页面重试');
    }
}

// 过滤并渲染站点
function filterAndRenderSites(searchTerm = '') {
    let filteredSites = allSites;

    // 按分类过滤
    if (currentCategory !== 'all') {
        filteredSites = filteredSites.filter(site =>
            site.category_id === parseInt(currentCategory)
        );
    }

    // 按搜索词过滤
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredSites = filteredSites.filter(site =>
            site.name.toLowerCase().includes(term) ||
            (site.description && site.description.toLowerCase().includes(term)) ||
            site.url.toLowerCase().includes(term)
        );
    }

    renderSites(filteredSites);
}

// 渲染站点卡片
function renderSites(sites) {
    const sitesGrid = document.getElementById('sitesGrid');
    const emptyState = document.getElementById('emptyState');

    if (sites.length === 0) {
        sitesGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    sitesGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    sitesGrid.innerHTML = '';

    sites.forEach(site => {
        const card = createSiteCard(site);
        sitesGrid.appendChild(card);
    });
}

// 创建站点卡片
function createSiteCard(site) {
    const card = document.createElement('a');
    card.className = 'site-card glass-effect';
    card.href = site.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    // 获取默认 logo
    const logo = site.logo || getDefaultLogo(site.url);

    card.innerHTML = `
    <div class="site-card-header">
      <img src="${logo}" alt="${site.name}" class="site-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><text y=%2232%22 font-size=%2232%22>🌐</text></svg>'">
      <div class="site-info">
        <div class="site-name">${escapeHtml(site.name)}</div>
        <div class="site-url">${getDomain(site.url)}</div>
      </div>
    </div>
    ${site.description ? `<div class="site-description">${escapeHtml(site.description)}</div>` : ''}
    ${site.category_name ? `<span class="site-category" style="background-color: ${site.category_color || '#ff9a56'}33">${site.category_name}</span>` : ''}
  `;

    return card;
}

// 获取默认 logo（使用 favicon）
function getDefaultLogo(url) {
    try {
        const domain = new URL(url).origin;
        return `${domain}/favicon.ico`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22><text y=%2232%22 font-size=%2232%22>🌐</text></svg>';
    }
}

// 获取域名
function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

// 处理搜索
async function handleSearch(searchTerm) {
    if (searchTerm.trim()) {
        // 使用 API 搜索
        try {
            const response = await fetch(`/api/sites?search=${encodeURIComponent(searchTerm)}`);
            const result = await response.json();

            if (result.success) {
                renderSites(result.data);
            }
        } catch (error) {
            console.error('搜索失败:', error);
        }
    } else {
        // 清空搜索，重新加载
        filterAndRenderSites();
    }
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示错误
function showError(message) {
    const sitesGrid = document.getElementById('sitesGrid');
    sitesGrid.innerHTML = `
    <div class="loading">
      <div style="font-size: 3rem;">⚠️</div>
      <p>${message}</p>
    </div>
  `;
}
