const fs = require('fs');

// 读取CSS
let css = fs.readFileSync('public/css/style.css', 'utf8');

// 在分类标签样式后添加新的侧边栏样式
const sidebarStyles = `

/* ==================== 主布局（侧边栏+内容） ==================== */
.layout-wrapper {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

/* 左侧分类侧边栏 */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  position: sticky;
  top: var(--spacing-md);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid rgba(167, 139, 250, 0.2);
}

.categories-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.categories-sidebar .category-tab {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  background: rgba(255, 255, 255, 0.3);
}

.categories-sidebar .category-tab span:first-child {
  font-size: 1.2rem;
}

.categories-sidebar .category-tab.active {
  background: var(--warm-gradient);
  color: white;
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
}

.categories-sidebar .category-tab:not(.active):hover {
  background: rgba(255, 255, 255, 0.5);
  transform: translateX(4px);
}

/* 右侧内容区 */
.content-wrapper {
  flex: 1;
  min-width: 0;
}

/* 隐藏原来的横向分类容器 */
.categories-container {
  display: none;
}
`;

// 在文件末尾添加侧边栏样式
css += sidebarStyles;

// 添加响应式布局
const responsiveStyles = `

/* 响应式：平板 */
@media (max-width: 900px) {
  .layout-wrapper {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-height: none;
    position: static;
  }
  
  .categories-sidebar {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .categories-sidebar .category-tab {
    flex: 0 0 auto;
  }
}
`;

css += responsiveStyles;

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ style.css已添加侧边栏样式');
