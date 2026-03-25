const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

test('server module supports test bootstrap with isolated DB', async (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-dashboard-docker-'));
    const isolatedDbPath = path.join(tempDir, 'nav.db');

    const originalDbPath = process.env.NAV_DB_PATH;
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NAV_DB_PATH = isolatedDbPath;
    process.env.NODE_ENV = 'test';

    const dbModulePath = require.resolve('../server/db');
    const serverModulePath = require.resolve('../server/index');
    delete require.cache[dbModulePath];
    delete require.cache[serverModulePath];

    const db = require('../server/db');
    const serverModule = require('../server/index');

    assert.equal(typeof serverModule.createApp, 'function');
    assert.equal(typeof serverModule.startServer, 'function');
    assert.equal(fs.existsSync(isolatedDbPath), true);
    assert.equal(db.dbPath, isolatedDbPath);

    const app = serverModule.createApp();
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
    });

    const { statusCode, body } = await new Promise((resolve, reject) => {
        const req = http.get(
            {
                hostname: '127.0.0.1',
                port: server.address().port,
                path: '/health/live'
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({ statusCode: res.statusCode, body: data });
                });
            }
        );
        req.on('error', reject);
    });

    assert.equal(statusCode, 200);
    assert.equal(body, 'OK');
});
