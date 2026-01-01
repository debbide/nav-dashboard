/**
 * 图片缓存工具 - 处理远程图片的本地缓存
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// 上传目录
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// 确保上传目录存在
function ensureUploadsDir() {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
}

/**
 * 尝试下载单个图片
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<string|null>} 本地路径或null
 */
async function tryDownloadImage(imageUrl) {
    try {
        ensureUploadsDir();

        // 使用 URL 的 MD5 哈希作为文件名
        const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');

        // 检查是否已存在该哈希的文件
        if (fs.existsSync(uploadsDir)) {
            const existingFiles = fs.readdirSync(uploadsDir);
            const existingFile = existingFiles.find(f => f.startsWith(urlHash));
            if (existingFile) {
                console.log(`图片已存在(跳过下载): ${imageUrl} -> /api/images/${existingFile}`);
                return `/api/images/${existingFile}`;
            }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(imageUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*'
            },
            redirect: 'follow'
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`下载失败 [${imageUrl}]: HTTP ${response.status} ${response.statusText}`);
            return null;
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
            console.log(`格式错误 [${imageUrl}]: Content-Type 是 ${contentType}`);
            return null;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length < 100 || buffer.length > 500 * 1024) {
            console.log(`大小不符 [${imageUrl}]: ${buffer.length} bytes (限制 100B - 500KB)`);
            return null;
        }

        const extMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/svg+xml': '.svg',
            'image/webp': '.webp',
            'image/x-icon': '.ico',
            'image/vnd.microsoft.icon': '.ico'
        };
        const ext = extMap[contentType] || '.ico';
        const filename = `${urlHash}${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log(`图片已缓存: ${imageUrl} -> /api/images/${filename}`);
        return `/api/images/${filename}`;
    } catch (error) {
        console.error(`图片下载/保存失败 [${imageUrl}]:`, error.message);
        return null;
    }
}

/**
 * 缓存远程图片到本地
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<string>} 本地路径或原URL
 */
async function cacheRemoteImage(imageUrl) {
    // 如果已经是本地路径，直接返回
    if (!imageUrl || imageUrl.startsWith('/api/images/')) {
        return imageUrl;
    }

    // 验证 URL
    let parsedUrl;
    try {
        parsedUrl = new URL(imageUrl);
    } catch {
        return imageUrl;
    }

    // 如果是 Google Favicon API，尝试直接从原站获取
    if (imageUrl.includes('google.com/s2/favicons')) {
        const domainMatch = imageUrl.match(/domain=([^&]+)/);
        if (domainMatch) {
            const domain = decodeURIComponent(domainMatch[1]);
            // 尝试直接获取网站的 favicon
            const directFaviconUrl = `https://${domain}/favicon.ico`;
            const cached = await tryDownloadImage(directFaviconUrl);
            if (cached) return cached;

            // 备选：尝试其他 favicon 服务
            const fallbackApis = [
                `https://favicon.im/${domain}`,
                `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            ];

            for (const api of fallbackApis) {
                const result = await tryDownloadImage(api);
                if (result) return result;
            }

            return imageUrl; // 全部失败，返回原 URL
        }
    }

    // 普通图片 URL，先尝试直接下载
    const directResult = await tryDownloadImage(imageUrl);
    if (directResult) return directResult;

    // 降级策略：如果直接下载失败，尝试使用 Google Favicon API
    if (!imageUrl.includes('google.com/s2/favicons')) {
        try {
            const urlObj = new URL(imageUrl);
            const domain = urlObj.hostname;
            console.log(`直接下载失败，尝试使用 Google Favicon 服务: ${domain}`);
            const fallbackUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
            const fallbackResult = await tryDownloadImage(fallbackUrl);
            if (fallbackResult) return fallbackResult;
        } catch (e) {
            // 忽略 URL 解析错误
        }
    }

    return imageUrl; // 最终还是失败，返回原 URL
}

module.exports = {
    uploadsDir,
    ensureUploadsDir,
    tryDownloadImage,
    cacheRemoteImage
};
