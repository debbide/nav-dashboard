const fs = require('fs');

// 读取CSS
let css = fs.readFileSync('public/css/style.css', 'utf8');

// 在.main-content后添加sites-grid的5列布局
const sitesGridStyle = `
.sites-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.65rem;
  width: 100%;
}

.site-card {
  border-radius: var(--radius-lg);
  padding: 0.75rem;
  cursor: pointer;
  text-decoration: none;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: var(--transition);
  height: 60px;
  overflow: hidden;
}

.site-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(167, 139, 250, 0.3);
}

.site-logo {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  object-fit: cover;
  flex-shrink: 0;
}

.site-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.site-name {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-category {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
  margin-top: 0.2rem;
}
`;

// 查找.main-content的位置并在其后插入
const mainContentPattern = /\.main-content \{[^}]*\}/;
css = css.replace(mainContentPattern, (match) => {
    return match + '\n' + sitesGridStyle;
});

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ 已添加5列grid布局和横向卡片样式');
