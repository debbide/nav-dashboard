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

function requestJson(port, { method, routePath, body, headers = {} }) {
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
                        body: parsed,
                        headers: res.headers
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

test('auth boundaries for settings and backup routes', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-dashboard-auth-'));
    const isolatedDbPath = path.join(tempDir, 'nav.db');

    const originalDbPath = process.env.NAV_DB_PATH;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAdminPassword = process.env.ADMIN_PASSWORD;

    process.env.NAV_DB_PATH = isolatedDbPath;
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_PASSWORD = 'integration-admin-pass';

    clearServerRequireCache();

    const db = require('../server/db');
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

    const publicSites = await requestJson(port, {
        method: 'GET',
        routePath: '/api/sites'
    });
    assert.equal(publicSites.statusCode, 200);
    assert.equal(publicSites.body?.success, true);

    const themeNoAuth = await requestJson(port, {
        method: 'PUT',
        routePath: '/api/settings/theme',
        body: { primaryColor: '#112233' }
    });
    assert.equal(themeNoAuth.statusCode, 401);
    assert.equal(themeNoAuth.body?.success, false);
    assert.match(themeNoAuth.body?.error || '', /未登录/);

    const passwordNoAuth = await requestJson(port, {
        method: 'PUT',
        routePath: '/api/settings/password',
        body: { old_password: 'wrong', new_password: 'new-password' }
    });
    assert.equal(passwordNoAuth.statusCode, 401);
    assert.equal(passwordNoAuth.body?.success, false);
    assert.match(passwordNoAuth.body?.error || '', /未登录/);

    const backupConfigNoAuth = await requestJson(port, {
        method: 'GET',
        routePath: '/api/backup/config'
    });
    assert.equal(backupConfigNoAuth.statusCode, 401);
    assert.equal(backupConfigNoAuth.body?.success, false);
    assert.match(backupConfigNoAuth.body?.error || '', /未登录/);

    const backupNowNoAuth = await requestJson(port, {
        method: 'POST',
        routePath: '/api/backup/now',
        body: {}
    });
    assert.equal(backupNowNoAuth.statusCode, 401);
    assert.equal(backupNowNoAuth.body?.success, false);
    assert.match(backupNowNoAuth.body?.error || '', /未登录/);

    const login = await requestJson(port, {
        method: 'POST',
        routePath: '/api/auth/verify',
        body: { password: 'integration-admin-pass' }
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.body?.success, true);
    assert.ok(login.body?.token);

    const backgroundWithAuth = await requestJson(port, {
        method: 'PUT',
        routePath: '/api/settings/background',
        body: { background_image: 'https://example.com/background.jpg' },
        headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.equal(backgroundWithAuth.statusCode, 200);
    assert.equal(backgroundWithAuth.body?.message, '背景图更新成功');
});
