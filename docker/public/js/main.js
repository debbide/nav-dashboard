/**
 * NavDashboard 前端入口
 * 重构后的精简版本 - 所有功能已模块化
 */

// 导入模块
import { initTheme, loadBackground, loadCategories, setupTooltip } from './modules/ui.js';
import { setupSearch, setupKeyboardShortcuts } from './modules/search.js';
import { setupInfiniteScroll } from './modules/lazyload.js';
import { registerServiceWorker, initPwaPrompt, setupCopyLinks } from './modules/pwa.js';
import { initEditMode, initQuickAdd } from './modules/quickAdd.js';

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 主题
    initTheme();

    // UI
    loadBackground();
    loadCategories();
    setupTooltip();

    // 搜索
    setupSearch();
    setupKeyboardShortcuts();

    // 无限滚动
    setupInfiniteScroll();

    // PWA
    registerServiceWorker();
    initPwaPrompt();
    setupCopyLinks();

    // 编辑模式和快速添加
    initEditMode();
    initQuickAdd();
});
