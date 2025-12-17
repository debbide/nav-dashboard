// API基础路径
const API_BASE = '';  // 空字符串表示相对路径

// 全局状态
let sites = [];
let categories = [];
let currentTab = 'sites';
let editingSiteId = null;
let editingCategoryId = null;
let currentCategoryFilter = 'all';  // 当前分类筛选
let currentSearchTerm = '';  // 当前搜索关键词

// 分页状态
let currentPage = 1;
let pageSize = 50;
let totalSites = 0;
let totalPages = 1;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// 初始化
async function init() {
    // 绑定标签切换
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });

    // 绑定表单提交
    document.getElementById('siteForm').addEventListener('submit', handleSiteSubmit);
    document.getElementById('categoryForm').addEventListener('submit', handleCategorySubmit);

    // 监听 Logo URL 输入变化
    document.getElementById('siteLogo').addEventListener('input', (e) => {
        updateLogoPreview(e.target.value);
    });

    // 动态添加两个"获取Logo"按钮
    const logoInputGroup = document.querySelector('.logo-input-group');
    if (logoInputGroup) {
        const uploadBtn = logoInputGroup.querySelector('.btn-upload');

        // 移除HTML中已存在的静态获取按钮（如果有）
        const existingFetchBtn = logoInputGroup.querySelector('.btn-secondary');
        if (existingFetchBtn) {
            existingFetchBtn.remove();
        }

        // 按钮1: Google Favicon
        const fetchBtn1 = document.createElement('button');
        fetchBtn1.type = 'button';
        fetchBtn1.className = 'btn-secondary';
        fetchBtn1.style.whiteSpace = 'nowrap';
        fetchBtn1.innerHTML = '🔍 获取1';
        fetchBtn1.title = 'Google源';
        fetchBtn1.onclick = autoFetchLogo;
        logoInputGroup.insertBefore(fetchBtn1, uploadBtn);

        // 按钮2: toolb.cn Favicon
        const fetchBtn2 = document.createElement('button');
        fetchBtn2.type = 'button';
        fetchBtn2.className = 'btn-secondary';
        fetchBtn2.style.whiteSpace = 'nowrap';
        fetchBtn2.innerHTML = '🔍 获取2';
        fetchBtn2.title = 'toolb.cn源';
        fetchBtn2.onclick = autoFetchLogo2;
        logoInputGroup.insertBefore(fetchBtn2, uploadBtn);
    }

    // 加载数据
    await loadCategories();
    await loadSites();
}

// 切换标签页
function switchTab(tab) {
    currentTab = tab;

    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tab);
    });

    // 更新面板显示
    document.querySelectorAll('.content-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tab}Panel`);
    });
}

// ==================== 站点管理 ====================

// 加载站点列表
async function loadSites() {
    try {
        // 构建查询参数
        const params = new URLSearchParams({
            page: currentPage,
            pageSize: pageSize
        });

        // 添加分类筛选
        if (currentCategoryFilter !== 'all') {
            params.append('category', currentCategoryFilter);
        }

        // 添加搜索关键词
        if (currentSearchTerm) {
            params.append('search', currentSearchTerm);
        }

        const response = await fetch(`/api/sites?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            sites = result.data;
            // 更新分页信息
            if (result.pagination) {
                totalSites = result.pagination.total;
                totalPages = Math.ceil(totalSites / pageSize) || 1;
            }
            renderSitesTable();
            updatePaginationUI();
        }
    } catch (error) {
        console.error('加载站点失败:', error);
        showNotification('加载站点失败', 'error');
    }
}

// 渲染站点表格
function renderSitesTable() {
    const tbody = document.getElementById('sitesTableBody');

    // 直接使用 API 返回的数据（筛选已在后端完成）
    if (sites.length === 0) {
        let msg = '暂无站点数据';
        if (currentSearchTerm) msg = '未找到匹配的站点';
        else if (currentCategoryFilter !== 'all') msg = '该分类下暂无站点';
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">${msg}</td></tr>`;
        return;
    }

    tbody.innerHTML = sites.map(site => `
    <tr data-id="${site.id}">
      <td class="drag-handle" style="cursor: grab; padding: 0.5rem; color: rgba(255,255,255,0.6); font-size: 1.2rem; text-align: center;">⋮⋮</td>
      <td>
        <img src="${site.logo || getDefaultLogo(site.url)}" 
             alt="${site.name}" 
             class="table-logo"
             loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><text y=%2224%22 font-size=%2224%22>🌐</text></svg>'">
      </td>
      <td>${escapeHtml(site.name)}</td>
      <td><a href="${site.url}" target="_blank" style="color: var(--primary-color)">${getDomain(site.url)}</a></td>
      <td>${site.category_name || '-'}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(site.description || '-')}</td>
      <td>${site.sort_order}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editSite(${site.id})" title="编辑">✏️</button>
          <button class="btn-icon danger" onclick="deleteSite(${site.id})" title="删除">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

    // 初始化拖拽排序
    initSortable();
}

// 初始化拖拽排序
function initSortable() {
    const tbody = document.getElementById('sitesTableBody');
    if (typeof Sortable !== 'undefined' && tbody.children.length > 0 && tbody.children[0].dataset.id) {
        new Sortable(tbody, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const rows = tbody.querySelectorAll('tr[data-id]');
                const newOrder = Array.from(rows).map((row, index) => ({
                    id: parseInt(row.dataset.id),
                    sort_order: index
                }));
                await saveSortOrder(newOrder);
            }
        });
    }
}

// 保存排序顺序
async function saveSortOrder(newOrder) {
    try {
        const response = await fetch('/api/sites/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder })
        });
        const result = await response.json();
        if (result.success) {
            showNotification('排序已保存', 'success');
            await loadSites();
        } else {
            showNotification('保存排序失败', 'error');
        }
    } catch (error) {
        console.error('保存排序失败:', error);
        showNotification('保存排序失败', 'error');
    }
}

// 打开站点模态框（新建）
function openSiteModal() {
    editingSiteId = null;
    document.getElementById('siteModalTitle').textContent = '添加站点';
    document.getElementById('siteForm').reset();
    document.getElementById('siteId').value = '';

    // 填充分类选择器
    populateCategorySelect();

    // 清空预览
    document.getElementById('logoPreview').classList.remove('active');

    document.getElementById('siteModal').classList.add('active');
}

// 编辑站点
function editSite(id) {
    const site = sites.find(s => s.id === id);
    if (!site) return;

    editingSiteId = id;
    document.getElementById('siteModalTitle').textContent = '编辑站点';
    document.getElementById('siteId').value = id;
    document.getElementById('siteName').value = site.name;
    document.getElementById('siteUrl').value = site.url;
    document.getElementById('siteDescription').value = site.description || '';
    document.getElementById('siteCategory').value = site.category_id || '';
    document.getElementById('siteLogo').value = site.logo || '';
    document.getElementById('siteSortOrder').value = site.sort_order;

    // 填充分类选择器
    populateCategorySelect();

    // 更新预览
    updateLogoPreview(site.logo);

    document.getElementById('siteModal').classList.add('active');
}

// 关闭站点模态框
function closeSiteModal() {
    document.getElementById('siteModal').classList.remove('active');
    editingSiteId = null;
}

// 填充分类选择器
function populateCategorySelect() {
    const select = document.getElementById('siteCategory');
    const currentValue = select.value;

    select.innerHTML = '<option value="">无分类</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.icon || ''} ${cat.name}</option>`).join('');

    select.value = currentValue;
}

// 处理站点表单提交
async function handleSiteSubmit(e) {
    e.preventDefault();

    const data = {
        name: document.getElementById('siteName').value,
        url: document.getElementById('siteUrl').value,
        description: document.getElementById('siteDescription').value,
        logo: document.getElementById('siteLogo').value,
        category_id: document.getElementById('siteCategory').value || null,
        sort_order: parseInt(document.getElementById('siteSortOrder').value) || 0
    };

    try {
        const url = editingSiteId ? `/api/sites/${editingSiteId}` : '/api/sites';
        const method = editingSiteId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(editingSiteId ? '站点更新成功' : '站点添加成功', 'success');
            closeSiteModal();
            await loadSites();
        } else {
            showNotification(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('保存站点失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
    }
}

// 删除站点
async function deleteSite(id) {
    if (!confirm('确定要删除这个站点吗？')) return;

    try {
        const response = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showNotification('站点删除成功', 'success');
            await loadSites();
        } else {
            showNotification(result.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除站点失败:', error);
        showNotification('删除失败', 'error');
    }
}

// ==================== 分类管理 ====================

// 加载分类列表
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const result = await response.json();

        if (result.success) {
            categories = result.data;
            renderCategoriesTable();
            populateCategoryFilter();  // 更新筛选器选项
        }
    } catch (error) {
        console.error('加载分类失败:', error);
        showNotification('加载分类失败', 'error');
    }
}

// 填充分类筛选器
function populateCategoryFilter() {
    const select = document.getElementById('siteCategoryFilter');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="all">📁 全部分类</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.icon || '📁'} ${cat.name}</option>`).join('');
    select.value = currentValue;
}

// 渲染分类表格
function renderCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody');

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">暂无分类数据</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map(cat => `
    <tr data-id="${cat.id}">
      <td class="drag-handle" style="cursor: grab; padding: 0.5rem; color: rgba(255,255,255,0.6); font-size: 1.2rem; text-align: center;">⋮⋮</td>
      <td class="table-icon">${cat.icon || '-'}</td>
      <td>${escapeHtml(cat.name)}</td>
      <td>
        <span class="color-badge" style="background-color: ${cat.color}"></span>
        <span style="margin-left: 0.5rem;">${cat.color}</span>
      </td>
      <td>${cat.sites_count || 0}</td>
      <td>${cat.sort_order}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="editCategory(${cat.id})" title="编辑">✏️</button>
          <button class="btn-icon danger" onclick="deleteCategory(${cat.id})" title="删除">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

    // 初始化分类拖拽排序
    initCategorySortable();
}

// 初始化分类拖拽排序
function initCategorySortable() {
    const tbody = document.getElementById('categoriesTableBody');
    if (typeof Sortable !== 'undefined' && tbody.children.length > 0 && tbody.children[0].dataset.id) {
        new Sortable(tbody, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const rows = tbody.querySelectorAll('tr[data-id]');
                const newOrder = Array.from(rows).map((row, index) => ({
                    id: parseInt(row.dataset.id),
                    sort_order: index
                }));
                await saveCategoryOrder(newOrder);
            }
        });
    }
}

// 保存分类排序
async function saveCategoryOrder(newOrder) {
    try {
        const response = await fetch('/api/categories/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder })
        });
        const result = await response.json();
        if (result.success) {
            showNotification('分类排序已保存', 'success');
            await loadCategories();
        } else {
            showNotification('保存排序失败', 'error');
        }
    } catch (error) {
        console.error('保存分类排序失败:', error);
        showNotification('保存排序失败', 'error');
    }
}

// 打开分类模态框（新建）
function openCategoryModal() {
    editingCategoryId = null;
    document.getElementById('categoryModalTitle').textContent = '添加分类';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryColor').value = '#ff9a56';

    document.getElementById('categoryModal').classList.add('active');
}

// 编辑分类
function editCategory(id) {
    const category = categories.find(c => c.id === id);
    if (!category) return;

    editingCategoryId = id;
    document.getElementById('categoryModalTitle').textContent = '编辑分类';
    document.getElementById('categoryId').value = id;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryIcon').value = category.icon || '';
    document.getElementById('categoryColor').value = category.color || '#ff9a56';
    document.getElementById('categorySortOrder').value = category.sort_order;

    document.getElementById('categoryModal').classList.add('active');
}

// 关闭分类模态框
function closeCategoryModal() {
    document.getElementById('categoryModal').classList.remove('active');
    editingCategoryId = null;
}

// 处理分类表单提交
async function handleCategorySubmit(e) {
    e.preventDefault();

    const data = {
        name: document.getElementById('categoryName').value,
        icon: document.getElementById('categoryIcon').value,
        color: document.getElementById('categoryColor').value,
        sort_order: parseInt(document.getElementById('categorySortOrder').value) || 0
    };

    try {
        const url = editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories';
        const method = editingCategoryId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showNotification(editingCategoryId ? '分类更新成功' : '分类添加成功', 'success');
            closeCategoryModal();
            await loadCategories();
            // 重新加载站点以更新分类信息
            await loadSites();
        } else {
            showNotification(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('保存分类失败:', error);
        showNotification('保存失败', 'error');
    }
}

// 删除分类
async function deleteCategory(id) {
    if (!confirm('确定要删除这个分类吗？')) return;

    try {
        const response = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showNotification('分类删除成功', 'success');
            await loadCategories();
            await loadSites();
        } else {
            showNotification(result.message || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除分类失败:', error);
        showNotification('删除失败', 'error');
    }
}

// ==================== 文件上传 ====================

// 处理 Logo 上传
async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            const logoUrl = result.data.url;
            document.getElementById('siteLogo').value = logoUrl;
            updateLogoPreview(logoUrl);
            showNotification('图片上传成功', 'success');
        } else {
            showNotification(result.message || '上传失败', 'error');
        }
    } catch (error) {
        console.error('上传图片失败:', error);
        showNotification('上传失败', 'error');
    }
}

// 更新 Logo 预览
function updateLogoPreview(url) {
    const preview = document.getElementById('logoPreview');

    if (url && url.trim()) {
        preview.innerHTML = `<img src="${url}" alt="Logo Preview" onerror="this.style.display='none'">`;
        preview.classList.add('active');
    } else {
        preview.classList.remove('active');
    }
}

// ==================== 工具函数 ====================

// 获取默认 logo
function getDefaultLogo(url) {
    try {
        const domain = new URL(url).origin;
        return `${domain}/favicon.ico`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><text y=%2224%22 font-size=%2224%22>🌐</text></svg>';
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

// 自动获取网站Logo
function autoFetchLogo() {
    const urlInput = document.getElementById('siteUrl');
    const logoInput = document.getElementById('siteLogo');
    const url = urlInput.value.trim();

    if (!url) {
        showNotification('请先输入站点URL', 'error');
        return;
    }

    try {
        const domain = new URL(url).hostname;
        const googleFavicon = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
        logoInput.value = googleFavicon;
        updateLogoPreview(googleFavicon);
        showNotification('Logo获取成功', 'success');
    } catch {
        showNotification('URL格式无效', 'error');
    }
}

// 使用备选服务获取Logo (toolb.cn)
function autoFetchLogo2() {
    const urlInput = document.getElementById('siteUrl');
    const logoInput = document.getElementById('siteLogo');
    const url = urlInput.value.trim();

    if (!url) {
        showNotification('请先输入站点URL', 'error');
        return;
    }

    try {
        const domain = new URL(url).hostname;
        const toolbFavicon = `https://toolb.cn/favicon/${domain}`;
        logoInput.value = toolbFavicon;
        updateLogoPreview(toolbFavicon);
        showNotification('Logo获取成功 (toolb.cn)', 'success');
    } catch {
        showNotification('URL格式无效', 'error');
    }
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示通知 (Toast)
function showNotification(message, type = 'info') {
    // 获取或创建 toast 容器
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icon} ${message}`;
    container.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// ==================== 背景设置功能 ====================

// 加载当前背景设置
async function loadBackgroundSetting() {
    try {
        const response = await fetch(`${API_BASE}/api/settings/background`);
        const data = await response.json();

        if (data.background_image) {
            document.getElementById('backgroundUrl').value = data.background_image;
        }
    } catch (error) {
        console.error('加载背景设置失败:', error);
    }
}

// 保存背景设置
async function saveBackgroundSetting(url) {
    try {
        const response = await fetch(`${API_BASE}/api/settings/background`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ background_image: url })
        });

        const data = await response.json();

        if (data.background_image) {
            showNotification('背景设置已保存', 'success');
            // 更新首页背景
            if (window.opener) {
                window.opener.location.reload();
            }
        } else {
            showNotification(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存背景设置失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
    }
}

// 初始化背景设置表单
function initBackgroundSettings() {
    const form = document.getElementById('backgroundForm');
    if (!form) return;

    // 加载当前背景
    loadBackgroundSetting();

    // 表单提交
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = document.getElementById('backgroundUrl').value.trim();

        if (!url) {
            showNotification('请输入背景图片URL', 'error');
            return;
        }

        await saveBackgroundSetting(url);
    });

    // 预设背景按钮
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = btn.dataset.url;
            document.getElementById('backgroundUrl').value = url;
            await saveBackgroundSetting(url);
        });

        // 鼠标悬停效果
        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = '#a78bfa';
            btn.style.transform = 'translateY(-2px)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'translateY(0)';
        });
    });
}

// 在切换到背景设置标签时初始化
const originalSwitchTab = window.switchTab || function () { };
window.switchTab = function (tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'background') {
        initBackgroundSettings();
    }
};

// ==================== 分页功能 ====================

// 更新分页 UI
function updatePaginationUI() {
    const paginationTotal = document.getElementById('paginationTotal');
    const currentPageInput = document.getElementById('currentPageInput');
    const totalPagesEl = document.getElementById('totalPages');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageSizeSelect = document.getElementById('pageSizeSelect');

    if (paginationTotal) paginationTotal.textContent = totalSites;
    if (currentPageInput) currentPageInput.value = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (pageSizeSelect) pageSizeSelect.value = pageSize;

    // 更新按钮状态
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// 翻页
function goToPage(direction) {
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
        loadSites();
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
        loadSites();
    }
}

// 跳转到指定页
function goToPageInput() {
    const input = document.getElementById('currentPageInput');
    let page = parseInt(input.value);

    if (isNaN(page) || page < 1) {
        page = 1;
    } else if (page > totalPages) {
        page = totalPages;
    }

    if (page !== currentPage) {
        currentPage = page;
        loadSites();
    } else {
        input.value = currentPage;
    }
}

// 改变每页条数
function changePageSize() {
    const select = document.getElementById('pageSizeSelect');
    const newPageSize = parseInt(select.value);

    if (newPageSize !== pageSize) {
        pageSize = newPageSize;
        currentPage = 1;  // 重置到第一页
        loadSites();
    }
}

// 重写筛选函数，加入分页重置
function filterSitesByCategory() {
    const select = document.getElementById('siteCategoryFilter');
    currentCategoryFilter = select.value;
    currentPage = 1;  // 筛选时重置页码
    loadSites();
}

function filterSitesBySearch() {
    const input = document.getElementById('siteSearchInput');
    currentSearchTerm = input.value.trim();
    currentPage = 1;  // 搜索时重置页码
    loadSites();
}
