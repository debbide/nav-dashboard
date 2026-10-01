/**
 * 前台快捷操作模块
 * 右键 / 长按站点卡片弹出菜单：复制链接、删除站点
 * 删除需管理密码验证（复用 /api/auth/verify，服务端 Set-Cookie 鉴权；
 * sessionStorage 标记与编辑模式共用，同一标签页内验证一次即可）
 */
import { verifyPassword, deleteSite } from './api.js';
import { copyToClipboard, showToast } from './pwa.js';

const UNLOCK_KEY = 'editModeUnlocked';

let menuEl = null;
let pendingCard = null;
let pendingDelete = null;
let suppressClick = false;

/**
 * 创建右键菜单 DOM（单例）
 */
function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.id = 'cardMenu';
    menuEl.className = 'card-menu glass-effect';
    menuEl.style.display = 'none';
    menuEl.innerHTML = `
        <button type="button" class="card-menu-item" data-action="copy">📋 复制链接</button>
        <button type="button" class="card-menu-item card-menu-danger" data-action="delete">🗑️ 删除站点</button>
    `;
    menuEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.card-menu-item');
        if (!btn) return;
        const card = pendingCard;
        hideMenu();
        if (!card) return;
        if (btn.dataset.action === 'copy') {
            copyToClipboard(card.dataset.url);
        } else if (btn.dataset.action === 'delete') {
            openDeleteModal(card);
        }
    });
    document.body.appendChild(menuEl);
    return menuEl;
}

function showMenu(x, y, card) {
    const menu = ensureMenu();
    pendingCard = card;
    menu.style.display = 'block';
    // 先渲染再钳制到视口内
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
}

function hideMenu() {
    if (menuEl) menuEl.style.display = 'none';
    pendingCard = null;
}

/* ---------- 删除弹窗 ---------- */

function openDeleteModal(card) {
    const modal = document.getElementById('deleteModal');
    const desc = document.getElementById('deleteModalDesc');
    const pwdInput = document.getElementById('deletePassword');
    const errEl = document.getElementById('deleteError');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    if (!modal) return;

    const name = card.dataset.tooltip || '该站点';
    pendingDelete = { id: card.dataset.siteId, name, el: card };

    desc.textContent = `确定删除「${name}」吗？此操作不可恢复。`;
    errEl.textContent = '';
    pwdInput.value = '';

    // 已解锁（编辑模式验证过）则免输密码，只做二次确认
    const unlocked = sessionStorage.getItem(UNLOCK_KEY) === 'true';
    pwdInput.style.display = unlocked ? 'none' : 'block';

    confirmBtn.disabled = false;
    confirmBtn.textContent = '删除';
    modal.style.display = 'flex';
    if (!unlocked) pwdInput.focus();
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'none';
    pendingDelete = null;
}

async function confirmDelete() {
    const pwdInput = document.getElementById('deletePassword');
    const errEl = document.getElementById('deleteError');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    if (!pendingDelete) return;

    const needPassword = pwdInput.style.display !== 'none';
    const password = pwdInput.value;

    if (needPassword && !password) {
        errEl.textContent = '请输入管理密码';
        pwdInput.focus();
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '删除中…';
    errEl.textContent = '';

    try {
        if (needPassword) {
            const vr = await verifyPassword(password);
            if (!vr || !vr.success) {
                errEl.textContent = (vr && (vr.error || vr.message)) || '密码错误';
                pwdInput.select();
                return;
            }
            sessionStorage.setItem(UNLOCK_KEY, 'true');
        }

        const dr = await deleteSite(pendingDelete.id);
        if (!dr || !dr.success) {
            throw new Error((dr && (dr.message || dr.error)) || '删除失败');
        }

        // 前端直接移除卡片，无需整页刷新
        const { el, name } = pendingDelete;
        el.style.transition = 'opacity .25s, transform .25s';
        el.style.opacity = '0';
        el.style.transform = 'scale(.92)';
        setTimeout(() => el.remove(), 260);

        closeDeleteModal();
        showToast(`✓ 已删除「${name}」`);
    } catch (err) {
        errEl.textContent = err.message || '删除失败，请稍后重试';
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '删除';
    }
}

/**
 * 初始化前台快捷操作（替代原来的右键直接复制）
 */
export function setupQuickDelete() {
    // 桌面端右键菜单
    document.addEventListener('contextmenu', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.url) {
            e.preventDefault();
            showMenu(e.clientX, e.clientY, card);
        } else {
            hideMenu();
        }
    });

    // 移动端长按菜单
    let longPressTimer = null;
    let touchPos = null;
    let longPressCard = null;
    const clearLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        touchPos = null;
        longPressCard = null;
    };
    document.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.site-card');
        if (card && card.dataset.url) {
            const t = e.touches[0];
            touchPos = { x: t.clientX, y: t.clientY };
            longPressCard = card;
            longPressTimer = setTimeout(() => {
                showMenu(touchPos.x, touchPos.y, longPressCard);
                // 长按后松手的 click 会触发卡片跳转，在捕获阶段拦掉
                suppressClick = true;
                setTimeout(() => { suppressClick = false; }, 600);
                clearLongPress();
            }, 600);
        }
    }, { passive: true });
    document.addEventListener('touchend', clearLongPress);
    document.addEventListener('touchmove', clearLongPress);

    // 拦截长按后误触的卡片点击（菜单在 body 下，不会被误拦）
    document.addEventListener('click', (e) => {
        if (suppressClick && e.target.closest('.site-card')) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);

    // 点击别处 / Esc / 滚动关闭菜单
    document.addEventListener('click', (e) => {
        if (menuEl && menuEl.style.display !== 'none' && !menuEl.contains(e.target)) {
            hideMenu();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideMenu();
            closeDeleteModal();
        }
    });
    document.addEventListener('scroll', hideMenu, true);

    // 删除弹窗按钮
    const cancelBtn = document.getElementById('deleteCancelBtn');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const modal = document.getElementById('deleteModal');
    const pwdInput = document.getElementById('deletePassword');
    if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDeleteModal();
    });
    if (pwdInput) pwdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmDelete();
    });
}
