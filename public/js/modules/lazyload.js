/**
 * 懒加载和无限滚动模块
 */

import { loadMoreSites, hasMore, isLoading } from './ui.js';

const DEFAULT_ICON = '/default-icon.png';

/**
 * 设置图片懒加载
 */
export function setupLazyLoad() {
    const images = document.querySelectorAll('img.lazy:not([src])');

    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => img.classList.add('loaded');
                    img.onerror = () => {
                        if (img.src !== DEFAULT_ICON) {
                            img.src = DEFAULT_ICON;
                        } else {
                            img.parentElement.classList.add('fallback');
                        }
                    };
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '50px' });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // 降级：直接加载
        images.forEach(img => {
            img.src = img.dataset.src;
            img.onload = () => img.classList.add('loaded');
        });
    }
}

/**
 * 更新加载触发器显示状态
 */
export function updateLoadMoreTrigger() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        // 动态导入获取最新状态
        import('./ui.js').then(ui => {
            trigger.style.display = ui.hasMore ? 'flex' : 'none';

            if (ui.hasMore) {
                setTimeout(() => {
                    checkAndLoadMore();
                }, 200);
            }
        });
    }
}

/**
 * 检查并加载更多（备用方案）
 */
export function checkAndLoadMore() {
    import('./ui.js').then(ui => {
        if (!ui.hasMore || ui.isLoading) return;

        const trigger = document.getElementById('loadMoreTrigger');
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.top < windowHeight + 300) {
            ui.loadMoreSites();
        }
    });
}

/**
 * 设置无限滚动
 */
export function setupInfiniteScroll() {
    const trigger = document.getElementById('loadMoreTrigger');
    if (!trigger) return;

    // 点击加载更多
    trigger.addEventListener('click', () => {
        import('./ui.js').then(ui => {
            if (ui.hasMore && !ui.isLoading) {
                ui.loadMoreSites();
            }
        });
    });

    // IntersectionObserver
    if ('IntersectionObserver' in window) {
        const scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                import('./ui.js').then(ui => {
                    if (ui.hasMore && !ui.isLoading) {
                        ui.loadMoreSites();
                    }
                });
            }
        }, {
            root: null,
            rootMargin: '300px',
            threshold: 0
        });

        scrollObserver.observe(trigger);
    }

    // 备用滚动监听
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            checkAndLoadMore();
        }, 100);
    }, { passive: true });
}
