const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

function clearServerRequireCache() {
    const serverDir = `${path.sep}docker${path.sep}server${path.sep}`;
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.includes(serverDir)) {
            delete require.cache[modulePath];
        }
    }
}

function request(port, { method, routePath, body, headers = {} }) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);

        const req = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path: routePath,
                method,
                headers: {
                    ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                    ...headers
                }
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => {
                    raw += chunk;
                });
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = raw ? JSON.parse(raw) : null;
                    } catch (e) {}

                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsed,
                        text: raw
                    });
                });
            }
        );

        req.on('error', reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

test('docker mainline wave: password/data/backup config behavior', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-dashboard-mainline-'));
    const isolatedDbPath = path.join(tempDir, 'nav.db');

    const originalDbPath = process.env.NAV_DB_PATH;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAdminPassword = process.env.ADMIN_PASSWORD;

    process.env.NAV_DB_PATH = isolatedDbPath;
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_PASSWORD = 'seed-admin-pass';

    clearServerRequireCache();

    const db = require('../server/db');
    const { verifyPassword } = require('../server/utils/hash');
    const { createApp } = require('../server/index');
    const app = createApp();
    const server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    t.after(() => {
        server.close(() => {});
        db.close();
        fs.rmSync(tempDir, { recursive: true, force: true });

        if (originalDbPath === undefined) {
            delete process.env.NAV_DB_PATH;
        } else {
            process.env.NAV_DB_PATH = originalDbPath;
        }

        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }

        if (originalAdminPassword === undefined) {
            delete process.env.ADMIN_PASSWORD;
        } else {
            process.env.ADMIN_PASSWORD = originalAdminPassword;
        }
    });

    const port = server.address().port;

    const login = await request(port, {
        method: 'POST',
        routePath: '/api/auth/verify',
        body: { password: 'seed-admin-pass' }
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.body?.success, true);
    const authHeaders = { Authorization: `Bearer ${login.body.token}` };

    const updatePassword = await request(port, {
        method: 'PUT',
        routePath: '/api/settings/password',
        body: { old_password: 'seed-admin-pass', new_password: 'new-admin-pass-1' },
        headers: authHeaders
    });
    assert.equal(updatePassword.statusCode, 200);

    const storedPassword = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_password')?.value;
    assert.equal(typeof storedPassword, 'string');
    assert.equal(storedPassword.startsWith('$scrypt$'), true);
    assert.equal(await verifyPassword('new-admin-pass-1', storedPassword), true);

    const oldLoginShouldFail = await request(port, {
        method: 'POST',
        routePath: '/api/auth/verify',
        body: { password: 'seed-admin-pass' }
    });
    assert.equal(oldLoginShouldFail.statusCode, 401);

    const newLoginShouldPass = await request(port, {
        method: 'POST',
        routePath: '/api/auth/verify',
        body: { password: 'new-admin-pass-1' }
    });
    assert.equal(newLoginShouldPass.statusCode, 200);
    assert.equal(newLoginShouldPass.body?.success, true);

    const firstSite = db.prepare('SELECT id FROM sites ORDER BY id ASC LIMIT 1').get();
    const tagId = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run('seed-tag', '#111111').lastInsertRowid;
    db.prepare('INSERT OR IGNORE INTO site_tags (site_id, tag_id) VALUES (?, ?)').run(firstSite.id, tagId);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('webdav_password', 'keep-secret');
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('theme', '{"primaryColor":"#ffffff"}');

    const exportRes = await request(port, {
        method: 'GET',
        routePath: '/api/export',
        headers: { Authorization: `Bearer ${newLoginShouldPass.body.token}` }
    });
    assert.equal(exportRes.statusCode, 200);
    assert.ok(Array.isArray(exportRes.body?.tags));
    assert.ok(Array.isArray(exportRes.body?.site_tags));
    assert.equal(exportRes.body.tags.some((tag) => tag.name === 'seed-tag'), true);
    assert.equal(exportRes.body.settings.some((item) => item.key === 'admin_password'), false);
    assert.equal(exportRes.body.settings.some((item) => item.key === 'webdav_password'), false);

    const importPayload = {
        categories: [
            { id: 10, name: '导入分类', icon: '📁', color: '#123456', sort_order: 1 }
        ],
        sites: [
            { id: 20, name: '导入站点', url: 'https://example.com', description: 'desc', logo: '', category_id: 10, sort_order: 1 }
        ],
        tags: [
            { id: 30, name: '导入标签', color: '#654321' }
        ],
        site_tags: [
            { site_id: 20, tag_id: 30 }
        ],
        settings: [
            { key: 'background_image', value: 'https://img.example/bg.jpg' },
            { key: 'webdav_password', value: 'should-not-overwrite' }
        ]
    };

    const importRes = await request(port, {
        method: 'POST',
        routePath: '/api/import',
        body: importPayload,
        headers: { Authorization: `Bearer ${newLoginShouldPass.body.token}` }
    });
    assert.equal(importRes.statusCode, 200);
    assert.equal(importRes.body?.success, true);

    const importedTag = db.prepare('SELECT id, name FROM tags WHERE name = ?').get('导入标签');
    assert.equal(Boolean(importedTag), true);
    const importedSite = db.prepare('SELECT id, name FROM sites WHERE name = ?').get('导入站点');
    assert.equal(Boolean(importedSite), true);
    const importedSiteTag = db.prepare('SELECT site_id, tag_id FROM site_tags WHERE site_id = ? AND tag_id = ?').get(importedSite.id, importedTag.id);
    assert.equal(Boolean(importedSiteTag), true);

    const webdavPasswordAfterImport = db.prepare('SELECT value FROM settings WHERE key = ?').get('webdav_password')?.value;
    assert.equal(webdavPasswordAfterImport, 'keep-secret');

    const preserveMaskedPassword = await request(port, {
        method: 'PUT',
        routePath: '/api/backup/config',
        body: {
            webdav_url: 'https://dav.example.com/dav/',
            webdav_username: 'dav-user',
            webdav_password: '******',
            backup_frequency: 'daily'
        },
        headers: { Authorization: `Bearer ${newLoginShouldPass.body.token}` }
    });
    assert.equal(preserveMaskedPassword.statusCode, 200);
    const webdavPasswordAfterConfig = db.prepare('SELECT value FROM settings WHERE key = ?').get('webdav_password')?.value;
    assert.equal(webdavPasswordAfterConfig, 'keep-secret');

    const invalidFrequency = await request(port, {
        method: 'PUT',
        routePath: '/api/backup/config',
        body: {
            webdav_url: 'https://dav.example.com/dav/',
            webdav_username: 'dav-user',
            backup_frequency: 'hourly'
        },
        headers: { Authorization: `Bearer ${newLoginShouldPass.body.token}` }
    });
    assert.equal(invalidFrequency.statusCode, 400);
    assert.equal(invalidFrequency.body?.success, false);
});
