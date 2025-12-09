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

    // 默认选中第一个分类（常用工具）
    const defaultCategoryId = categories.length > 0 ? categories[0].id : 'all';

    // 先添加其他分类（第一个默认激活）
    categories.forEach((category, index) => {
        const isActive = index === 0;
        const tab = createCategoryTab(category.id, category.name, category.color, isActive, category.icon);
        container.appendChild(tab);
    });

    // 最后添加"全部"标签（放在底部，不激活）
    const allTab = createCategoryTab('all', '全部', '#a78bfa', categories.length === 0, '📚');
    container.appendChild(allTab);

    // 默认加载第一个分类的站点
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

// 创建站点卡片（简化：只显示logo和名称）
function createSiteCard(site) {
    const card = document.createElement('a');
    card.href = site.url;
    card.target = '_blank';
    card.className = 'site-card glass-effect';

    const logo = site.logo || '';

    // 如果没有logo，不创建卡片
    if (!logo) {
        card.style.display = 'none';
        return card;
    }

    card.innerHTML = `
        <img class="site-logo" src="${logo}" alt="${site.name}" onerror="this.parentElement.style.display='none'">
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
    loadIpInfo();
});

// ==================== IP Info Card ====================

async function loadIpInfo() {
    try {
        const response = await fetch(`${API_BASE}/api/ip`);
        const data = await response.json();

        if (data.ip) {
            document.getElementById('ipAddress').textContent = data.ip;
            document.getElementById('ipLocation').textContent = data.location;
            document.getElementById('ipIsp').textContent = data.isp;

            const card = document.getElementById('ipCard');
            card.style.display = 'block';

            // 延迟显示动画
            setTimeout(() => {
                card.classList.add('show');
            }, 100);

            // 10秒后自动关闭
            setTimeout(() => {
                closeIpCard();
            }, 10000);
        }
    } catch (error) {
        console.error('加载IP信息失败:', error);
    }
}

function closeIpCard() {
    const card = document.getElementById('ipCard');
    card.classList.remove('show');

    // 等待动画结束后隐藏
    setTimeout(() => {
        card.style.display = 'none';
    }, 500);
}

// 暴露给全局以便HTML调用
window.closeIpCard = closeIpCard;
