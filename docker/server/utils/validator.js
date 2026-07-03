/**
 * 输入验证和XSS过滤工具
 */
const dns = require('dns').promises;
const net = require('net');

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
    const { name, url, description, logo } = data || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: '站点名称为必填项' };
    }
    if (name.trim().length > 100) {
        return { valid: false, error: '站点名称不能超过100字符' };
    }

    if (!url || typeof url !== 'string' || !isValidUrl(url.trim())) {
        return { valid: false, error: 'URL格式无效，必须是http或https开头' };
    }
    if (url.trim().length > 2000) {
        return { valid: false, error: 'URL不能超过2000字符' };
    }

    if (description && (typeof description !== 'string' || description.trim().length > 500)) {
        return { valid: false, error: '描述不能超过500字符' };
    }

    if (logo && (typeof logo !== 'string' || (!isValidUrl(logo.trim()) && !logo.trim().startsWith('/') && !logo.trim().startsWith('data:image/')))) {
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
    const { name, icon, color } = data || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: '分类名称为必填项' };
    }
    if (name.trim().length > 50) {
        return { valid: false, error: '分类名称不能超过50字符' };
    }
    if (icon && (typeof icon !== 'string' || icon.trim().length > 20)) {
        return { valid: false, error: '分类图标不能超过20字符' };
    }

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

function validateTagData(data) {
    const { name, color } = data || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return { valid: false, error: '标签名称不能为空' };
    }
    if (name.trim().length > 50) {
        return { valid: false, error: '标签名称不能超过50字符' };
    }
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return { valid: false, error: '颜色格式无效，应为#RRGGBB格式' };
    }

    return {
        valid: true,
        sanitized: {
            name: escapeHtml(name.trim()),
            color: color || '#6366f1'
        }
    };
}

/**
 * 图片代理域名白名单
 */
const DEFAULT_ALLOWED_IMAGE_DOMAINS = [
    'www.google.com',
    'google.com',
    'favicon.im',
    'toolb.cn',
    'api.iowen.cn',
    'api.faviconkit.com',
    'icons.duckduckgo.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'images.unsplash.com',
    'i.imgur.com',
    'avatars.githubusercontent.com',
    'github.githubassets.com',
    'cdn.sstatic.net',
    'raw.githubusercontent.com'
];

function getAllowedImageDomains() {
    const configured = (process.env.ALLOWED_IMAGE_DOMAINS || '')
        .split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean);
    return new Set([...DEFAULT_ALLOWED_IMAGE_DOMAINS, ...configured]);
}

const ALLOWED_IMAGE_DOMAINS = DEFAULT_ALLOWED_IMAGE_DOMAINS;

function normalizeHostname(hostname) {
    const normalized = String(hostname || '').toLowerCase();
    return normalized.startsWith('[') && normalized.endsWith(']') ? normalized.slice(1, -1) : normalized;
}

/**
 * 检查图片URL是否在白名单内
 * @param {string} imageUrl - 图片URL
 * @returns {boolean} 是否允许
 */
function isAllowedImageDomain(imageUrl) {
    try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        return getAllowedImageDomains().has(normalizeHostname(url.hostname));
    } catch {
        return false;
    }
}

function isPrivateIpAddress(address) {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) {
        const parts = address.split('.').map(Number);
        const [a, b] = parts;
        return a === 10
            || a === 127
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || a === 0;
    }

    if (ipVersion === 6) {
        const normalized = address.toLowerCase();
        return normalized === '::1'
            || normalized === '::'
            || normalized.startsWith('fc')
            || normalized.startsWith('fd')
            || normalized.startsWith('fe80:')
            || normalized.startsWith('::ffff:0.')
            || normalized.startsWith('::ffff:10.')
            || normalized.startsWith('::ffff:127.')
            || normalized.startsWith('::ffff:169.254.')
            || normalized.startsWith('::ffff:172.16.')
            || normalized.startsWith('::ffff:172.17.')
            || normalized.startsWith('::ffff:172.18.')
            || normalized.startsWith('::ffff:172.19.')
            || normalized.startsWith('::ffff:172.20.')
            || normalized.startsWith('::ffff:172.21.')
            || normalized.startsWith('::ffff:172.22.')
            || normalized.startsWith('::ffff:172.23.')
            || normalized.startsWith('::ffff:172.24.')
            || normalized.startsWith('::ffff:172.25.')
            || normalized.startsWith('::ffff:172.26.')
            || normalized.startsWith('::ffff:172.27.')
            || normalized.startsWith('::ffff:172.28.')
            || normalized.startsWith('::ffff:172.29.')
            || normalized.startsWith('::ffff:172.30.')
            || normalized.startsWith('::ffff:172.31.')
            || normalized.startsWith('::ffff:192.168.');
    }

    return false;
}

function parseNonNegativeInteger(value, fallback = 0) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
}

function parsePositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function validateBackupFilename(filename) {
    if (typeof filename !== 'string' || !/^nav-dashboard-backup-\d{8}\.json$/.test(filename)) {
        return { valid: false, error: '备份文件名无效' };
    }
    return { valid: true, filename };
}

async function validateRemoteImageUrl(imageUrl) {
    let url;
    try {
        url = new URL(imageUrl);
    } catch {
        return { valid: false, status: 400, error: 'Invalid url parameter' };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, status: 400, error: 'Only http/https protocols are allowed' };
    }

    const hostname = normalizeHostname(url.hostname);
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
        return { valid: false, status: 403, error: 'Internal addresses are not allowed' };
    }

    if (net.isIP(hostname) && isPrivateIpAddress(hostname)) {
        return { valid: false, status: 403, error: 'Internal addresses are not allowed' };
    }

    if (!isAllowedImageDomain(imageUrl)) {
        return { valid: false, status: 403, error: 'Domain not allowed' };
    }

    try {
        const addresses = await dns.lookup(hostname, { all: true, verbatim: false });
        if (addresses.some((entry) => isPrivateIpAddress(entry.address))) {
            return { valid: false, status: 403, error: 'Internal addresses are not allowed' };
        }
    } catch {
        return { valid: false, status: 400, error: 'Unable to resolve image host' };
    }

    return { valid: true, url };
}

module.exports = {
    escapeHtml,
    isValidUrl,
    validateSiteData,
    validateCategoryData,
    validateTagData,
    parseNonNegativeInteger,
    parsePositiveInteger,
    validateBackupFilename,
    isAllowedImageDomain,
    validateRemoteImageUrl,
    isPrivateIpAddress,
    getAllowedImageDomains,
    ALLOWED_IMAGE_DOMAINS
};
