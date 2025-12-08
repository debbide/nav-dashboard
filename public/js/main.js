// 使用相对路径 - Workers 同时提供前端和 API
const API_BASE = '';

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

// 加载站点
async function loadSites(categoryId = 'all', searchTerm = '') {
    try {
        let url = `${API_BASE}/api/sites`;
        const params = new URLSearchParams();

        if (categoryId && categoryId !== 'all') {
            params.append('category', categoryId);
        }

        if (searchTerm) {
            params.append('search', searchTerm);
        }

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            renderSites(data.data);
        }
    } catch (error) {
        console.error('加载站点失败:', error);
    }
}

// 渲染分类
function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    // 添加"全部"标签
    const allTab = createCategoryTab('all', '全部', '#a78bfa', true, '📚');
    container.appendChild(allTab);

    // 添加其他分类
    categories.forEach(category => {
        const tab = createCategoryTab(category.id, category.name, category.color, false, category.icon);
        container.appendChild(tab);
    });

    // 默认加载全部站点
    loadSites('all');
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
function renderSites(sites) {
    const container = document.getElementById('sitesGrid');
    container.innerHTML = '';

    if (sites.length === 0) {
        container.innerHTML = '<div class="no-results">暂无站点</div>';
        return;
    }

    sites.forEach(site => {
        const card = createSiteCard(site);
        container.appendChild(card);
    });
}

// 创建站点卡片（简化：只显示logo和名称，居中）
function createSiteCard(site) {
    const card = document.createElement('a');
    card.href = site.url;
    card.target = '_blank';
    card.className = 'site-card glass-effect';

    const logo = site.logo || 'https://via.placeholder.com/64?text=' + encodeURIComponent(site.name.charAt(0));

    card.innerHTML = `
        <img class="site-logo" src="${logo}" alt="${site.name}" onerror="this.src='https://via.placeholder.com/64?text=${encodeURIComponent(site.name.charAt(0))}'">
        <span class="site-name">${site.name}</span>
    `;

    return card;
}

// 搜索引擎功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchEngine = document.getElementById('searchEngine');

    const engines = {
        google: 'https://www.google.com/search?q=',
        bing: 'https://www.bing.com/search?q=',
        github: 'https://github.com/search?q=',
        duckduckgo: 'https://duckduckgo.com/?q='
    };

    function doSearch() {
        const query = searchInput.value.trim();
        if (query) {
            const engine = searchEngine.value;
            window.open(engines[engine] + encodeURIComponent(query), '_blank');
        }
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadBackground();
    loadCategories();
    loadSites();
    setupSearch();
});
