const fs = require('fs');

// 读取index.html
let html = fs.readFileSync('public/index.html', 'utf8');

// 创建新的布局结构：左侧边栏+右侧主内容
const newLayout = `    </header>

    <!-- 主布局容器 -->
    <div class="layout-wrapper">
      <!-- 左侧分类侧边栏 -->
      <aside class="sidebar glass-effect">
        <h3 class="sidebar-title">分类</h3>
        <div id="categoriesList" class="categories-sidebar">
          <button class="category-tab active" data-category="all">
            <span>📚</span>
            <span>全部</span>
          </button>
          <!-- 动态加载分类 -->
        </div>
      </aside>

      <!-- 右侧内容区 -->
      <div class="content-wrapper">
        <!-- 站点卡片网格 -->
        <main class="main-content">
          <div id="sitesGrid" class="sites-grid">
            <!-- Loading 状态 -->
            <div class="loading">
              <div class="loading-spinner"></div>
              <p>加载中...</p>
            </div>
          </div>

          <!-- 空状态 -->
          <div id="emptyState" class="empty-state" style="display: none;">
            <div class="empty-icon">📭</div>
            <h3>暂无站点</h3>
            <p>还没有添加任何站点，去后台添加一些吧！</p>
            <a href="/admin.html" class="btn-primary">前往管理后台</a>
          </div>
        </main>
      </div>
    </div>`;

// 替换旧的布局
html = html.replace(/    <\/header>[\s\S]*?<main class="main-content">[\s\S]*?<\/main>/, newLayout);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✅ index.html布局已更新为侧边栏');
