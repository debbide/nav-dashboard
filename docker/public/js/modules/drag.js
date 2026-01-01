/**
 * 拖拽排序模块
 */

import { saveSitesOrder } from './api.js';

let isEditMode = false;
let draggedCard = null;

/**
 * 获取编辑模式状态
 */
export function getEditMode() {
    return isEditMode;
}

/**
 * 设置编辑模式状态
 */
export function setEditMode(value) {
    isEditMode = value;
}

/**
 * 启用编辑模式
 */
export function enableEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode');
    setupDragAndDrop();
}

/**
 * 禁用编辑模式
 */
export function disableEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');
    removeDragAndDrop();
}

/**
 * 设置拖拽事件
 */
function setupDragAndDrop() {
    const container = document.getElementById('sitesGrid');
    const cards = container.querySelectorAll('.site-card');

    cards.forEach(card => {
        card.setAttribute('draggable', 'true');
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('click', preventClickInEditMode);
    });
}

/**
 * 移除拖拽事件
 */
function removeDragAndDrop() {
    const container = document.getElementById('sitesGrid');
    const cards = container.querySelectorAll('.site-card');

    cards.forEach(card => {
        card.removeAttribute('draggable');
        card.removeEventListener('dragstart', handleDragStart);
        card.removeEventListener('dragend', handleDragEnd);
        card.removeEventListener('dragover', handleDragOver);
        card.removeEventListener('dragleave', handleDragLeave);
        card.removeEventListener('drop', handleDrop);
        card.removeEventListener('click', preventClickInEditMode);
    });
}

/**
 * 阻止编辑模式下的点击跳转
 */
function preventClickInEditMode(e) {
    if (isEditMode) {
        e.preventDefault();
    }
}

/**
 * 拖拽开始
 */
function handleDragStart(e) {
    draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

/**
 * 拖拽结束
 */
function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.site-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    draggedCard = null;
}

/**
 * 拖拽经过
 */
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedCard) {
        this.classList.add('drag-over');
    }
    return false;
}

/**
 * 拖拽离开
 */
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

/**
 * 放下
 */
async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (draggedCard !== this) {
        const container = document.getElementById('sitesGrid');
        const cards = Array.from(container.querySelectorAll('.site-card'));
        const draggedIndex = cards.indexOf(draggedCard);
        const targetIndex = cards.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedCard, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedCard, this);
        }

        await saveNewOrder();
    }

    this.classList.remove('drag-over');
    return false;
}

/**
 * 保存新顺序到服务器
 */
async function saveNewOrder() {
    const container = document.getElementById('sitesGrid');
    const cards = Array.from(container.querySelectorAll('.site-card'));

    const order = cards.map((card, index) => ({
        id: parseInt(card.dataset.siteId),
        sort_order: index
    })).filter(item => !isNaN(item.id));

    if (order.length === 0) return;

    try {
        const result = await saveSitesOrder(order);
        if (!result.success) {
            console.error('排序保存失败:', result.message);
        }
    } catch (error) {
        console.error('排序保存失败:', error);
    }
}
