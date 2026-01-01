/**
 * 密码哈希工具
 */
const crypto = require('crypto');

/**
 * SHA-256 哈希密码
 * @param {string} password - 明文密码
 * @returns {string} 哈希后的密码
 */
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
    hashPassword
};
