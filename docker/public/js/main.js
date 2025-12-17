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
    const allTab = createCategoryTab('all', '全部', '#a78bfa', categories.length === 0, '📚');
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

// 创建站点卡片（优化图片加载）
function createSiteCard(site) {
    const logo = site.logo || '';

    // 如果没有logo，不创建卡片
    if (!logo) {
        return null;
    }

    const card = document.createElement('a');
    card.href = site.url;
    card.target = '_blank';
    card.className = 'site-card glass-effect';

    card.innerHTML = `
        <div class="logo-wrapper">
            <div class="logo-placeholder"></div>
            <img class="site-logo lazy" 
                 data-src="${logo}" 
                 alt="${site.name}">
        </div>
        <span class="site-name">${site.name}</span>
    `;

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
                    img.onerror = () => img.parentElement.classList.add('fallback');
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
function setupInfiniteScroll() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (!trigger) return;

    if ('IntersectionObserver' in window) {
        const scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                loadMoreSites();
            }
        }, { rootMargin: '200px' });

        scrollObserver.observe(trigger);
    }
}

// 更新加载触发器显示状态
function updateLoadMoreTrigger() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.style.display = hasMore ? 'block' : 'none';
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
