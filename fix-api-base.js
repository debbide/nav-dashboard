const fs = require('fs');

const jsPath = 'public/js/admin.js';
let content = fs.readFileSync(jsPath, 'utf8');

// 在文件开头添加API_BASE定义
const apiBaseDef = `// API基础路径
const API_BASE = '';  // 空字符串表示相对路径

`;

content = apiBaseDef + content;

fs.writeFileSync(jsPath, content, 'utf8');
console.log('✅ API_BASE已成功添加到admin.js');
