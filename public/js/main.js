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
        <img class="site-logo" src="${logo}" alt="${site.name}" loading="lazy" onerror="this.parentElement.style.display='none'">
        <span class="site-name">${site.name}</span>
    `;

    return card;
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
            const response = await fetch(`${API_BASE}/api/sites`);
            const data = await response.json();

            if (data.success) {
                const matches = data.data.filter(site =>
                    site.name.toLowerCase().includes(query) ||
                    site.url.toLowerCase().includes(query) ||
                    (site.description && site.description.toLowerCase().includes(query))
                ).slice(0, 6);  // 最多显示6个

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
    loadSites();
    setupSearch();
    loadIpInfo();
    registerServiceWorker();
});

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

// ==================== IP Info Card ====================

// 获取时间问候语
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '🌙 夜深了';
    if (hour < 9) return '🌅 早上好';
    if (hour < 12) return '☀️ 上午好';
    if (hour < 14) return '🌞 中午好';
    if (hour < 18) return '🌤️ 下午好';
    if (hour < 22) return '🌆 晚上好';
    return '🌙 夜深了';
}

// 获取访问次数
function getVisitCount() {
    let count = parseInt(localStorage.getItem('visitCount') || '0');
    count++;
    localStorage.setItem('visitCount', count.toString());
    return count;
}

// 获取天气信息
async function loadWeather() {
    try {
        // 使用免费天气API（基于IP定位）
        const response = await fetch('https://wttr.in/?format=j1');
        const data = await response.json();

        const current = data.current_condition[0];
        const temp = current.temp_C;
        const desc = current.lang_zh[0]?.value || current.weatherDesc[0].value;
        const weatherCode = current.weatherCode;

        // 根据天气代码选择图标
        const weatherIcons = {
            '113': '☀️', '116': '⛅', '119': '☁️', '122': '☁️',
            '143': '🌫️', '176': '🌧️', '179': '🌨️', '182': '🌧️',
            '185': '🌧️', '200': '⛈️', '227': '❄️', '230': '❄️',
            '248': '🌫️', '260': '🌫️', '263': '🌧️', '266': '🌧️',
            '281': '🌧️', '284': '🌧️', '293': '🌧️', '296': '🌧️',
            '299': '🌧️', '302': '🌧️', '305': '🌧️', '308': '🌧️',
            '311': '🌧️', '314': '🌧️', '317': '🌨️', '320': '🌨️',
            '323': '🌨️', '326': '🌨️', '329': '❄️', '332': '❄️',
            '335': '❄️', '338': '❄️', '350': '🌧️', '353': '🌧️',
            '356': '🌧️', '359': '🌧️', '362': '🌨️', '365': '🌨️',
            '368': '🌨️', '371': '🌨️', '374': '🌨️', '377': '🌨️',
            '386': '⛈️', '389': '⛈️', '392': '⛈️', '395': '❄️'
        };

        const icon = weatherIcons[weatherCode] || '🌤️';

        document.querySelector('.weather-icon').textContent = icon;
        document.getElementById('weatherTemp').textContent = `${temp}°C`;
        document.getElementById('weatherDesc').textContent = desc;
    } catch (error) {
        document.getElementById('weatherDesc').textContent = '天气获取失败';
    }
}

async function loadIpInfo() {
    try {
        const response = await fetch(`${API_BASE}/api/ip`);
        const data = await response.json();

        if (data.ip) {
            // 设置问候语
            document.getElementById('ipGreeting').textContent = getGreeting();

            // 设置访问次数
            const visitCount = getVisitCount();
            document.getElementById('visitCount').textContent = `第 ${visitCount} 次访问`;

            // 设置IP信息
            document.getElementById('ipAddress').textContent = data.ip;
            document.getElementById('ipLocation').textContent = data.location || '未知位置';

            const card = document.getElementById('ipCard');
            card.style.display = 'block';

            // 延迟显示动画
            setTimeout(() => {
                card.classList.add('show');
            }, 100);

            // 加载天气
            loadWeather();

            // 15秒后自动关闭
            setTimeout(() => {
                closeIpCard();
            }, 15000);
        }
    } catch (error) {
        console.error('加载IP信息失败:', error);
    }
}

function closeIpCard() {
    const card = document.getElementById('ipCard');
    card.classList.remove('show');
    card.style.animation = 'cardSlideIn 0.4s ease reverse';

    setTimeout(() => {
        card.style.display = 'none';
    }, 400);
}

// 暴露给全局以便HTML调用
window.closeIpCard = closeIpCard;
