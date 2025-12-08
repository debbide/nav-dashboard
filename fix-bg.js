const fs = require('fs');

// 读取CSS文件
const cssPath = 'public/css/style.css';
let content = fs.readFileSync(cssPath, 'utf8');

// 使用Unsplash的海天一色图片（蓝色系，天空和海洋融合）
const newBody = `body {
  font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
  background-image: linear-gradient(135deg, rgba(224, 195, 252, 0.15) 0%, rgba(142, 197, 252, 0.15) 50%, rgba(184, 240, 245, 0.15) 100%), url('https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  overflow-x: hidden;
}`;

// 替换body部分
const bodyRegex = /body\s*\{[^}]*\}/s;
content = content.replace(bodyRegex, newBody);

// 写回文件
fs.writeFileSync(cssPath, content, 'utf8');

console.log('✅ CSS修改完成 - 海天一色背景');

// 验证
const verify = fs.readFileSync(cssPath, 'utf8');
const bodyMatch = verify.match(/body\s*\{[^}]*\}/s);
console.log('\n验证修改后的body部分：');
console.log(bodyMatch[0]);
