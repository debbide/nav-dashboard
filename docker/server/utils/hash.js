/**
 * 密码哈希工具 - 增强版
 * 使用 crypto 的 scrypt 算法（Node.js 内置，无需额外依赖）
 * 比单纯 SHA-256 更安全，支持盐值
 */
const crypto = require('crypto');

// 配置参数
const SALT_LENGTH = 16;  // 盐值长度
const KEY_LENGTH = 64;   // 密钥长度
const SCRYPT_COST = 16384;  // N 参数 (2^14)
const SCRYPT_BLOCK_SIZE = 8;  // r 参数
const SCRYPT_PARALLELIZATION = 1;  // p 参数

/**
 * 生成密码哈希（异步）
 * 返回格式: $scrypt$N$r$p$salt$hash
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 哈希后的密码
 */
async function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SALT_LENGTH);

        crypto.scrypt(password, salt, KEY_LENGTH, {
            N: SCRYPT_COST,
            r: SCRYPT_BLOCK_SIZE,
            p: SCRYPT_PARALLELIZATION
        }, (err, derivedKey) => {
            if (err) reject(err);

            // 格式: $scrypt$N$r$p$salt$hash
            const hash = `$scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
            resolve(hash);
        });
    });
}

/**
 * 验证密码（异步）
 * @param {string} password - 明文密码
 * @param {string} storedHash - 存储的哈希值
 * @returns {Promise<boolean>} 是否匹配
 */
async function verifyPassword(password, storedHash) {
    return new Promise((resolve, reject) => {
        // 兼容旧的 SHA-256 格式（64位hex）
        if (storedHash && storedHash.length === 64 && !storedHash.startsWith('$')) {
            const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
            return resolve(sha256Hash === storedHash);
        }

        // 解析 scrypt 格式
        if (!storedHash || !storedHash.startsWith('$scrypt$')) {
            return resolve(false);
        }

        try {
            const parts = storedHash.split('$');
            // parts: ['', 'scrypt', N, r, p, salt, hash]
            if (parts.length !== 7) {
                return resolve(false);
            }

            const N = parseInt(parts[2]);
            const r = parseInt(parts[3]);
            const p = parseInt(parts[4]);
            const salt = Buffer.from(parts[5], 'hex');
            const hash = parts[6];

            crypto.scrypt(password, salt, KEY_LENGTH, { N, r, p }, (err, derivedKey) => {
                if (err) reject(err);
                resolve(derivedKey.toString('hex') === hash);
            });
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * 同步 SHA-256 哈希（仅用于兼容性检查）
 * @param {string} password - 明文密码
 * @returns {string} SHA-256 哈希
 */
function sha256Hash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 检查是否需要升级密码哈希格式
 * @param {string} storedHash - 存储的哈希值
 * @returns {boolean} 是否需要升级
 */
function needsUpgrade(storedHash) {
    // 如果是旧的 SHA-256 格式或明文，需要升级
    if (!storedHash) return false;
    return !storedHash.startsWith('$scrypt$');
}

module.exports = {
    hashPassword,
    verifyPassword,
    sha256Hash,
    needsUpgrade
};
