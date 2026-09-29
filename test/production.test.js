const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const request = require('supertest');

const temp = path.join(os.tmpdir(), `certifica-production-${process.pid}`);
Object.assign(process.env, {
  NODE_ENV: 'production', DATABASE_URL: '', REQUIRE_POSTGRES: '',
  DB_PATH: path.join(temp, 'test.db'),
  BASE_URL: 'https://certifica.example.com',
  SESSION_SECRET: 'segredo-para-teste-de-proxy-com-mais-de-32-caracteres',
  ADMIN_USERNAME: 'proxy_admin', ADMIN_PASSWORD: 'SenhaProxySegura123!',
});
const { app, initDb, close } = require('../server');
test.before(() => initDb());
test.after(async () => { await close(); await fs.rm(temp, { recursive: true, force: true }); });

test('HTTPS no proxy emite cookie seguro e recupera sessão na API', async () => {
  const login = await request(app).post('/api/auth/login').set('X-Forwarded-Proto', 'https')
    .send({ username: 'proxy_admin', password: 'SenhaProxySegura123!' }).expect(200);
  const cookie = login.headers['set-cookie'][0];
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/);
  const me = await request(app).get('/api/me').set('X-Forwarded-Proto', 'https').set('Cookie', cookie.split(';')[0]).expect(200);
  assert.equal(me.body.user.username, 'proxy_admin');
  assert.equal(me.headers['cache-control'], 'no-store');
});
