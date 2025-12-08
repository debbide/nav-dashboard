const fs = require('fs');

// 读取CSS
let css = fs.readFileSync('public/css/style.css', 'utf8');

// 修改container的padding，让内容更靠边
css = css.replace(
    /\.container \{[\s\S]*?padding: var\(--spacing-xl\);/,
    `.container {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-sm);`
);

// 修改layout-wrapper，减小gap让侧边栏靠边
css = css.replace(
    /\.layout-wrapper \{[\s\S]*?gap: var\(--spacing-lg\);/,
    `.layout-wrapper {
  display: flex;
  gap: var(--spacing-md);`
);

// 缩小侧边栏宽度，更紧凑
css = css.replace(
    /\.sidebar \{[\s\S]*?width: 220px;/,
    `.sidebar {
  width: 180px;`
);

// 减小侧边栏padding
css = css.replace(
    /\.sidebar \{[\s\S]*?padding: var\(--spacing-lg\);/,
    `.sidebar {
  width: 180px;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-sm);`
);

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ CSS已调整，侧边栏更靠边');
