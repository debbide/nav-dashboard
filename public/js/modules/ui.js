/**
 * UI 模块 - DOM 操作和渲染
 */

import { fetchSites, fetchCategories, fetchBackground } from './api.js';
import { setupLazyLoad, updateLoadMoreTrigger } from './lazyload.js';

// 分页状态
export let currentPage = 1;
export let isLoading = false;
export let hasMore = true;
export let currentCategory = 'all';
export let currentSearchTerm = '';

// 默认图标路径
export const DEFAULT_ICON = '/default-icon.png';

/**
 * 更新分页状态
 */
export function updatePaginationState(state) {
    if (state.currentPage !== undefined) currentPage = state.currentPage;
    if (state.isLoading !== undefined) isLoading = state.isLoading;
    if (state.hasMore !== undefined) hasMore = state.hasMore;
    if (state.currentCategory !== undefined) currentCategory = state.currentCategory;
    if (state.currentSearchTerm !== undefined) currentSearchTerm = state.currentSearchTerm;
}

/**
 * 加载背景图
 */
export async function loadBackground() {
    try {
        const data = await fetchBackground();

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

/**
 * 显示骨架屏
 */
export function showSkeletons(count = null) {
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

/**
 * 隐藏骨架屏
 */
export function hideSkeletons() {
    const skeletons = document.querySelectorAll('.skeleton-card');
    skeletons.forEach((skeleton, index) => {
        setTimeout(() => {
            skeleton.classList.add('fade-out');
        }, index * 30);
    });
}

/**
 * 创建站点卡片
 */
export function createSiteCard(site) {
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

/**
 * 渲染站点列表
 */
export function renderSites(sites, append = false) {
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

/**
 * 追加站点到网格
 */
export function appendSites(sites) {
    const container = document.getElementById('sitesGrid');

    sites.forEach(site => {
        const card = createSiteCard(site);
        if (card) {
            card.classList.add('site-card-enter');
            container.appendChild(card);
            requestAnimationFrame(() => {
                card.classList.add('site-card-enter-active');
            });
        }
    });
}

/**
 * 创建分类标签
 */
export function createCategoryTab(id, name, color, active = false, icon = '') {
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

/**
 * 渲染分类列表
 */
export function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    const defaultCategoryId = categories.length > 0 ? categories[0].id : 'all';

    categories.forEach((category, index) => {
        const isActive = index === 0;
        const tab = createCategoryTab(category.id, category.name, category.color, isActive, category.icon);
        container.appendChild(tab);
    });

    // 添加"全部"标签
    const allTab = createCategoryTab('all', '全部', '#a78bfa', categories.length === 0, '🔯');
    container.appendChild(allTab);

    // 默认加载第一个分类的站点
    updatePaginationState({ currentCategory: defaultCategoryId });
    loadSites(defaultCategoryId);
}

/**
 * 加载分类
 */
export async function loadCategories() {
    try {
        const data = await fetchCategories();

        if (data.success) {
            renderCategories(data.data);
        }
    } catch (error) {
        console.error('加载分类失败:', error);
    }
}

/**
 * 加载站点（首次加载）
 */
export async function loadSites(categoryId = 'all', searchTerm = '') {
    // 重置分页状态
    updatePaginationState({
        currentPage: 1,
        hasMore: true,
        currentCategory: categoryId,
        currentSearchTerm: searchTerm
    });

    // 显示骨架屏
    showSkeletons();

    try {
        const data = await fetchSites(categoryId, 1, searchTerm);

        if (data.success) {
            localStorage.setItem('lastSiteCount', data.data.length.toString());

            hideSkeletons();
            setTimeout(() => {
                renderSites(data.data, false);
                setupLazyLoad();

                if (data.pagination) {
                    updatePaginationState({ hasMore: data.pagination.hasMore });
                    updateLoadMoreTrigger();
                }
            }, 150);
        }
    } catch (error) {
        console.error('加载站点失败:', error);
        document.getElementById('sitesGrid').innerHTML = '<div class="no-results">加载失败，请刷新重试</div>';
    }
}

/**
 * 加载更多站点
 */
export async function loadMoreSites() {
    if (isLoading || !hasMore) return;

    updatePaginationState({ isLoading: true });
    showLoadingIndicator();

    try {
        const nextPage = currentPage + 1;
        const data = await fetchSites(currentCategory, nextPage, currentSearchTerm);

        if (data.success && data.data.length > 0) {
            updatePaginationState({ currentPage: nextPage });
            appendSites(data.data);
            setupLazyLoad();

            if (data.pagination) {
                updatePaginationState({ hasMore: data.pagination.hasMore });
            }
        } else {
            updatePaginationState({ hasMore: false });
        }
    } catch (error) {
        console.error('加载更多失败:', error);
    }

    updatePaginationState({ isLoading: false });
    hideLoadingIndicator();
    updateLoadMoreTrigger();
}

/**
 * 显示加载指示器
 */
export function showLoadingIndicator() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.classList.add('loading');
    }
}

/**
 * 隐藏加载指示器
 */
export function hideLoadingIndicator() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        trigger.classList.remove('loading');
    }
}

/**
 * 初始化主题
 */
export function initTheme() {
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

/**
 * 设置自定义 Tooltip
 */
export function setupTooltip() {
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

    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.tooltip) {
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

/**
 * 显示简易 Toast 提示
 */
export function showToast(message) {
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
