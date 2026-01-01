/**
 * 搜索模块
 */

import { API_BASE } from './api.js';

/**
 * 设置搜索功能
 */
export function setupSearch() {
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

    // 搜索引擎切换
    engineBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            engineBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentEngine = btn.dataset.engine;
            searchInput.focus();
        });
    });

    // 执行搜索
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

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-input-wrapper')) {
            hideSuggestions();
        }
    });
}

/**
 * 设置键盘快捷键
 */
export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+K 聚焦搜索框
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // Esc 失焦
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

        // / 快速搜索
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }
    });
}
