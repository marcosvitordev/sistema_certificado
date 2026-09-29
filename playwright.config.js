const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');

module.exports = defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3101', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' },
  webServer: [
    {
      command: 'node server.js', url: 'http://127.0.0.1:3100/healthz', reuseExistingServer: false,
      env: {
        NODE_ENV: 'test', PORT: '3100', BASE_URL: 'http://localhost:3101', DATABASE_URL: '', REQUIRE_POSTGRES: '',
        DB_PATH: path.join(os.tmpdir(), `certifica-e2e-${process.pid}.db`),
        ADMIN_USERNAME: 'e2e_admin', ADMIN_PASSWORD: 'SenhaInicialE2E123!',
        SESSION_SECRET: 'segredo-exclusivo-de-testes-com-mais-de-32-caracteres',
      },
    },
    {
      command: 'npm exec -- next start --port 3101', cwd: path.join(__dirname, 'frontend'), url: 'http://localhost:3101/login',
      reuseExistingServer: false, timeout: 60000,
      env: { API_URL: 'http://127.0.0.1:3100' },
    },
  ],
});
