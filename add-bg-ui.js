const fs = require('fs');

// 读取admin.html
const htmlPath = 'public/admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 在分类管理按钮后添加背景设置按钮
const navInsert = `                    <button class="nav-item" data-tab="categories">
                        <span>📁</span>
                        <span>分类管理</span>
                    </button>
                    <button class="nav-item" data-tab="background">
                        <span>🖼️</span>
                        <span>背景设置</span>
                    </button>`;

html = html.replace(
    `                    <button class="nav-item" data-tab="categories">
                        <span>📁</span>
                        <span>分类管理</span>
                    </button>`,
    navInsert
);

// 在分类管理面板后添加背景设置面板
const panelInsert = `
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
                                <label>预设背景</label>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 0.5rem;">
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.3s;">
                                        <img src="https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block;">
                                        <div style="padding: 0.5rem; background: rgba(255,255,255,0.9);">海天一色</div>
                                    </button>
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.3s;">
                                        <img src="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block;">
                                        <div style="padding: 0.5rem; background: rgba(255,255,255,0.9);">桂林山水</div>
                                    </button>
                                    <button type="button" class="preset-btn" data-url="https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=2000&auto=format&fit=crop" style="padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.3s;">
                                        <img src="https://images.unsplash.com/photo-1505142468610-359e7d316be0?q=80&w=200&auto=format&fit=crop" style="width: 100%; display: block;">
                                        <div style="padding: 0.5rem; background: rgba(255,255,255,0.9);">大海</div>
                                    </button>
                                </div>
                            </div>

                            <div class="form-actions" style="margin-top: 1.5rem;">
                                <button type="submit" class="btn-primary">💾 保存设置</button>
                            </div>
                        </form>
                    </div>
                </div>
`;

// 在 </section> 前插入
html = html.replace('            </section>', panelInsert + '            </section>');

// 写回文件
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('✅ admin.html已更新');
