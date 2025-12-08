const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'admin.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 添加背景设置导航按钮
const navPattern = /(<button class="nav-item" data-tab="categories">[\s\S]*?<\/button>)\s*(<\/nav>)/;
const navReplacement = `$1
                    <button class="nav-item" data-tab="background">
                        <span>🖼️</span>
                        <span>背景设置</span>
                    </button>
                $2`;

html = html.replace(navPattern, navReplacement);

// 添加背景设置面板
const panelPattern = /(\s*<\/section>)/;
const backgroundPanel = `
                <!-- 背景设置面板 -->
                <div id="backgroundPanel" class="content-panel">
                    <div class="panel-header">
                        <h2>背景设置</h2>
                    </div>
                    <div class="table-container glass-effect" style="padding: 2rem;">
                        <form id="backgroundForm" style="max-width: 600px;">
                            <div class="form-group">
                                <label for="backgroundUrl">背景图片URL</label>
                                <input type="url" id="backgroundUrl" class="form-input" placeholder="https://example.com/image.jpg">
                            </div>
                            <div class="form-group">
                                <label>预设背景（点击即可应用）</label>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 0.5rem;">
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: white;">
                                        <img src="https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block; border-radius: 6px 6px 0 0;">
                                        <div style="padding: 0.5rem; text-align: center;">海天一色</div>
                                    </button>
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: white;">
                                        <img src="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block; border-radius: 6px 6px 0 0;">
                                        <div style="padding: 0.5rem; text-align: center;">桂林山水</div>
                                    </button>
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; background: white;">
                                        <img src="https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block; border-radius: 6px 6px 0 0;">
                                        <div style="padding: 0.5rem; text-align: center;">大海</div>
                                    </button>
                                </div>
                            </div>
                            <div class="form-actions" style="margin-top: 1.5rem;">
                                <button type="submit" class="btn-primary">💾 保存背景设置</button>
                            </div>
                        </form>
                    </div>
                </div>
$1`;

html = html.replace(panelPattern, backgroundPanel);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ 背景设置UI已成功添加到admin.html');
