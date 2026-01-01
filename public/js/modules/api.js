/**
 * API 模块 - 封装所有 API 调用
 */

const API_BASE = '';

/**
 * 获取站点列表
 */
export async function fetchSites(categoryId, page, searchTerm = '') {
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

/**
 * 获取分类列表
 */
export async function fetchCategories() {
    const response = await fetch(`${API_BASE}/api/categories`);
    return await response.json();
}

/**
 * 获取背景图设置
 */
export async function fetchBackground() {
    const response = await fetch(`${API_BASE}/api/settings/background`);
    return await response.json();
}

/**
 * 验证密码
 */
export async function verifyPassword(password) {
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    return await response.json();
}

/**
 * 创建站点
 */
export async function createSite(siteData) {
    const response = await fetch(`${API_BASE}/api/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
    });
    return await response.json();
}

/**
 * 保存站点排序
 */
export async function saveSitesOrder(order) {
    const response = await fetch(`${API_BASE}/api/sites/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
    });
    return await response.json();
}

export { API_BASE };
