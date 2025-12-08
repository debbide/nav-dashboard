import re

# 读取CSS文件
with open('public/css/style.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 替换body部分
new_body = '''body {
  font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
  background-image: linear-gradient(135deg, rgba(224, 195, 252, 0.3) 0%, rgba(142, 197, 252, 0.3) 50%, rgba(184, 240, 245, 0.3) 100%), url('/images/guilin-bg.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  overflow-x: hidden;
}'''

# 使用正则替换
pattern = r'body\s*\{[^}]+\}'
content = re.sub(pattern, new_body, content, count=1)

# 写回文件
with open('public/css/style.css', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content)

print("✅ CSS已成功修改")
