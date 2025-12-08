const fs = require('fs');

// 读取main.js
let js = fs.readFileSync('public/js/main.js', 'utf8');

// 完全替换renderCategories和createCategoryTab函数
const oldFunctionsPattern = /\/\/ 渲染分类[\s\S]*?function createCategoryTab[\s\S]*?\n\}\n/;

const newFunctions = `// 渲染分类
function renderCategories(categories) {
    const container = document.getElementById('categoriesList');
    if (!container) return;
    
    container.innerHTML = '';
   
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
}
`;

js = js.replace(oldFunctionsPattern, newFunctions);

fs.writeFileSync('public/js/main.js', js, 'utf8');
console.log('✅ renderCategories和createCategoryTab已修复');

// 验证
const verify = fs.readFileSync('public/js/main.js', 'utf8');
if (verify.includes('categoriesList') && !verify.includes('categoryTabs')) {
    console.log('✅ 验证通过：使用categoriesList');
} else {
    console.log('❌ 验证失败');
}
