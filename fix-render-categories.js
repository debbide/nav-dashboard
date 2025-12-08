const fs = require('fs');

// 读取main.js
let js = fs.readFileSync('public/js/main.js', 'utf8');

// 查找并替换renderCategories函数
const oldRenderCategories = /\/\/ 渲染分类\nfunction renderCategories\(categories\) \{[\s\S]*?\n\}/;

const newRenderCategories = `// 渲染分类
function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    
    categories.forEach((category, index) => {
        const tab = document.createElement('button');
        tab.className = \`category-tab\${index === 0 ? ' active' : ''}\`;
        tab.dataset.category = category.id;
        
        tab.innerHTML = \`
            <span>\${category.icon || '📁'}</span>
            <span>\${category.name}</span>
        \`;
        
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadSites(category.id);
        });
        
        container.appendChild(tab);
    });
    
    // 默认加载第一个分类的站点
    if (categories.length > 0) {
        loadSites(categories[0].id);
    }
}`;

js = js.replace(oldRenderCategories, newRenderCategories);

fs.writeFileSync('public/js/main.js', js, 'utf8');
console.log('✅ main.js renderCategories函数已更新');
