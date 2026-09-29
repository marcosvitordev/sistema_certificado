const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'test/app.test.js', 'test/migration.test.js'], {
  stdio: 'inherit', env: { ...process.env, TEST_POSTGRES: '1' },
});
process.exit(result.status ?? 1);
