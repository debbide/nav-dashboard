const fs = require('fs');

let css = fs.readFileSync('public/css/style.css', 'utf8');

// 添加简化顶栏和侧边栏均匀分布的样式
const newStyles = `

/* ==================== 简化顶栏 ==================== */
.header-simple {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md) 0;
  margin-bottom: var(--spacing-md);
  position: relative;
}

.search-box-center {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.75rem 1.5rem;
  border-radius: 50px;
  max-width: 400px;
  width: 100%;
}

.search-box-center .search-icon {
  font-size: 1.1rem;
}

.search-box-center .search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 1rem;
  flex: 1;
  color: var(--text-primary);
}

.search-box-center .search-input::placeholder {
  color: var(--text-muted);
}

.admin-link {
  position: absolute;
  right: 1rem;
  font-size: 1.5rem;
  text-decoration: none;
  opacity: 0.6;
  transition: var(--transition);
}

.admin-link:hover {
  opacity: 1;
  transform: rotate(90deg);
}

/* 侧边栏均匀分布到底部 */
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 150px);
}

.categories-sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}
`;

// 在文件末尾添加
css += newStyles;

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ 添加了简化顶栏和侧边栏均匀分布样式');
