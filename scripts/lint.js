const { spawnSync } = require('node:child_process');

process.env.ESLINT_USE_FLAT_CONFIG = 'false';
const executable = process.platform === 'win32' ? 'eslint.cmd' : 'eslint';
const result = spawnSync(executable, ['.', '--max-warnings=0'], { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
