/**
 * 输入验证和XSS过滤工具
 */

/**
 * XSS 过滤 - 转义 HTML 特殊字符
 * @param {string} str - 输入字符串
 * @returns {string} 过滤后的字符串
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * 验证 URL 格式
 * @param {string} url - URL 字符串
 * @returns {boolean} 是否有效
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * 验证站点数据
 * @param {Object} data - 站点数据
 * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
 */
function validateSiteData(data) {
    const { name, url, description, logo } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: '站点名称为必填项' };
    }
    if (name.length > 100) {
        return { valid: false, error: '站点名称不能超过100字符' };
    }

    if (!url || !isValidUrl(url)) {
        return { valid: false, error: 'URL格式无效，必须是http或https开头' };
    }
    if (url.length > 2000) {
        return { valid: false, error: 'URL不能超过2000字符' };
    }

    if (description && description.length > 500) {
        return { valid: false, error: '描述不能超过500字符' };
    }

    if (logo && !isValidUrl(logo) && !logo.startsWith('/')) {
        return { valid: false, error: 'Logo URL格式无效' };
    }

    return {
        valid: true,
        sanitized: {
            name: escapeHtml(name.trim()),
            url: url.trim(),
            description: description ? escapeHtml(description.trim()) : '',
            logo: logo ? logo.trim() : null
        }
    };
}

/**
 * 验证分类数据
 * @param {Object} data - 分类数据
 * @returns {{ valid: boolean, error?: string, sanitized?: Object }}
 */
function validateCategoryData(data) {
    const { name, icon, color } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: '分类名称为必填项' };
    }
    if (name.length > 50) {
        return { valid: false, error: '分类名称不能超过50字符' };
    }

    // 验证颜色格式
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return { valid: false, error: '颜色格式无效，应为#RRGGBB格式' };
    }

    return {
        valid: true,
        sanitized: {
            name: escapeHtml(name.trim()),
            icon: icon ? escapeHtml(icon.trim()) : '',
            color: color || '#ff9a56'
        }
    };
}

/**
 * 图片代理域名白名单
 */
const ALLOWED_IMAGE_DOMAINS = [
    // Favicon 服务
    'www.google.com',
    'google.com',
    'favicon.im',
    'toolb.cn',
    'api.iowen.cn',
    'api.faviconkit.com',
    // 常用 CDN
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    // 图片服务
    'images.unsplash.com',
    'i.imgur.com',
    'avatars.githubusercontent.com',
    'github.githubassets.com',
    'cdn.sstatic.net',
    // 通用
    'raw.githubusercontent.com'
];

/**
 * 检查图片URL是否在白名单内
 * @param {string} imageUrl - 图片URL
 * @returns {boolean} 是否允许
 */
function isAllowedImageDomain(imageUrl) {
    try {
        const url = new URL(imageUrl);
        // 允许白名单域名
        if (ALLOWED_IMAGE_DOMAINS.includes(url.hostname)) {
            return true;
        }
        // 允许所有 favicon 请求 (常见的 favicon 获取模式)
        if (url.pathname.includes('favicon') || url.pathname.includes('s2/favicons')) {
            return true;
        }
        // 允许常见图片扩展名
        const ext = url.pathname.split('.').pop().toLowerCase();
        if (['ico', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

module.exports = {
    escapeHtml,
    isValidUrl,
    validateSiteData,
    validateCategoryData,
    isAllowedImageDomain,
    ALLOWED_IMAGE_DOMAINS
};
