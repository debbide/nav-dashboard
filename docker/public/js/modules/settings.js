/**
 * 设置模块 - 主题和布局配置
 */

import { API_BASE } from './api.js';

// 默认配置
const DEFAULT_THEME = {
    primaryColor: '#a78bfa',
    accentColor: '#e879f9',
    cardStyle: 'glass',
    cardRadius: 12,
    darkMode: false
};

const DEFAULT_LAYOUT = {
    viewMode: 'grid',
    columns: 6,
    cardSize: 'medium',
    showDescription: false,
    showCategory: false
};

// 当前配置
let currentTheme = { ...DEFAULT_THEME };
let currentLayout = { ...DEFAULT_LAYOUT };

/**
 * 获取前端设置
 */
export async function fetchFrontendSettings() {
    try {
        const response = await fetch(`${API_BASE}/api/settings/frontend`);
        const data = await response.json();
        if (data.success) {
            currentTheme = { ...DEFAULT_THEME, ...data.data.theme };
            currentLayout = { ...DEFAULT_LAYOUT, ...data.data.layout };
            return data.data;
        }
    } catch (error) {
        console.error('获取设置失败:', error);
    }
    return { theme: currentTheme, layout: currentLayout };
}

/**
 * 保存主题设置
 */
export async function saveTheme(theme) {
    try {
        const response = await fetch(`${API_BASE}/api/settings/theme`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(theme)
        });
        const data = await response.json();
        if (data.success) {
            currentTheme = data.data;
            applyTheme(currentTheme);
        }
        return data;
    } catch (error) {
        console.error('保存主题失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 保存布局设置
 */
export async function saveLayout(layout) {
    try {
        const response = await fetch(`${API_BASE}/api/settings/layout`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layout)
        });
        const data = await response.json();
        if (data.success) {
            currentLayout = data.data;
            applyLayout(currentLayout);
        }
        return data;
    } catch (error) {
        console.error('保存布局失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 应用主题到页面
 */
export function applyTheme(theme) {
    const root = document.documentElement;

    // 应用主题色
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);

    // 生成渐变
    root.style.setProperty('--warm-gradient', `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%)`);

    // 卡片圆角
    root.style.setProperty('--radius-md', `${theme.cardRadius}px`);

    // 卡片样式
    document.body.classList.remove('card-glass', 'card-solid', 'card-minimal');
    document.body.classList.add(`card-${theme.cardStyle}`);

    // 深色模式
    if (theme.darkMode) {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }
}

/**
 * 应用布局到页面
 */
export function applyLayout(layout) {
    const grid = document.getElementById('sitesGrid');
    if (!grid) return;

    // 移除所有布局类
    grid.classList.remove('view-grid', 'view-list', 'view-compact');
    grid.classList.remove('size-small', 'size-medium', 'size-large');

    // 添加当前布局类
    grid.classList.add(`view-${layout.viewMode}`);
    grid.classList.add(`size-${layout.cardSize}`);

    // 设置列数（仅网格模式）
    if (layout.viewMode === 'grid') {
        document.documentElement.style.setProperty('--grid-columns', layout.columns);
    }

    // 显示/隐藏描述和分类
    document.body.classList.toggle('show-description', layout.showDescription);
    document.body.classList.toggle('show-category', layout.showCategory);
}

/**
 * 初始化设置
 */
export async function initSettings() {
    const settings = await fetchFrontendSettings();
    applyTheme(settings.theme);
    applyLayout(settings.layout);
    return settings;
}

/**
 * 创建设置面板
 */
export function createSettingsPanel() {
    // 检查是否已存在
    if (document.getElementById('settingsPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.style.display = 'none';

    panel.innerHTML = `
        <div class="settings-panel-content glass-effect">
            <div class="settings-header">
                <h3>⚙️ 显示设置</h3>
                <button id="settingsCloseBtn" class="settings-close">×</button>
            </div>

            <div class="settings-body">
                <!-- 布局设置 -->
                <div class="settings-section">
                    <h4>📐 布局</h4>
                    <div class="settings-row">
                        <label>视图模式</label>
                        <div class="settings-btn-group" id="viewModeGroup">
                            <button data-value="grid" class="active">网格</button>
                            <button data-value="list">列表</button>
                            <button data-value="compact">紧凑</button>
                        </div>
                    </div>
                    <div class="settings-row">
                        <label>卡片尺寸</label>
                        <div class="settings-btn-group" id="cardSizeGroup">
                            <button data-value="small">小</button>
                            <button data-value="medium" class="active">中</button>
                            <button data-value="large">大</button>
                        </div>
                    </div>
                    <div class="settings-row" id="columnsRow">
                        <label>列数 <span id="columnsValue">6</span></label>
                        <input type="range" id="columnsSlider" min="4" max="8" value="6">
                    </div>
                </div>

                <!-- 主题设置 -->
                <div class="settings-section">
                    <h4>🎨 主题</h4>
                    <div class="settings-row">
                        <label>主题色</label>
                        <div class="color-picker-group">
                            <input type="color" id="primaryColorPicker" value="#a78bfa">
                            <div class="preset-colors" id="presetColors">
                                <button data-color="#a78bfa" style="background:#a78bfa" title="紫色"></button>
                                <button data-color="#60a5fa" style="background:#60a5fa" title="蓝色"></button>
                                <button data-color="#34d399" style="background:#34d399" title="绿色"></button>
                                <button data-color="#fbbf24" style="background:#fbbf24" title="黄色"></button>
                                <button data-color="#f472b6" style="background:#f472b6" title="粉色"></button>
                                <button data-color="#fb7185" style="background:#fb7185" title="红色"></button>
                            </div>
                        </div>
                    </div>
                    <div class="settings-row">
                        <label>卡片样式</label>
                        <div class="settings-btn-group" id="cardStyleGroup">
                            <button data-value="glass" class="active">磨砂</button>
                            <button data-value="solid">实色</button>
                            <button data-value="minimal">极简</button>
                        </div>
                    </div>
                    <div class="settings-row">
                        <label>圆角 <span id="radiusValue">12</span>px</label>
                        <input type="range" id="radiusSlider" min="0" max="24" value="12">
                    </div>
                </div>
            </div>

            <div class="settings-footer">
                <button id="settingsResetBtn" class="btn-secondary">重置默认</button>
                <button id="settingsSaveBtn" class="btn-primary">保存设置</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // 绑定事件
    bindSettingsEvents(panel);
}

/**
 * 绑定设置面板事件
 */
function bindSettingsEvents(panel) {
    const closeBtn = panel.querySelector('#settingsCloseBtn');
    const saveBtn = panel.querySelector('#settingsSaveBtn');
    const resetBtn = panel.querySelector('#settingsResetBtn');

    // 关闭面板
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });

    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            panel.style.display = 'none';
        }
    });

    // 视图模式
    const viewModeGroup = panel.querySelector('#viewModeGroup');
    viewModeGroup.addEventListener('click', (e) => {
        if (e.target.dataset.value) {
            viewModeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // 实时预览
            const columnsRow = panel.querySelector('#columnsRow');
            columnsRow.style.display = e.target.dataset.value === 'grid' ? 'flex' : 'none';

            applyLayout({ ...currentLayout, viewMode: e.target.dataset.value });
        }
    });

    // 卡片尺寸
    const cardSizeGroup = panel.querySelector('#cardSizeGroup');
    cardSizeGroup.addEventListener('click', (e) => {
        if (e.target.dataset.value) {
            cardSizeGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyLayout({ ...currentLayout, cardSize: e.target.dataset.value });
        }
    });

    // 列数滑块
    const columnsSlider = panel.querySelector('#columnsSlider');
    const columnsValue = panel.querySelector('#columnsValue');
    columnsSlider.addEventListener('input', (e) => {
        columnsValue.textContent = e.target.value;
        applyLayout({ ...currentLayout, columns: parseInt(e.target.value) });
    });

    // 主题色选择器
    const primaryColorPicker = panel.querySelector('#primaryColorPicker');
    primaryColorPicker.addEventListener('input', (e) => {
        applyTheme({ ...currentTheme, primaryColor: e.target.value });
    });

    // 预设颜色
    const presetColors = panel.querySelector('#presetColors');
    presetColors.addEventListener('click', (e) => {
        if (e.target.dataset.color) {
            primaryColorPicker.value = e.target.dataset.color;
            applyTheme({ ...currentTheme, primaryColor: e.target.dataset.color });
        }
    });

    // 卡片样式
    const cardStyleGroup = panel.querySelector('#cardStyleGroup');
    cardStyleGroup.addEventListener('click', (e) => {
        if (e.target.dataset.value) {
            cardStyleGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyTheme({ ...currentTheme, cardStyle: e.target.dataset.value });
        }
    });

    // 圆角滑块
    const radiusSlider = panel.querySelector('#radiusSlider');
    const radiusValue = panel.querySelector('#radiusValue');
    radiusSlider.addEventListener('input', (e) => {
        radiusValue.textContent = e.target.value;
        applyTheme({ ...currentTheme, cardRadius: parseInt(e.target.value) });
    });

    // 保存设置
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        // 收集当前设置
        const theme = {
            primaryColor: primaryColorPicker.value,
            cardStyle: cardStyleGroup.querySelector('.active').dataset.value,
            cardRadius: parseInt(radiusSlider.value)
        };

        const layout = {
            viewMode: viewModeGroup.querySelector('.active').dataset.value,
            cardSize: cardSizeGroup.querySelector('.active').dataset.value,
            columns: parseInt(columnsSlider.value)
        };

        await Promise.all([
            saveTheme(theme),
            saveLayout(layout)
        ]);

        saveBtn.disabled = false;
        saveBtn.textContent = '保存设置';
        panel.style.display = 'none';

        // 显示提示
        showToast('✅ 设置已保存');
    });

    // 重置默认
    resetBtn.addEventListener('click', async () => {
        applyTheme(DEFAULT_THEME);
        applyLayout(DEFAULT_LAYOUT);

        // 更新UI
        updateSettingsUI(panel, DEFAULT_THEME, DEFAULT_LAYOUT);

        await Promise.all([
            saveTheme(DEFAULT_THEME),
            saveLayout(DEFAULT_LAYOUT)
        ]);

        showToast('✅ 已重置为默认设置');
    });
}

/**
 * 更新设置面板UI
 */
function updateSettingsUI(panel, theme, layout) {
    // 视图模式
    const viewModeGroup = panel.querySelector('#viewModeGroup');
    viewModeGroup.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.value === layout.viewMode);
    });

    // 卡片尺寸
    const cardSizeGroup = panel.querySelector('#cardSizeGroup');
    cardSizeGroup.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.value === layout.cardSize);
    });

    // 列数
    const columnsSlider = panel.querySelector('#columnsSlider');
    const columnsValue = panel.querySelector('#columnsValue');
    columnsSlider.value = layout.columns;
    columnsValue.textContent = layout.columns;

    // 主题色
    const primaryColorPicker = panel.querySelector('#primaryColorPicker');
    primaryColorPicker.value = theme.primaryColor;

    // 卡片样式
    const cardStyleGroup = panel.querySelector('#cardStyleGroup');
    cardStyleGroup.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.value === theme.cardStyle);
    });

    // 圆角
    const radiusSlider = panel.querySelector('#radiusSlider');
    const radiusValue = panel.querySelector('#radiusValue');
    radiusSlider.value = theme.cardRadius;
    radiusValue.textContent = theme.cardRadius;

    // 列数行显示/隐藏
    const columnsRow = panel.querySelector('#columnsRow');
    columnsRow.style.display = layout.viewMode === 'grid' ? 'flex' : 'none';
}

/**
 * 打开设置面板
 */
export function openSettingsPanel() {
    const panel = document.getElementById('settingsPanel');
    if (!panel) {
        createSettingsPanel();
        openSettingsPanel();
        return;
    }

    // 更新面板状态
    updateSettingsUI(panel, currentTheme, currentLayout);
    panel.style.display = 'flex';
}

/**
 * 显示 Toast 提示
 */
function showToast(message) {
    const existing = document.querySelector('.settings-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'settings-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * 获取当前主题
 */
export function getCurrentTheme() {
    return { ...currentTheme };
}

/**
 * 获取当前布局
 */
export function getCurrentLayout() {
    return { ...currentLayout };
}
